---
title: "Conversion API"
description: "API reference for converting documents to Markdown — convertToMarkdown(), MarkdownOptions, and MarkdownResult"
sidebar_order: 1
---

# Conversion API

The primary entry point for HTML/PDF/DOCX/Markdown/URL → Markdown conversion. Covers the `convertToMarkdown()` function, the full `MarkdownOptions` surface, and the `MarkdownResult` shape it returns.

## convertToMarkdown()

Convert documents (HTML, PDF, DOCX, Markdown) to clean, LLM-optimized Markdown.

### Usage

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";
import { promises as fs } from "fs";

// From an HTML string or a URL
const result = await convertToMarkdown(htmlOrUrl, options?);

// From a PDF Buffer (auto-detected via the %PDF magic bytes)
const pdf = await fs.readFile("handbook.pdf");
const pdfResult = await convertToMarkdown(pdf);

// From a DOCX Buffer (auto-detected via the ZIP/PK magic bytes)
const docx = await fs.readFile("report.docx");
const docxResult = await convertToMarkdown(docx);

// From an existing Markdown string (skips HTML parsing)
const mdResult = await convertToMarkdown(markdownText, { inputType: "markdown" });
```

### Parameters

- `input` (`string | Buffer | ContentSource`) — one of:
  - **string** — a raw HTML string, or a URL to fetch (auto-detected). With `inputType: "markdown"`, the string is treated as existing Markdown.
  - **Buffer** — a binary document, auto-detected by its magic bytes: `%PDF` → PDF, `PK` (ZIP) → DOCX. Any other binary throws `Unsupported binary format: expected a PDF (%PDF) or DOCX (ZIP) buffer.`
  - **ContentSource** — `{ type, content, metadata? }`. Use `{ type: "markdown", content }` to route through the Markdown pipeline, or `{ type: "html", content }` for HTML. (To convert real PDF/DOCX, pass a Buffer, not a ContentSource — a `ContentSource` `content` is always a string.)
- `options` (MarkdownOptions) — Conversion options (optional)

### Input format detection

| Input | Handled as |
|-------|-----------|
| HTML string, or URL (incl. `http(s)://…`) | HTML → Markdown (Readability + Turndown) |
| URL ending in `.pdf` | fetched as a buffer and parsed as PDF |
| Buffer starting with `%PDF` | PDF — text extracted, then reconstructed into headings/paragraphs/lists |
| Buffer starting with `PK` (ZIP) | DOCX — OOXML parsed to Markdown |
| string + `inputType: "markdown"`, or `ContentSource` `{ type: "markdown" }` | existing Markdown — HTML parsing skipped |

See [Working with PDF and DOCX](#working-with-pdf-and-docx) and [Markdown input](#markdown-input) below.

### Returns

`Promise<MarkdownResult>`

```typescript
interface MarkdownResult {
  markdown: string;
  metadata: {
    title?: string;
    author?: string;
    excerpt?: string;
    siteName?: string;
    publishedTime?: string;
    language?: string;
    canonicalUrl?: string;
    readingTime?: number;
    wordCount?: number;
  };
  stats: {
    inputLength: number;
    outputLength: number;
    processingTime: number;
    readabilitySuccess: boolean;
    imageCount: number;
    linkCount: number;
    estimatedTokens: number; // chars/4 heuristic; useful for LLM context budgeting
  };
}
```

## Options

```typescript
interface MarkdownOptions {
  // Content options
  extractContent?: boolean;       // Use Readability extraction (default: true)
  includeMeta?: boolean;          // Include YAML frontmatter (default: true)
  includeImages?: boolean;        // Include images (default: true)
  includeLinks?: boolean;         // Include links (default: true)
  includeTables?: boolean;        // Include tables (default: true)
  aggressiveCleanup?: boolean;    // Remove ads, nav, etc. (default: true)
  maxLength?: number;             // Max output length (default: 1000000)
  baseUrl?: string;               // Base URL for resolving relative links
  inputType?: "html" | "markdown"; // Treat a string input as existing Markdown (default: "html")

  // URL fetch options (only used when input is a URL)
  isUrl?: boolean;                // Force treat input as URL (default: auto-detect)
  timeout?: number;               // Request timeout in ms (default: 15000)
  followRedirects?: boolean;      // Follow redirects (default: true)
  maxRedirects?: number;          // Max redirects to follow (default: 5)
  headers?: Record<string, string>; // Custom HTTP headers
  userAgent?: string;             // Custom user agent

  // Image localization
  downloadImages?: string;        // Download images to this dir, rewrite refs
  outputPath?: string;            // Hint to the image rewriter — see Output Options

  // HTTP retry + cache
  maxBytes?: number;              // Max response size in bytes (default: 10MB)
  retries?: number;               // Transient-failure retries (default: 2)
  retryDelay?: number;            // Base retry delay in ms (default: 500)
  cache?: boolean | string;       // Enable file-system cache; true or custom dir
  cacheMaxAge?: number;           // Cache TTL in ms (default: 1h)

  // LLM options (see LLM Conversion guide for details)
  useLLM?: boolean;               // Use LLM for conversion (default: false)
  llm?: LlmConfig;                // Pluggable LLM backend — see Remote LLM Providers
  llmModelPath?: string;          // Custom model path (optional, local-llama only)
  llmTemperature?: number;        // Generation temperature (default: 0.1)
  llmMaxTokens?: number;          // Context window in tokens (default: 8192)
  llmFallback?: boolean;          // Fallback to Turndown on error (default: true)

  // Event callbacks
  onLLMEvent?: (event: LLMEvent) => void;
  onDownloadProgress?: (downloaded: number, total: number, percentage: number) => void;
  onModelStatus?: (status: ModelStatus) => void;
  onConversionProgress?: (progress: ConversionProgress) => void;
}
```

### Content Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extractContent` | boolean | `true` | Use Mozilla Readability to extract the main content, removing navigation, sidebars, and other noise |
| `includeMeta` | boolean | `true` | Include extracted metadata as YAML frontmatter at the top of the Markdown |
| `includeImages` | boolean | `true` | Include image references in the output |
| `includeLinks` | boolean | `true` | Include hyperlinks in the output |
| `includeTables` | boolean | `true` | Include tables in the output |
| `aggressiveCleanup` | boolean | `true` | Apply aggressive cleanup to remove ads, cookie notices, and other non-content elements |
| `maxLength` | number | `1000000` | Maximum character length of the output Markdown |
| `baseUrl` | string | — | Base URL for resolving relative links in the HTML |
| `inputType` | `"html" \| "markdown"` | `"html"` | When `"markdown"`, treats a string input as existing Markdown and skips HTML parsing — see [Markdown input](#markdown-input) |

### URL Fetch Options

These options only apply when the input is a URL:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `isUrl` | boolean | auto-detect | Force the input to be treated as a URL |
| `timeout` | number | `15000` | Request timeout in milliseconds |
| `followRedirects` | boolean | `true` | Whether to follow HTTP redirects |
| `maxRedirects` | number | `5` | Maximum number of redirects to follow |
| `headers` | object | — | Custom HTTP headers to send with the request |
| `userAgent` | string | — | Custom User-Agent header |
| `maxBytes` | number | `10485760` | Max response body size in bytes (10MB). Aborts the fetch if exceeded. |
| `retries` | number | `2` | Retry attempts on transient failures (5xx, 429, network errors). Exponential backoff with jitter; respects `Retry-After`. |
| `retryDelay` | number | `500` | Base delay in ms for the first retry |
| `cache` | boolean \| string | `false` | File-system cache: `true` for `~/.get-md/cache`, or a custom path. Cache hits skip the network entirely. |
| `cacheMaxAge` | number | `3600000` | Max age of a cached entry in milliseconds (1 hour) |

### Output Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `downloadImages` | string | — | Download referenced images to this directory and rewrite the markdown `src` to point at the local copies. Skips `data:` URLs and non-HTTP(S) schemes. Per-image failures are logged but don't fail the conversion. |
| `outputPath` | string | — | Where the markdown file itself will live. When set, the image localizer's default rewrite computes paths relative to `dirname(outputPath)` — so markdown at `./out/page.md` with images at `./out/assets/foo.png` correctly refers to `./assets/foo.png`. Only the dirname matters. |

### LLM Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useLLM` | boolean | `false` | Use the LLM model for conversion |
| `llm` | LlmConfig | — | Pluggable LLM backend block — picks the provider (local llama.cpp, OpenAI-compatible, Anthropic, Google). See [Remote LLM Providers](../guides/remote-llm.md) for the full schema. |
| `llmModelPath` | string | — | Legacy shorthand: custom GGUF path for the local-llama backend |
| `llmTemperature` | number | `0.1` | Generation temperature (lower = more deterministic) |
| `llmMaxTokens` | number | `8192` | LLM context window (input + generation), capped at 32768 on the local llama.cpp path |
| `llmFallback` | boolean | `true` | Fall back to Turndown if LLM conversion fails |

## Examples

### Basic Conversion

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

const html = `
  <article>
    <h1>My Article</h1>
    <p>This is a <strong>test</strong>.</p>
  </article>
`;

const result = await convertToMarkdown(html);
console.log(result.markdown);
```

### With Metadata

```typescript
const result = await convertToMarkdown(html);
console.log(result.markdown);
// ---
// title: "My Article"
// author: "John Doe"
// readingTime: 5
// ---
//
// # My Article
// ...

// To exclude metadata:
const resultNoMeta = await convertToMarkdown(html, { includeMeta: false });
```

### URL with Custom Options

```typescript
const result = await convertToMarkdown("https://example.com", {
  timeout: 10000,
  headers: { Authorization: "Bearer token" },
});
console.log(result.metadata.title);
```

### Content Filtering

```typescript
// Remove images and links for text-only output
const result = await convertToMarkdown(html, {
  includeImages: false,
  includeLinks: false,
});

// Disable content extraction to preserve full HTML structure
const result = await convertToMarkdown(html, {
  extractContent: false,
});
```

### LLM-Powered Conversion

```typescript
const result = await convertToMarkdown("https://example.com", {
  useLLM: true,
  onLLMEvent: (event) => {
    if (event.type === "conversion-complete") {
      console.log(`Done in ${event.duration}ms`);
    }
  },
});
```

## Working with PDF and DOCX

Pass a `Buffer` and get-md auto-detects the format from its magic bytes — no
option needed:

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";
import { promises as fs } from "fs";

// PDF
const pdf = await convertToMarkdown(await fs.readFile("handbook.pdf"));

// DOCX
const docx = await convertToMarkdown(await fs.readFile("report.docx"));
```

**PDF behavior:**

- Title, author, and creation date are pulled from the PDF's info dictionary
  into `result.metadata` (and the YAML frontmatter when `includeMeta` is on).
- Extracted text is reconstructed into structure: wrapped lines are reflowed
  into paragraphs, ALL-CAPS lines become headings, bullet/numbered lines become
  lists, and repeated running headers/footers are dropped.
- Readability extraction is forced off for PDFs (it would strip body text).
- A URL ending in `.pdf` is fetched as a buffer and parsed the same way:
  `await convertToMarkdown("https://example.com/handbook.pdf")`.
- A scanned or text-less PDF returns an empty `markdown` with a non-zero
  `stats.inputLength` — a signal that OCR would be needed.

**DOCX** is handled by the dedicated converter, which is also exported directly —
see [`convertDocxToMarkdown` / `convertDocxToHtml`](#convertdocxtomarkdown--convertdocxtohtml).

## Markdown input

When the input is already Markdown, set `inputType: "markdown"` (the CLI does
this automatically for `.md` / `.markdown` files). This skips HTML parsing and
runs only the optimization passes — metadata extraction, frontmatter, and
structure normalization:

```typescript
const result = await convertToMarkdown(markdownText, {
  inputType: "markdown",
  includeLinks: false,  // strip links
  includeTables: false, // strip tables
});
```

- `includeLinks`, `includeImages`, and `includeTables` are honored (links/
  images/tables are stripped from the Markdown when set to `false`).
- If the input already has YAML frontmatter, it's preserved — get-md keeps your
  `title`/`author` and only appends computed `wordCount`/`readingTime` rather
  than stacking a second block.
- Equivalent to passing a `ContentSource`: `convertToMarkdown({ type: "markdown", content: markdownText })`.

## convertDocxToMarkdown / convertDocxToHtml

Dedicated DOCX helpers, exported from the package root:

```typescript
import {
  convertDocxToMarkdown,
  convertDocxToHtml,
} from "@nanocollective/get-md";
import { promises as fs } from "fs";

const buffer = await fs.readFile("report.docx");

// DOCX → MarkdownResult (markdown + metadata + stats)
const result = await convertDocxToMarkdown(buffer, options?);

// DOCX → intermediate HTML (if you want to run your own pipeline)
const html = await convertDocxToHtml(buffer);
```

- `convertDocxToMarkdown(buffer, options?)` extracts the OOXML, converts it to
  clean HTML, and runs it through the standard pipeline (Readability is disabled
  — the DOCX HTML is already clean). Accepts the same `MarkdownOptions`.
- Supports headings, bold/italic/underline/strikethrough, ordered/unordered
  lists (resolved from `numbering.xml`), and tables. Embedded images are not yet
  extracted.
- `convertToMarkdown(docxBuffer)` is a convenience wrapper around this.

## See Also

- [Model Management](model-management.md) — LLM model management functions
- [CLI](../cli/index.md) — Command-line interface reference
- [LLM Conversion](../guides/llm-conversion.md) — When and how to use LLM conversion
