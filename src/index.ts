// src/index.ts

import { MarkdownParser } from './parsers/markdown-parser.js';
import { fetchUrl, isValidUrl } from './utils/url-fetcher.js';
import { hasContent as hasContentUtil } from './utils/validators.js';
import type {
  MarkdownOptions,
  MarkdownResult,
  ContentMetadata,
  FetchOptions,
  TurndownRule,
  ConversionStats,
} from './types.js';

/**
 * Convert HTML to clean, LLM-optimized Markdown
 *
 * @param html - Raw HTML string or URL to fetch
 * @param options - Conversion options
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
 * ```
 */
export async function convertToMarkdown(
  html: string,
  options?: MarkdownOptions
): Promise<MarkdownResult> {
  // Check if input is a URL
  if (isValidUrl(html)) {
    return fetchAndConvert(html, options);
  }

  const parser = new MarkdownParser();
  return parser.convert(html, options);
}

/**
 * Fetch HTML from a URL and convert to markdown
 *
 * @param url - URL to fetch
 * @param options - Fetch and conversion options
 * @returns Promise resolving to markdown result
 *
 * @example
 * ```typescript
 * import { fetchAndConvert } from '@nanocollective/get-md';
 *
 * const result = await fetchAndConvert('https://example.com', {
 *   timeout: 10000,
 *   llmOptimized: true
 * });
 * ```
 */
export async function fetchAndConvert(
  url: string,
  options?: FetchOptions & MarkdownOptions
): Promise<MarkdownResult> {
  // Extract fetch options
  const fetchOptions: FetchOptions = {
    timeout: options?.timeout,
    followRedirects: options?.followRedirects,
    maxRedirects: options?.maxRedirects,
    headers: options?.headers,
    userAgent: options?.userAgent,
  };

  // Extract markdown options
  const markdownOptions: MarkdownOptions = {
    extractContent: options?.extractContent,
    includeMeta: options?.includeMeta,
    llmOptimized: options?.llmOptimized,
    customRules: options?.customRules,
    preserveElements: options?.preserveElements,
    maxLength: options?.maxLength,
    baseUrl: options?.baseUrl || url,
    includeImages: options?.includeImages,
    includeLinks: options?.includeLinks,
    includeTables: options?.includeTables,
    aggressiveCleanup: options?.aggressiveCleanup,
  };

  const html = await fetchUrl(url, fetchOptions);
  const parser = new MarkdownParser();
  return parser.convert(html, markdownOptions);
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
  FetchOptions,
  TurndownRule,
};
