// src/index.ts

import { MarkdownParser } from "./parsers/markdown-parser.js";
import { fetchUrl, isValidUrl } from "./utils/url-fetcher.js";
import { hasContent as hasContentUtil } from "./utils/validators.js";
import {
  checkLLMModel,
  downloadLLMModel,
  removeLLMModel,
  getLLMModelInfo,
} from "./converters/llm-manager.js";
import type {
  ContentMetadata,
  ConversionStats,
  FetchOptions,
  MarkdownOptions,
  MarkdownResult,
  TurndownRule,
  // LLM types
  LLMEvent,
  LLMEventCallback,
  LLMModelStatus,
  LLMDownloadOptions,
  LLMModelInfo,
  LLMModelVariant,
} from "./types.js";

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
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * // Force URL mode if auto-detection fails
 * const result = await convertToMarkdown('example.com', { isUrl: true });
 *
 * // Use LLM for higher quality conversion
 * const result = await convertToMarkdown('https://example.com', {
 *   useLLM: true,
 *   onLLMEvent: (event) => console.log(event)
 * });
 * ```
 */
export async function convertToMarkdown(
  html: string,
  options?: MarkdownOptions,
): Promise<MarkdownResult> {
  let inputHtml = html;
  let baseUrl = options?.baseUrl;

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
    inputHtml = await fetchUrl(html, fetchOptions);
    baseUrl = baseUrl || html;
  }

  const parser = new MarkdownParser();
  const convertOptions = { ...options, baseUrl };

  // Use async path if LLM is enabled, otherwise use sync path
  if (options?.useLLM) {
    return parser.convertAsync(inputHtml, convertOptions);
  }

  return parser.convert(inputHtml, convertOptions);
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

// Re-export LLM utility functions
export { checkLLMModel, downloadLLMModel, removeLLMModel, getLLMModelInfo };

// Re-export LLM classes for advanced usage
export { LLMManager } from "./converters/llm-manager.js";
export {
  LLMConverter,
  createLLMConverter,
} from "./converters/llm-converter.js";

// Re-export types
export type {
  // Core types
  MarkdownOptions,
  MarkdownResult,
  ContentMetadata,
  ConversionStats,
  TurndownRule,
  FetchOptions,
  // LLM types
  LLMEvent,
  LLMEventCallback,
  LLMModelStatus,
  LLMDownloadOptions,
  LLMModelInfo,
  LLMModelVariant,
};
