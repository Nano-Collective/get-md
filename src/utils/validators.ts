// src/utils/validators.ts

import * as cheerio from 'cheerio';

/**
 * Validate if HTML contains extractable content
 */
export function hasContent(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return false;
  }

  try {
    const $ = cheerio.load(html);

    // Remove scripts, styles, and common noise
    $('script, style, nav, header, footer').remove();

    // Get text content
    const text = $('body').text().trim();

    // Consider it has content if there's at least 100 characters of text
    return text.length >= 100;
  } catch {
    return false;
  }
}

/**
 * Validate HTML string
 */
export function isValidHtml(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return false;
  }

  try {
    // Try to parse with cheerio
    cheerio.load(html);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate JSON schema
 */
export function isValidSchema(schema: any): boolean {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  // Check if it has required properties for a JSON schema
  return (
    'schema' in schema &&
    typeof schema.schema === 'object' &&
    schema.schema !== null
  );
}
