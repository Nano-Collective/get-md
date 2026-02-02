# API Reference

## `convertToMarkdown(html, options?)`

Convert HTML to clean, LLM-optimized Markdown.

### Parameters

- `html` (string): Raw HTML string or URL to fetch
- `options` (MarkdownOptions): Conversion options (optional)

### Returns

`Promise<MarkdownResult>`

```typescript
interface MarkdownResult {
  markdown: string;
  metadata: {
    title?: string;
    author?: string;
    readingTime?: number;
    // ... additional metadata fields
  };
}
```

### Options

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

  // URL fetch options (only used when input is a URL)
  isUrl?: boolean;                // Force treat input as URL (default: auto-detect)
  timeout?: number;               // Request timeout in ms (default: 15000)
  followRedirects?: boolean;      // Follow redirects (default: true)
  maxRedirects?: number;          // Max redirects to follow (default: 5)
  headers?: Record<string, string>; // Custom HTTP headers
  userAgent?: string;             // Custom user agent

  // LLM options (see llm.md for details)
  useLLM?: boolean;               // Use LLM for conversion (default: false)
  llmModelPath?: string;          // Custom model path (optional)
  llmTemperature?: number;        // Generation temperature (default: 0.1)
  llmMaxTokens?: number;          // Max tokens (default: 512000)
  llmFallback?: boolean;          // Fallback to Turndown on error (default: true)

  // Event callbacks
  onLLMEvent?: (event: LLMEvent) => void;
  onDownloadProgress?: (downloaded: number, total: number, percentage: number) => void;
  onModelStatus?: (status: ModelStatus) => void;
  onConversionProgress?: (progress: ConversionProgress) => void;
}
```

### Option Details

#### Content Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extractContent` | boolean | `true` | Use Mozilla Readability to extract the main content from the page, removing navigation, sidebars, and other noise |
| `includeMeta` | boolean | `true` | Include extracted metadata as YAML frontmatter at the top of the markdown |
| `includeImages` | boolean | `true` | Include image references in the output |
| `includeLinks` | boolean | `true` | Include hyperlinks in the output |
| `includeTables` | boolean | `true` | Include tables in the output |
| `aggressiveCleanup` | boolean | `true` | Apply aggressive cleanup to remove ads, cookie notices, and other non-content elements |
| `maxLength` | number | `1000000` | Maximum character length of the output markdown |
| `baseUrl` | string | - | Base URL for resolving relative links in the HTML |

#### URL Fetch Options

These options only apply when the input is a URL:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `isUrl` | boolean | auto-detect | Force the input to be treated as a URL |
| `timeout` | number | `15000` | Request timeout in milliseconds |
| `followRedirects` | boolean | `true` | Whether to follow HTTP redirects |
| `maxRedirects` | number | `5` | Maximum number of redirects to follow |
| `headers` | object | - | Custom HTTP headers to send with the request |
| `userAgent` | string | - | Custom User-Agent header |

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
// Metadata is included by default
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

// Force URL mode if auto-detection fails
const result = await convertToMarkdown("example.com", { isUrl: true });
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
