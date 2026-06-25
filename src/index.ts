// src/index.ts

import { MarkdownParser } from "./parsers/markdown-parser.js";
import {
  checkLLMModel,
  downloadLLMModel,
  getLLMModelInfo,
  removeLLMModel,
} from "./converters/llm-manager.js";
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
import { estimateTokens } from "./utils/tokens.js";
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

  // When the caller signals "markdown" input, skip HTML parsing entirely.
  // We still run metadata extraction, frontmatter generation, and
  // post-processing so markdown files benefit from the same optimization
  // pipeline as HTML→Markdown conversions — without unnecessary HTML
  // parsing overhead.
  if (options?.inputType === "markdown") {
    return await convertMarkdownInput(inputHtml, convertOptions);
  }

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
 * Extract metadata from a markdown document using heuristics (no HTML parsing).
 * Extracts: title from first H1, excerpt from first paragraph, language from
 * code blocks, word count, reading time.
 */
function extractMarkdownMetadata(markdown: string): ContentMetadata {
  const metadata: ContentMetadata = {};

  // Title: first H1 heading
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Excerpt: first non-empty paragraph that isn't a heading or code block
  const lines = markdown.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 20 &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("```") &&
      !trimmed.startsWith("|") &&
      !trimmed.startsWith("- ") &&
      !trimmed.startsWith("* ") &&
      !/^\d+\.\s/.test(trimmed)
    ) {
      metadata.excerpt = trimmed.slice(0, 200);
      break;
    }
  }

  // Word count and reading time
  const { wordCount, readingTime } = calculateMarkdownWordStats(markdown);
  metadata.wordCount = wordCount;
  metadata.readingTime = readingTime;

  return metadata;
}

/**
 * Calculate word count and reading time from markdown content.
 * Strips code blocks, URLs, and link syntax for accurate word counts.
 */
function calculateMarkdownWordStats(markdown: string): {
  wordCount: number;
  readingTime: number;
} {
  let contentOnly = markdown;

  // Remove frontmatter if present
  if (contentOnly.startsWith("---")) {
    const frontmatterEnd = contentOnly.indexOf("---", 3);
    if (frontmatterEnd !== -1) {
      contentOnly = contentOnly.substring(frontmatterEnd + 3).trim();
    }
  }

  // Remove code blocks
  contentOnly = contentOnly.replace(/```[\s\S]*?```/g, "");
  // Remove inline code
  contentOnly = contentOnly.replace(/`[^`]+`/g, "");
  // Remove URLs
  contentOnly = contentOnly.replace(/https?:\/\/[^\s)]+/g, "");
  // Remove markdown link syntax but keep the text
  contentOnly = contentOnly.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove image syntax
  contentOnly = contentOnly.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  const words = contentOnly
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const wordCount = words.length;
  const readingTime = Math.ceil(wordCount / 250);

  return { wordCount, readingTime };
}

/**
 * Process an existing Markdown file through get-md's optimization pipeline:
 * metadata extraction, frontmatter generation, structure normalization, and
 * truncation. Skips HTML parsing entirely — the input is already markdown.
 */
async function convertMarkdownInput(
  markdown: string,
  options: MarkdownOptions,
): Promise<MarkdownResult> {
  const startTime = Date.now();

  const metadata = extractMarkdownMetadata(markdown);
  const { wordCount, readingTime } = calculateMarkdownWordStats(markdown);
  metadata.wordCount = wordCount;
  metadata.readingTime = readingTime;

  // Reuse the post-processing logic from MarkdownParser for consistency
  const parser = new MarkdownParser();
  let output = parser.postProcessMarkdownInput(markdown);

  // Add frontmatter if requested and metadata is non-empty
  if (options.includeMeta && Object.keys(metadata).length > 0) {
    output = parser.addMarkdownFrontmatter(output, metadata);
  }

  // Enforce max-length truncation
  const maxLength = options.maxLength ?? 1000000;
  if (output.length > maxLength) {
    output = `${output.substring(0, maxLength)}\n\n[Content truncated]`;
  }

  const processingTime = Date.now() - startTime;

  return {
    markdown: output,
    metadata,
    stats: {
      inputLength: markdown.length,
      outputLength: output.length,
      processingTime,
      readabilitySuccess: false,
      imageCount: 0,
      linkCount: 0,
      estimatedTokens: estimateTokens(output),
    },
  };
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
// Re-export DOCX converter
export {
  convertDocxToHtml,
  convertDocxToMarkdown,
} from "./converters/docx-converter.js";
