// src/optimizers/html-cleaner.ts

import * as cheerio from "cheerio/slim";

interface CleanOptions {
  /** Remove ads, navigation, social media, etc. */
  aggressive?: boolean;
  /** Base URL for resolving relative URLs */
  baseUrl?: string;
}

/**
 * Aggressively clean HTML to remove noise for LLMs
 */
export function cleanHTML(html: string, options: CleanOptions = {}): string {
  const $ = cheerio.load(html);

  // 1. Remove script and style tags
  $("script, style, noscript").remove();

  // 2. Remove common noise elements BEFORE cleaning attributes
  // This way we can still use class/ID selectors
  if (options.aggressive !== false) {
    removeNoiseElements($);
  }

  // 3. Remove comments
  $("*")
    .contents()
    .filter((_, el) => (el as { type?: string }).type === "comment")
    .remove();

  // 4. Resolve relative URLs (do this before cleaning attributes so we still have src/href)
  if (options.baseUrl) {
    resolveRelativeUrls($, options.baseUrl);
  }

  // 5. Clean attributes (keep only essential ones)
  // Do this AFTER removing noise so our selectors still work
  cleanAttributes($);

  // 6. Remove empty elements (do this last after everything else is cleaned)
  removeEmptyElements($);

  return $.html();
}

function removeNoiseElements($: cheerio.CheerioAPI): void {
  // Remove by ARIA role attribute
  $(
    [
      '[role="navigation"]',
      '[role="banner"]',
      '[role="complementary"]',
      '[role="contentinfo"]',
      '[role="search"]',
    ].join(","),
  ).remove();

  // Remove by common class/id patterns.
  // These target site-level chrome (nav, sidebars, ads, modals, cookie notices,
  // comment sections, social widgets) while being conservative about
  // removing <header>/<footer> elements since many sites put primary page
  // titles and important content inside them.
  const noiseSelectors = [
    // Navigation elements — targeted selectors only.
    // We avoid bare "nav" / "header" / "footer" because many sites place
    // primary page titles and article metadata inside them.
    // But "nav.navbar" is unambiguously site-level navigation.
    "nav.navbar",
    "div.navbar",
    'div[role="navigation"]',
    "#navigation",
    "#nav",
    "#menu",

    // Known site / framework chrome IDs and classes.
    // These are general patterns (not site-specific) that match common
    // CMS/framework conventions for site-level chrome.
    "#header",
    "#footer",
    "div.site-header",
    "div.site-footer",
    "div.page-header",
    "div.page-footer",

    // Sidebars — these are almost never primary content
    "aside",
    "div.sidebar",
    'div[role="complementary"]',
    "#sidebar",

    // Breadcrumbs
    '[class*="breadcrumb"]',
    "nav.breadcrumb",
    ".breadcrumbs-bar",
    ".breadcrumbs",

    // Ads
    ".ad",
    ".ads",
    ".advertisement",
    ".advert",
    '[id*="ad-"]',
    '[class*="advertisement"]',
    '[class*="-ad-"]',
    '[class*="google-ad"]',

    // Social media
    ".social",
    ".social-share",
    ".share-buttons",
    ".social-media",

    // Comments
    ".comments",
    "#comments",
    ".comment-section",

    // Related/recommendations
    ".related",
    ".recommendations",
    ".suggested",

    // Popups/modals
    ".modal",
    ".popup",
    ".overlay",
    '[role="dialog"]',

    // Cookie notices
    ".cookie-notice",
    ".cookie-banner",
    "#cookie-consent",

    // Newsletter signups
    ".newsletter",
    ".subscribe",
    ".signup-form",
  ];

  $(noiseSelectors.join(",")).remove();

  // Remove elements with common noise text
  // But ONLY if they are small elements (to avoid removing large content blocks
  // that happen to mention these terms)
  $("*")
    .filter((_, el) => {
      const $el = $(el);
      const text = $el.text().toLowerCase();
      const textLength = text.trim().length;

      // Only remove if text is short (< 200 chars) and matches noise patterns
      // This avoids removing entire articles that mention these terms
      if (textLength > 200) return false;

      return (
        text.includes("cookie policy") ||
        text.includes("accept cookies") ||
        text.includes("sign up for") ||
        text.includes("newsletter") ||
        text.includes("follow us")
      );
    })
    .remove();
}

function cleanAttributes($: cheerio.CheerioAPI): void {
  // Attributes to preserve
  const keepAttributes = new Set([
    "href",
    "src",
    "alt",
    "title",
    "colspan",
    "rowspan", // For tables
    "align", // For table alignment
  ]);

  $("*").each((_, el) => {
    const $el = $(el);
    const attrs = $el.attr();

    if (attrs) {
      const tagName = (el as { tagName?: string }).tagName?.toLowerCase();
      Object.keys(attrs).forEach((attr) => {
        // Keep attributes in the keepAttributes set
        if (keepAttributes.has(attr)) {
          return;
        }

        if (attr === "class" && (tagName === "pre" || tagName === "code")) {
          return;
        }

        // Also preserve data- attributes on pre/code elements and their containers
        // These often contain clean code content (GitHub, GitLab, etc.)
        if (
          attr.startsWith("data-") &&
          (tagName === "pre" ||
            tagName === "code" ||
            tagName === "div" ||
            tagName === "figure")
        ) {
          return;
        }

        // Preserve common lazy-loading attributes on <img> tags. Wikipedia,
        // Medium, most modern blog platforms put the real URL in `data-src`
        // (or `data-original` / `data-lazy-src`) and use `src` as a 1×1
        // placeholder. Stripping these would leave the placeholder as the
        // only URL — and would silently break image localization.
        if (
          tagName === "img" &&
          (attr === "data-src" ||
            attr === "data-original" ||
            attr === "data-lazy-src" ||
            attr === "srcset" ||
            attr === "data-srcset")
        ) {
          return;
        }

        // Remove all other attributes
        $el.removeAttr(attr);
      });
    }
  });
}

function removeEmptyElements($: cheerio.CheerioAPI): void {
  // Remove elements that have no text and no important children
  const importantTags = new Set(["img", "br", "hr", "input", "iframe"]);
  const contentTags = new Set([
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "table",
    "blockquote",
    "pre",
    "code",
  ]);

  $("*").each((_, el) => {
    const $el = $(el);
    const tagName = (el as { tagName?: string }).tagName?.toLowerCase();

    // Skip important tags
    if (tagName && importantTags.has(tagName)) return;

    // Get the text content
    const text = $el.text().trim();
    const hasImportantChildren = $el.find("img, iframe").length > 0;
    const hasContentTags =
      $el.find("p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre")
        .length > 0;

    // For content-bearing tags (p, h1-h6, etc), remove if they're empty or just junk
    if (tagName && contentTags.has(tagName)) {
      // Remove if completely empty
      if (text.length === 0 && !hasImportantChildren) {
        $el.remove();
        return;
      }

      // Remove if only contains punctuation/whitespace like "|", "-", etc.
      const meaningfulText = text.replace(/[\s|_.:;-]+/g, "");
      if (meaningfulText.length === 0 && !hasImportantChildren) {
        $el.remove();
        return;
      }
    }

    // For container elements (div, section, etc), remove if no text and no important children
    if (!text && !hasImportantChildren && !hasContentTags) {
      $el.remove();
    }
  });
}

function resolveRelativeUrls($: cheerio.CheerioAPI, baseUrl: string): void {
  const base = new URL(baseUrl);

  // Resolve image sources — including the lazy-load attributes preserved by
  // cleanAttributes. If we miss these, lazy images stay as relative refs
  // that can't be fetched downstream.
  const imageUrlAttrs = ["src", "data-src", "data-original", "data-lazy-src"];
  $("img").each((_, el) => {
    const $el = $(el);
    for (const attr of imageUrlAttrs) {
      const value = $el.attr(attr);
      if (value && !value.startsWith("http") && !value.startsWith("data:")) {
        try {
          $el.attr(attr, new URL(value, base).href);
        } catch {
          // Ignore invalid URLs
        }
      }
    }
  });

  // Resolve link hrefs
  $("a").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (
      href &&
      !href.startsWith("http") &&
      !href.startsWith("#") &&
      !href.startsWith("mailto:")
    ) {
      try {
        $el.attr("href", new URL(href, base).href);
      } catch {
        // Ignore invalid URLs
      }
    }
  });
}
