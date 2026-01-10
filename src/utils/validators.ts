// src/utils/validators.ts

import * as cheerio from "cheerio/slim";

/**
 * Validate if HTML contains extractable content
 */
export function hasContent(html: string): boolean {
  if (!html || typeof html !== "string") {
    return false;
  }

  try {
    const $ = cheerio.load(html);

    // Remove scripts, styles, and common noise
    $("script, style, nav, header, footer").remove();

    // Get text content
    const text = $("body").text().trim();

    // Consider it has content if there's at least 100 characters of text
    return text.length >= 100;
  } catch {
    return false;
  }
}
