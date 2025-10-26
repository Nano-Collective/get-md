// src/optimizers/html-cleaner.ts

import * as cheerio from 'cheerio';

export interface CleanOptions {
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
  $('script, style, noscript').remove();

  // 2. Remove common noise elements
  if (options.aggressive !== false) {
    removeNoiseElements($);
  }

  // 3. Clean attributes (keep only essential ones)
  cleanAttributes($);

  // 4. Remove empty elements
  removeEmptyElements($);

  // 5. Resolve relative URLs
  if (options.baseUrl) {
    resolveRelativeUrls($, options.baseUrl);
  }

  // 6. Remove comments
  $('*')
    .contents()
    .filter((_, el) => el.type === 'comment')
    .remove();

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
    ].join(',')
  ).remove();

  // Remove by common class/id patterns
  const noiseSelectors = [
    // Navigation
    'nav',
    '.nav',
    '.navigation',
    '.navbar',
    '.menu',
    '#menu',

    // Headers/Footers
    'header',
    'footer',
    '.header',
    '.footer',
    '#header',
    '#footer',

    // Sidebars
    'aside',
    '.sidebar',
    '.aside',
    '#sidebar',

    // Ads
    '.ad',
    '.ads',
    '.advertisement',
    '.advert',
    '[id*="ad-"]',
    '[class*="advertisement"]',
    '[class*="-ad-"]',
    '[class*="google-ad"]',

    // Social media
    '.social',
    '.social-share',
    '.share-buttons',
    '.social-media',

    // Comments
    '.comments',
    '#comments',
    '.comment-section',

    // Related/recommendations
    '.related',
    '.recommendations',
    '.suggested',

    // Popups/modals
    '.modal',
    '.popup',
    '.overlay',
    '[role="dialog"]',

    // Cookie notices
    '.cookie-notice',
    '.cookie-banner',
    '#cookie-consent',

    // Newsletter signups
    '.newsletter',
    '.subscribe',
    '.signup-form',
  ];

  $(noiseSelectors.join(',')).remove();

  // Remove elements with common noise text
  $('*')
    .filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return (
        text.includes('cookie policy') ||
        text.includes('accept cookies') ||
        text.includes('sign up for') ||
        text.includes('newsletter') ||
        text.includes('follow us')
      );
    })
    .remove();
}

function cleanAttributes($: cheerio.CheerioAPI): void {
  // Attributes to preserve
  const keepAttributes = new Set([
    'href',
    'src',
    'alt',
    'title',
    'colspan',
    'rowspan', // For tables
    'align', // For table alignment
  ]);

  $('*').each((_, el) => {
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
  const importantTags = new Set(['img', 'br', 'hr', 'input', 'iframe']);

  $('*').each((_, el) => {
    const $el = $(el);
    const tagName = (el as any).tagName?.toLowerCase();

    // Skip important tags
    if (tagName && importantTags.has(tagName)) return;

    // Check if element is empty (no text and no important children)
    const hasText = $el.text().trim().length > 0;
    const hasImportantChildren = $el.find('img, iframe').length > 0;

    if (!hasText && !hasImportantChildren) {
      $el.remove();
    }
  });
}

function resolveRelativeUrls($: cheerio.CheerioAPI, baseUrl: string): void {
  const base = new URL(baseUrl);

  // Resolve image sources
  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      try {
        $el.attr('src', new URL(src, base).href);
      } catch {}
    }
  });

  // Resolve link hrefs
  $('a').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (
      href &&
      !href.startsWith('http') &&
      !href.startsWith('#') &&
      !href.startsWith('mailto:')
    ) {
      try {
        $el.attr('href', new URL(href, base).href);
      } catch {}
    }
  });
}
