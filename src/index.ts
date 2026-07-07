// src/index.ts

import {
  checkLLMModel,
  downloadLLMModel,
  getLLMModelInfo,
  removeLLMModel,
} from "./converters/llm-manager.js";
import type { PdfMetadata } from "./extractors/pdf-extractor.js";
import { MarkdownParser } from "./parsers/markdown-parser.js";
import type {
  BatchOptions,
  BatchProgress,
  BatchResult,
  ContentMetadata,
  ContentSource,
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
import { escapeHtml } from "./utils/escape.js";
import { estimateTokens } from "./utils/tokens.js";
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
 *
 * // Process a PDF file using a Buffer
 * import { promises as fs } from "fs";
 * const pdfBuffer = await fs.readFile("handbook.pdf");
 * const pdfResult = await convertToMarkdown(pdfBuffer);
 * ```
 */
export async function convertToMarkdown(
  input: string | Buffer | ContentSource,
  options?: MarkdownOptions,
): Promise<MarkdownResult> {
  let contentSource: ContentSource;
  let baseUrl = options?.baseUrl;
  let inputHtml = "";
  // When the source is a binary document (PDF), we synthesize HTML from
  // extracted text. Readability must NOT run on that — it would strip content
  // it scores as boilerplate (page headers, footnotes, short lines). We force
  // extraction off for those paths, mirroring the DOCX converter.
  let forceExtractContentOff = false;

  if (Buffer.isBuffer(input)) {
    const buffer = Buffer.from(input);
    if (buffer.subarray(0, 4).toString() === "%PDF") {
      const { extractPdf, reconstructPdfHtml } = await import(
        "./extractors/pdf-extractor.js"
      );
      const {
        text: pdfText,
        pages: pdfPages,
        metadata: pdfMeta,
      } = await extractPdf(buffer);
      if (!pdfText.trim()) {
        return emptyPdfResult(buffer.length);
      }
      inputHtml = buildPdfHtml(reconstructPdfHtml(pdfPages), pdfMeta);
      forceExtractContentOff = true;
    } else if (buffer.subarray(0, 2).toString("latin1") === "PK") {
      // ZIP-based Office Open XML (.docx). Route to the dedicated converter,
      // which extracts the OOXML and feeds it back through this pipeline.
      const { convertDocxToMarkdown } = await import(
        "./converters/docx-converter.js"
      );
      return await convertDocxToMarkdown(buffer, options);
    } else {
      throw new Error(
        "Unsupported binary format: expected a PDF (%PDF) or DOCX (ZIP) buffer.",
      );
    }
    contentSource = { type: "html", content: inputHtml };
  } else if (typeof input === "string") {
    inputHtml = input;
    if (options?.isUrl || isValidUrl(input)) {
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

      if (input.toLowerCase().endsWith(".pdf")) {
        const { fetchUrlBuffer } = await import("./utils/url-fetcher.js");
        const buffer = await fetchUrlBuffer(input, fetchOptions);
        const { extractPdf, reconstructPdfHtml } = await import(
          "./extractors/pdf-extractor.js"
        );
        const {
          text: pdfText,
          pages: pdfPages,
          metadata: pdfMeta,
        } = await extractPdf(buffer);
        if (!pdfText.trim()) {
          return emptyPdfResult(buffer.length);
        }
        inputHtml = buildPdfHtml(reconstructPdfHtml(pdfPages), pdfMeta);
        forceExtractContentOff = true;
      } else {
        inputHtml = await fetchUrl(input, fetchOptions);
      }
      baseUrl = baseUrl || input;
    }
    contentSource = { type: "html", content: inputHtml };
  } else {
    // ContentSource: honor a `markdown` type by routing to the markdown
    // pipeline (the same behavior as the `inputType: "markdown"` option).
    if (input.type === "markdown") {
      return await convertMarkdownInput(input.content, { ...options, baseUrl });
    }
    contentSource = input;
    inputHtml = input.content;
  }

  const parser = new MarkdownParser();
  const convertOptions = { ...options, baseUrl };
  if (forceExtractContentOff) {
    convertOptions.extractContent = false;
  }

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
  const result = await parser.convertAsync(contentSource, convertOptions);

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
 * Split a markdown document into its leading YAML frontmatter (the raw inner
 * lines, without the `---` fences) and the remaining body. Returns
 * `frontmatter: null` when the document has no frontmatter block.
 */
function splitFrontmatter(markdown: string): {
  frontmatter: string | null;
  body: string;
} {
  if (!markdown.startsWith("---")) return { frontmatter: null, body: markdown };
  // Require an opening `---` on its own line and a matching closing `---`.
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: null, body: markdown };
  return { frontmatter: match[1], body: markdown.slice(match[0].length) };
}

/** Parse `key: value` lines from a raw frontmatter block into a Map. */
function parseFrontmatterKeys(frontmatter: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of frontmatter.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

/** Strip surrounding YAML quotes from a scalar value. */
function stripYamlQuotes(value: string): string {
  const t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  return t;
}

/**
 * Extract metadata from a markdown document using heuristics (no HTML parsing).
 * When the source already has frontmatter, its `title`/`author`/`excerpt`
 * (or `description`) win over the body heuristics — so a real title in the
 * frontmatter isn't clobbered by the first H1. Word count and reading time are
 * always computed from the body.
 */
function extractMarkdownMetadata(
  body: string,
  existing?: Map<string, string>,
): ContentMetadata {
  const metadata: ContentMetadata = {};

  // Title: existing frontmatter wins, else first H1 heading.
  const existingTitle = existing?.get("title");
  if (existingTitle) {
    metadata.title = stripYamlQuotes(existingTitle);
  } else {
    const titleMatch = body.match(/^#\s+(.+)$/m);
    if (titleMatch) metadata.title = titleMatch[1].trim();
  }

  // Author: only from existing frontmatter (no reliable body heuristic).
  const existingAuthor = existing?.get("author");
  if (existingAuthor) metadata.author = stripYamlQuotes(existingAuthor);

  // Excerpt: existing frontmatter description/excerpt wins, else first body
  // paragraph that isn't a heading, list, table, or code block.
  const existingExcerpt =
    existing?.get("excerpt") ?? existing?.get("description");
  if (existingExcerpt) {
    metadata.excerpt = stripYamlQuotes(existingExcerpt);
  } else {
    for (const line of body.split("\n")) {
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
  }

  // Word count and reading time (from the body only).
  const { wordCount, readingTime } = calculateMarkdownWordStats(body);
  metadata.wordCount = wordCount;
  metadata.readingTime = readingTime;

  return metadata;
}

/**
 * Strip links/images/tables from markdown body text when the caller disabled
 * them (`includeLinks/includeImages/includeTables: false`), mirroring the
 * HTML pipeline's content filters. Fenced code blocks are left untouched.
 */
function filterMarkdownContent(
  markdown: string,
  options: MarkdownOptions,
): string {
  const stripLinks = options.includeLinks === false;
  const stripImages = options.includeImages === false;
  const stripTables = options.includeTables === false;
  if (!stripLinks && !stripImages && !stripTables) return markdown;

  // Split on fenced code blocks so we never rewrite code. Odd-index segments
  // are the fenced blocks themselves.
  const segments = markdown.split(/(```[\s\S]*?```)/g);
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) return seg;
      let s = seg;
      // Images before links: image syntax is a superset of link syntax.
      if (stripImages) s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
      if (stripLinks) s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
      if (stripTables) s = stripMarkdownTables(s);
      return s;
    })
    .join("");
}

/** Remove GFM table blocks (header + separator + rows) from markdown text. */
function stripMarkdownTables(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSeparator = (l: string) =>
    /\|/.test(l) && /-/.test(l) && /^\s*\|?[\s:|-]+\|?\s*$/.test(l);
  for (let i = 0; i < lines.length; i++) {
    if (isRow(lines[i]) && isSeparator(lines[i + 1] ?? "")) {
      // Skip the separator, then any contiguous body rows.
      i++;
      while (i + 1 < lines.length && isRow(lines[i + 1])) i++;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join("\n");
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

  // Separate any existing frontmatter from the body so we (a) don't emit a
  // second stacked block, and (b) prefer the author's real title/author.
  const { frontmatter, body } = splitFrontmatter(markdown);
  const existingKeys = frontmatter
    ? parseFrontmatterKeys(frontmatter)
    : undefined;

  const metadata = extractMarkdownMetadata(body, existingKeys);

  // Honor the content filters (--no-links/--no-images/--no-tables) on the body.
  const filteredBody = filterMarkdownContent(body, options);

  // Reuse the post-processing logic from MarkdownParser for consistency.
  const parser = new MarkdownParser();
  let output = parser.postProcessMarkdownInput(filteredBody);

  // Frontmatter handling. Default to including it (matches the HTML path).
  const includeMeta = options.includeMeta ?? true;
  if (includeMeta) {
    if (frontmatter) {
      // Preserve the user's frontmatter; append computed stats keys that
      // aren't already present instead of stacking a second block.
      output = mergeMarkdownFrontmatter(frontmatter, metadata, output);
    } else if (Object.keys(metadata).length > 0) {
      output = parser.addMarkdownFrontmatter(output, metadata);
    }
  }
  // When includeMeta is false, any existing frontmatter has already been
  // dropped (we post-process the body only), so there's nothing to strip.

  // Optional image localization (parity with the HTML path).
  if (options.downloadImages && options.includeImages !== false) {
    const { localizeImages } = await import("./optimizers/image-localizer.js");
    const localized = await localizeImages(output, {
      outDir: options.downloadImages,
      userAgent: options.userAgent,
      timeout: options.timeout,
      outputPath: options.outputPath,
      baseUrl: options.baseUrl,
    });
    output = localized.markdown;
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
 * Merge computed stats (wordCount/readingTime) into an existing frontmatter
 * block without overwriting the author's values or stacking a second block.
 */
function mergeMarkdownFrontmatter(
  frontmatter: string,
  metadata: ContentMetadata,
  body: string,
): string {
  const keys = parseFrontmatterKeys(frontmatter);
  const additions: string[] = [];
  if (!keys.has("wordCount") && metadata.wordCount !== undefined) {
    additions.push(`wordCount: ${metadata.wordCount}`);
  }
  if (!keys.has("readingTime") && metadata.readingTime !== undefined) {
    additions.push(`readingTime: ${metadata.readingTime}`);
  }
  const inner = frontmatter.replace(/\s+$/, "");
  const block = additions.length ? `${inner}\n${additions.join("\n")}` : inner;
  return `---\n${block}\n---\n\n${body}`;
}

/**
 * Wrap a reconstructed PDF HTML body in a document, carrying the PDF's
 * info-dict metadata (title/author/date) into `<head>` so the metadata
 * extractor and frontmatter pick it up. The body is produced by
 * `reconstructPdfHtml` (headings/lists/paragraphs, already escaped).
 */
function buildPdfHtml(body: string, metadata: PdfMetadata): string {
  const head: string[] = [];
  if (metadata.title) {
    head.push(`<title>${escapeHtml(metadata.title)}</title>`);
  }
  if (metadata.author) {
    head.push(
      `<meta name="author" content="${escapeHtml(metadata.author)}" />`,
    );
  }
  if (metadata.publishedTime) {
    head.push(
      `<meta property="article:published_time" content="${escapeHtml(metadata.publishedTime)}" />`,
    );
  }
  return `<html><head>${head.join("")}</head><body>${body}</body></html>`;
}

/** Empty result for a PDF that yielded no extractable text (e.g. scanned). */
function emptyPdfResult(inputLength: number): MarkdownResult {
  return {
    markdown: "",
    metadata: {},
    stats: {
      inputLength,
      outputLength: 0,
      processingTime: 0,
      readabilitySuccess: false,
      imageCount: 0,
      linkCount: 0,
      estimatedTokens: 0,
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
// Re-export DOCX converter
export {
  convertDocxToHtml,
  convertDocxToMarkdown,
} from "./converters/docx-converter.js";
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
  ContentSource,
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
