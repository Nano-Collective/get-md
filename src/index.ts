// src/index.ts

import { MarkdownParser } from './parsers/markdown-parser.js';
import { JsonParser } from './parsers/json-parser.js';
import { extractMetadata as extractMetadataUtil } from './extractors/metadata-extractor.js';
import { fetchUrl, isValidUrl } from './utils/url-fetcher.js';
import { hasContent as hasContentUtil } from './utils/validators.js';
import type {
  MarkdownOptions,
  MarkdownResult,
  JsonExtractionOptions,
  JsonSchema,
  JsonResult,
  ContentMetadata,
  FetchOptions,
  TurndownRule,
  ConversionStats,
  ExtractionStats,
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
 * Extract structured JSON from HTML using a schema
 *
 * @param html - Raw HTML string or URL to fetch
 * @param schema - JSON Schema for extraction
 * @param options - Extraction options
 * @returns Promise resolving to extracted JSON data
 *
 * @example
 * ```typescript
 * import { convertToJSON } from '@nanocollective/get-md';
 *
 * const schema = {
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       title: { type: 'string' },
 *       author: { type: 'string' },
 *       publishDate: { type: 'string' }
 *     },
 *     required: ['title']
 *   }
 * };
 *
 * const result = await convertToJSON(html, schema);
 * console.log(result.data.title);
 * ```
 */
export async function convertToJSON<T = any>(
  html: string,
  schema: JsonSchema,
  options?: JsonExtractionOptions
): Promise<JsonResult<T>> {
  // Check if input is a URL
  if (isValidUrl(html)) {
    const fetchedHtml = await fetchUrl(html);
    const parser = new JsonParser();
    return parser.extract<T>(fetchedHtml, schema, {
      ...options,
      baseUrl: options?.baseUrl || html,
    });
  }

  const parser = new JsonParser();
  return parser.extract<T>(html, schema, options);
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
 * Extract only metadata from HTML without full conversion
 *
 * @param html - Raw HTML string or URL
 * @returns Promise resolving to metadata
 *
 * @example
 * ```typescript
 * import { extractMetadata } from '@nanocollective/get-md';
 *
 * const meta = await extractMetadata(html);
 * console.log(meta.title, meta.author, meta.readingTime);
 * ```
 */
export async function extractMetadata(
  html: string
): Promise<ContentMetadata> {
  // Check if input is a URL
  if (isValidUrl(html)) {
    const fetchedHtml = await fetchUrl(html);
    return extractMetadataUtil(fetchedHtml, html);
  }

  return extractMetadataUtil(html);
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
  JsonExtractionOptions,
  JsonSchema,
  JsonResult,
  ContentMetadata,
  ConversionStats,
  ExtractionStats,
  FetchOptions,
  TurndownRule,
};
