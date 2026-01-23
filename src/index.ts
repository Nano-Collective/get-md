// src/index.ts

import {
  checkLLMModel,
  downloadLLMModel,
  getLLMModelInfo,
  removeLLMModel,
} from "./converters/llm-manager.js";
import { MarkdownParser } from "./parsers/markdown-parser.js";
import type {
  ContentMetadata,
  ConversionStats,
  FetchOptions,
  LLMDownloadOptions,
  // LLM types
  LLMEvent,
  LLMEventCallback,
  LLMModelInfo,
  LLMModelStatus,
  LLMModelVariant,
  MarkdownOptions,
  MarkdownResult,
  TurndownRule,
} from "./types.js";
import { fetchUrl, isValidUrl } from "./utils/url-fetcher.js";
import { hasContent as hasContentUtil } from "./utils/validators.js";

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

  // Use async path to enable Readability content extraction
  // sync path doesn't support content extraction
  return parser.convertAsync(inputHtml, convertOptions);
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

export {
  createLLMConverter,
  LLMConverter,
} from "./converters/llm-converter.js";
// Re-export LLM classes for advanced usage
export { LLMManager } from "./converters/llm-manager.js";

// Re-export config utilities
export {
  findConfigPath,
  type GetMdConfig,
  loadConfig,
  loadConfigFromFile,
  mergeConfigWithOptions,
} from "./utils/config-loader.js";

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
