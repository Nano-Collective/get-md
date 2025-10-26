// src/optimizers/html-cleaner.ts

import * as cheerio from "cheerio";

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
    .filter((_, el) => el.type === "comment")
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
  // Remove by role attribute
  $(
    [
      '[role="navigation"]',
      '[role="banner"]',
      '[role="complementary"]',
      '[role="contentinfo"]',
      '[role="search"]',
    ].join(","),
  ).remove();

  // Remove by common class/id patterns
  // More specific selectors to avoid false positives
  const noiseSelectors = [
    // Navigation elements (but not components that just have 'nav' in the name)
    'nav[role="navigation"]',
    "nav.navbar",
    "nav.nav-menu",
    "div.navbar",
    'div[role="navigation"]',
    "#navigation",
    "#nav",
    "#menu",

    // Headers/Footers - only actual header/footer elements or very specific classes
    'header[role="banner"]',
    'footer[role="contentinfo"]',
    "#header",
    "#footer",
    "div.site-header",
    "div.site-footer",
    "div.page-header",
    "div.page-footer",

    // Sidebars
    "aside",
    "div.sidebar",
    'div[role="complementary"]',
    "#sidebar",

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
      Object.keys(attrs).forEach((attr) => {
        if (!keepAttributes.has(attr)) {
          $el.removeAttr(attr);
        }
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
    const tagName = (el as any).tagName?.toLowerCase();

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
      const meaningfulText = text.replace(/[\s\|\-_\.\,\:\;]+/g, "");
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

  // Resolve image sources
  $("img").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src");
    if (src && !src.startsWith("http") && !src.startsWith("data:")) {
      try {
        $el.attr("src", new URL(src, base).href);
      } catch {}
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
      } catch {}
    }
  });
}
