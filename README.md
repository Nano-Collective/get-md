# get-md

A fast, lightweight HTML to Markdown converter optimized for LLM consumption. Uses proven parsing libraries to deliver clean, well-structured markdown with intelligent content extraction and noise filtering.

## Features

- **Lightning-fast**: Converts HTML to Markdown in <100ms
- **Intelligent extraction**: Uses Mozilla Readability to extract main content
- **LLM-optimized**: Consistent formatting perfect for AI consumption
- **CLI included**: Use from the command line or as a library
- **TypeScript**: Full type definitions included
- **Zero downloads**: No models to download, works instantly
- **Lightweight**: Small package size (~10MB)

## Installation

```bash
npm install @nanocollective/get-md
# or
pnpm add @nanocollective/get-md
# or
yarn add @nanocollective/get-md
```

## Quick Start

### As a Library

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

// From HTML string
const result = await convertToMarkdown("<h1>Hello</h1><p>World</p>");
console.log(result.markdown);
// # Hello
//
// World

// From URL (auto-detected)
const result = await convertToMarkdown("https://example.com");
console.log(result.metadata.title);

// From URL with custom timeout and headers
const result = await convertToMarkdown("https://example.com", {
  timeout: 10000,
  headers: { Authorization: "Bearer token" },
});

// Force URL mode if auto-detection fails
const result = await convertToMarkdown("example.com", { isUrl: true });
```

### As a CLI

```bash
# From stdin
echo '<h1>Hello</h1>' | getmd

# From file
getmd input.html

# From URL
getmd https://example.com

# Save to file
getmd input.html -o output.md
```

## API

### `convertToMarkdown(html, options?)`

Convert HTML to clean, LLM-optimized Markdown.

**Parameters:**

- `html` (string): Raw HTML string or URL to fetch
- `options` (MarkdownOptions): Conversion options

**Returns:** `Promise<MarkdownResult>`

**Options:**

````typescript
{
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
}
```

## CLI Usage

```bash
getmd [input] [options]

Options:
  -o, --output <file>       Output file (default: stdout)
  --no-extract              Disable Readability content extraction
  --no-frontmatter          Exclude metadata from YAML frontmatter
  --no-images               Remove images from output
  --no-links                Remove links from output
  --no-tables               Remove tables from output
  --max-length <n>          Maximum output length (default: 1000000)
  --base-url <url>          Base URL for resolving relative links
  -v, --verbose             Verbose output
  -h, --help                Display help
````

## Examples

### Basic Conversion

```typescript
import { convertToMarkdown } from "@nanocollective/getmd";

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

### CLI Examples

```bash
# Convert HTML file (frontmatter included by default)
getmd article.html -o article.md

# Fetch from URL
getmd https://blog.example.com/post -o post.md

# Remove images and links
getmd article.html --no-images --no-links -o clean.md

# Exclude frontmatter metadata
getmd article.html --no-frontmatter -o clean.md
```

## Why get-md?

### For LLMs

- **Consistent output**: Deterministic markdown formatting helps LLMs learn patterns
- **Clean structure**: Proper heading hierarchy, list formatting, and spacing
- **Noise removal**: Automatically removes ads, navigation, footers, etc.
- **Fast processing**: <100ms per document enables real-time workflows

### vs Other Tools

- **Faster than LLM-based extractors**: No model inference overhead
- **More reliable**: Deterministic output, no hallucinations
- **Cheaper**: No API costs
- **Privacy-friendly**: Runs locally, no data sent to third parties

## Community

We're a small community-led team building local and privacy-first AI solutions under the [Nano Collective](https://nanocollective.org) and would love your help! Whether you're interested in contributing code, documentation, or just being part of our community, there are several ways to get involved.

**If you want to contribute to the code:**

- Read our detailed [CONTRIBUTING.md](CONTRIBUTING.md) guide for information on development setup, coding standards, and how to submit your changes.

**If you want to be part of our community or help with other aspects like design or marketing:**

- Join our Discord server to connect with other users, ask questions, share ideas, and get help: [Join our Discord server](https://discord.gg/ktPDV6rekE)

- Head to our GitHub issues or discussions to open and join current conversations with others in the community.
