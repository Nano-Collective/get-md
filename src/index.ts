// src/index.ts

import {
  checkLLMModel,
  downloadLLMModel,
  getLLMModelInfo,
  removeLLMModel,
} from "./converters/llm-manager.js";
import { MarkdownParser } from "./parsers/markdown-parser.js";
import type {
  BatchOptions,
  BatchProgress,
  BatchResult,
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
  LlmConfig,
  LocalLlamaConfig,
  MarkdownOptions,
  MarkdownResult,
  RemoteLlmConfig,
  SdkProvider,
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
      maxBytes: options?.maxBytes,
      retries: options?.retries,
      retryDelay: options?.retryDelay,
      cache: options?.cache,
      cacheMaxAge: options?.cacheMaxAge,
    };

    // Fetch HTML from URL
    inputHtml = await fetchUrl(html, fetchOptions);
    baseUrl = baseUrl || html;
  }

  const parser = new MarkdownParser();
  const convertOptions = { ...options, baseUrl };

  // Use async path to enable Readability content extraction
  // sync path doesn't support content extraction
  const result = await parser.convertAsync(inputHtml, convertOptions);

  // Optional post-processing: download every referenced image into a local
  // directory and rewrite the src. Per-image failures are logged inside,
  // not thrown — the markdown still comes back useful.
  if (options?.downloadImages) {
    const { localizeImages } = await import("./optimizers/image-localizer.js");
    const localized = await localizeImages(result.markdown, {
      outDir: options.downloadImages,
      userAgent: options.userAgent,
      timeout: options.timeout,
      outputPath: options.outputPath,
      // baseUrl flows through from the URL fetch (see above) so the
      // localizer can resolve relative image refs that survived our HTML
      // cleaner. Defense-in-depth: even if cleanHTML missed a relative ref,
      // we still produce an absolute URL we can fetch.
      baseUrl: baseUrl,
    });
    result.markdown = localized.markdown;
  }

  return result;
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

// Re-export batch helpers
export { convertBatch, convertBatchAll } from "./batch.js";
export {
  createLLMConverter,
  LLMConverter,
} from "./converters/llm-converter.js";
// Re-export LLM classes for advanced usage
export { LLMManager } from "./converters/llm-manager.js";
// Re-export sitemap helpers
export {
  convertSitemap,
  parseSitemap,
  parseSitemapXml,
  type SitemapOptions,
} from "./sitemap.js";
// Re-export chunking utility
export {
  type ChunkOptions,
  chunkMarkdown,
  type MarkdownChunk,
} from "./utils/chunker.js";
// Re-export config utilities
export {
  findConfigPath,
  type GetMdConfig,
  loadConfig,
  loadConfigFromFile,
  mergeConfigWithOptions,
} from "./utils/config-loader.js";
// Re-export token estimation utility
export { estimateTokens } from "./utils/tokens.js";
// Re-export types
export type {
  // Batch types
  BatchOptions,
  BatchProgress,
  BatchResult,
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
  // Pluggable LLM backend types
  LlmConfig,
  LocalLlamaConfig,
  // Core types
  MarkdownOptions,
  MarkdownResult,
  RemoteLlmConfig,
  SdkProvider,
  TurndownRule,
};
// Re-export LLM utility functions
export { checkLLMModel, downloadLLMModel, getLLMModelInfo, removeLLMModel };
