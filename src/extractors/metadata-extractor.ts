// src/extractors/metadata-extractor.ts

import * as cheerio from "cheerio/slim";
import type { ContentMetadata } from "../types.js";

/**
 * Extract metadata from HTML
 */
export function extractMetadata(
  html: string,
  baseUrl?: string,
): ContentMetadata {
  const $ = cheerio.load(html);

  return {
    title: extractTitle($),
    author: extractAuthor($),
    excerpt: extractExcerpt($),
    siteName: extractSiteName($),
    publishedTime: extractPublishedTime($),
    language: extractLanguage($),
    canonicalUrl: extractCanonicalUrl($, baseUrl),
    // wordCount and readingTime are now calculated from final markdown
  };
}

function extractTitle($: cheerio.CheerioAPI): string | undefined {
  // Try Open Graph
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (ogTitle) return ogTitle;

  // Try Twitter
  const twitterTitle = $('meta[name="twitter:title"]').attr("content");
  if (twitterTitle) return twitterTitle;

  // Try regular title tag — use .first() to avoid concatenating multiple title tags
  // (some pages have multiple <title> elements e.g. MDN has 4)
  const titleTag = $("title").first().text();
  if (titleTag) return titleTag.trim();

  // Try first h1
  const h1 = $("h1").first().text();
  if (h1) return h1.trim();

  return undefined;
}

function extractAuthor($: cheerio.CheerioAPI): string | undefined {
  // Try meta author tag
  const metaAuthor = $('meta[name="author"]').attr("content");
  if (metaAuthor) return metaAuthor;

  // Try article:author
  const articleAuthor = $('meta[property="article:author"]').attr("content");
  if (articleAuthor) return articleAuthor;

  // Try rel="author"
  const relAuthor = $('[rel="author"]').text().trim();
  if (relAuthor) return relAuthor;

  // Try common class names
  const byline = $(".author, .byline, .author-name").first().text().trim();
  if (byline) return byline;

  return undefined;
}

function extractExcerpt($: cheerio.CheerioAPI): string | undefined {
  // Try Open Graph
  const ogDesc = $('meta[property="og:description"]').attr("content");
  if (ogDesc) return ogDesc;

  // Try meta description
  const metaDesc = $('meta[name="description"]').attr("content");
  if (metaDesc) return metaDesc;

  // Try Twitter
  const twitterDesc = $('meta[name="twitter:description"]').attr("content");
  if (twitterDesc) return twitterDesc;

  return undefined;
}

function extractSiteName($: cheerio.CheerioAPI): string | undefined {
  // Try Open Graph
  const ogSite = $('meta[property="og:site_name"]').attr("content");
  if (ogSite) return deduplicateSiteName(ogSite);

  // Try application name
  const appName = $('meta[name="application-name"]').attr("content");
  if (appName) return deduplicateSiteName(appName);

  return undefined;
}

/**
 * Deduplicate repeated site name tokens.
 * Some sites (notably MDN) have meta tags like "MDNMDNMDN Mozilla"
 * where the name is repeated. Collapse runs of the same token.
 */
function deduplicateSiteName(raw: string): string {
  // Split on whitespace and collapse consecutive duplicate tokens
  const tokens = raw.trim().split(/\s+/);
  if (tokens.length <= 1) return raw.trim();

  const collapsed: string[] = [tokens[0]];
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] !== tokens[i - 1]) {
      collapsed.push(tokens[i]);
    }
  }

  // Also handle the case where the name is repeated without spaces
  // e.g. "MDNMDNMDN Mozilla" -> detect the repeated prefix
  const result = collapsed.join(" ");
  const prefixMatch = result.match(/^(.{2,}?)\1{2,}\s/);
  if (prefixMatch) {
    return `${prefixMatch[1]} ${result.slice(prefixMatch[0].length).trim()}`.trim();
  }

  return result;
}

function extractPublishedTime($: cheerio.CheerioAPI): string | undefined {
  // Try article:published_time
  const articleTime = $('meta[property="article:published_time"]').attr(
    "content",
  );
  if (articleTime) return articleTime;

  // Try time element with datetime
  const timeEl = $("time[datetime]").first().attr("datetime");
  if (timeEl) return timeEl;

  // Try datePublished
  const datePublished = $('[itemprop="datePublished"]').first().attr("content");
  if (datePublished) return datePublished;

  return undefined;
}

function extractLanguage($: cheerio.CheerioAPI): string | undefined {
  // Try html lang attribute
  const htmlLang = $("html").attr("lang");
  if (htmlLang) return htmlLang;

  // Try meta content-language
  const metaLang = $('meta[http-equiv="content-language"]').attr("content");
  if (metaLang) return metaLang;

  return undefined;
}

function extractCanonicalUrl(
  $: cheerio.CheerioAPI,
  baseUrl?: string,
): string | undefined {
  // Try link rel="canonical"
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) {
    if (canonical.startsWith("http")) return canonical;
    if (baseUrl) {
      try {
        return new URL(canonical, baseUrl).href;
      } catch {
        // Ignore invalid URLs
      }
    }
    return canonical;
  }

  // Try Open Graph URL
  const ogUrl = $('meta[property="og:url"]').attr("content");
  if (ogUrl) return ogUrl;

  return baseUrl;
}
