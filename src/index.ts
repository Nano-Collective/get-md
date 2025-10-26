// src/index.ts

import { MarkdownParser } from "./parsers/markdown-parser.js";
import { fetchUrl, isValidUrl } from "./utils/url-fetcher.js";
import { hasContent as hasContentUtil } from "./utils/validators.js";
import type {
  MarkdownOptions,
  MarkdownResult,
  ContentMetadata,
  TurndownRule,
  ConversionStats,
} from "./types.js";
import type { FetchOptions } from "./types.js";

/**
 * Convert HTML to clean, LLM-optimized Markdown
 *
 * @param html - Raw HTML string or URL to fetch
 * @param options - Conversion options (including fetch options for URLs)
 * @returns Promise resolving to markdown result
 *
 * @example
 * ```typescript
 * import { convertToMarkdown } from '@nanocollective/get-md';
 *
 * // From HTML string
 * const result = await convertToMarkdown('<h1>Hello</h1><p>World</p>');
 * console.log(result.markdown);
 * // # Hello
 * //
 * // World
 *
 * // From URL
 * const result = await convertToMarkdown('https://example.com');
 * console.log(result.metadata.title);
 *
 * // From URL with custom fetch options
 * const result = await convertToMarkdown('https://example.com', {
 *   timeout: 10000,
 *   headers: { 'Authorization': 'Bearer token' },
 *   llmOptimized: true
 * });
 *
 * // Force URL mode if auto-detection fails
 * const result = await convertToMarkdown('example.com', { isUrl: true });
 * ```
 */
export async function convertToMarkdown(
  html: string,
  options?: MarkdownOptions,
): Promise<MarkdownResult> {
  // Check if input is a URL (or forced to be treated as one)
  if (options?.isUrl || isValidUrl(html)) {
    // Extract fetch options
    const fetchOptions: FetchOptions = {
      timeout: options?.timeout,
      followRedirects: options?.followRedirects,
      maxRedirects: options?.maxRedirects,
      headers: options?.headers,
      userAgent: options?.userAgent,
    };

    // Fetch HTML from URL
    const fetchedHtml = await fetchUrl(html, fetchOptions);

    // Parse with base URL set to the fetched URL
    const parser = new MarkdownParser();
    return parser.convert(fetchedHtml, {
      ...options,
      baseUrl: options?.baseUrl || html,
    });
  }

  const parser = new MarkdownParser();
  return parser.convert(html, options);
}

/**
 * Validate if HTML contains extractable content
 *
 * @param html - Raw HTML string
 * @returns Whether content can be extracted
 */
export function hasContent(html: string): boolean {
  return hasContentUtil(html);
}

// Re-export types
export type {
  MarkdownOptions,
  MarkdownResult,
  ContentMetadata,
  ConversionStats,
  TurndownRule,
};
