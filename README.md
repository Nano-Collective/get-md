# get-md

[![npm version](https://img.shields.io/npm/v/@nanocollective/get-md.svg)](https://www.npmjs.com/package/@nanocollective/get-md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A fast, lightweight HTML to Markdown converter optimized for LLM consumption. Uses proven parsing libraries to deliver clean, well-structured markdown with intelligent content extraction and noise filtering.

## Features

- ⚡ **Lightning-fast**: Converts HTML to Markdown in <100ms
- 🎯 **Intelligent extraction**: Uses Mozilla Readability to extract main content
- 🤖 **LLM-optimized**: Consistent formatting perfect for AI consumption
- 📊 **Schema-based extraction**: Extract structured JSON from HTML
- 💻 **CLI included**: Use from the command line or as a library
- 🔧 **TypeScript**: Full type definitions included
- 🚀 **Zero downloads**: No models to download, works instantly
- 📦 **Lightweight**: Small package size (~10MB)

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
import { convertToMarkdown } from '@nanocollective/get-md';

// From HTML string
const result = await convertToMarkdown('<h1>Hello</h1><p>World</p>');
console.log(result.markdown);
// # Hello
//
// World

// From URL
const result = await convertToMarkdown('https://example.com');
console.log(result.metadata.title);

// With options
const result = await convertToMarkdown(html, {
  llmOptimized: true,
  extractContent: true,
  includeMeta: true,
  includeImages: true,
});
```

### As a CLI

```bash
# From stdin
echo '<h1>Hello</h1>' | get-md

# From file
get-md input.html

# From URL
get-md https://example.com

# Save to file
get-md input.html -o output.md

# With frontmatter
get-md input.html --frontmatter

# Extract only metadata
get-md meta input.html
```

## API

### `convertToMarkdown(html, options?)`

Convert HTML to clean, LLM-optimized Markdown.

**Parameters:**
- `html` (string): Raw HTML string or URL to fetch
- `options` (MarkdownOptions): Conversion options

**Returns:** `Promise<MarkdownResult>`

**Options:**
```typescript
{
  extractContent?: boolean;      // Use Readability extraction (default: true)
  llmOptimized?: boolean;         // LLM-specific formatting (default: true)
  includeMeta?: boolean;          // Include YAML frontmatter (default: false)
  includeImages?: boolean;        // Include images (default: true)
  includeLinks?: boolean;         // Include links (default: true)
  includeTables?: boolean;        // Include tables (default: true)
  aggressiveCleanup?: boolean;    // Remove ads, nav, etc. (default: true)
  maxLength?: number;             // Max output length (default: 1000000)
  baseUrl?: string;               // Base URL for relative links
}
```

### `convertToJSON(html, schema, options?)`

Extract structured JSON from HTML using a JSON Schema.

```typescript
import { convertToJSON } from '@nanocollective/get-md';

const schema = {
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      author: { type: 'string' },
      date: { type: 'string' }
    },
    required: ['title']
  }
};

const result = await convertToJSON(html, schema);
console.log(result.data);
```

### `extractMetadata(html)`

Extract only metadata without full conversion.

```typescript
import { extractMetadata } from '@nanocollective/get-md';

const meta = await extractMetadata(html);
console.log(meta.title, meta.author, meta.readingTime);
```

### `fetchAndConvert(url, options?)`

Fetch HTML from a URL and convert to markdown in one step.

```typescript
import { fetchAndConvert } from '@nanocollective/get-md';

const result = await fetchAndConvert('https://example.com', {
  timeout: 10000,
  llmOptimized: true
});
```

## CLI Usage

```bash
get-md [input] [options]

Options:
  -o, --output <file>       Output file (default: stdout)
  -j, --json <schema>       Extract JSON using schema file
  --no-extract              Disable Readability content extraction
  --no-llm-optimize         Disable LLM-specific formatting
  --frontmatter             Include metadata as YAML frontmatter
  --no-images               Remove images from output
  --no-links                Remove links from output
  --no-tables               Remove tables from output
  --max-length <n>          Maximum output length (default: 1000000)
  --base-url <url>          Base URL for resolving relative links
  --partial                 Return partial results on validation errors
  -v, --verbose             Verbose output
  -h, --help                Display help

Commands:
  meta <input>              Extract only metadata from HTML
```

## Examples

### Basic Conversion

```typescript
import { convertToMarkdown } from '@nanocollective/get-md';

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
const result = await convertToMarkdown(html, { includeMeta: true });
console.log(result.markdown);
// ---
// title: "My Article"
// author: "John Doe"
// readingTime: 5
// ---
//
// # My Article
// ...
```

### JSON Extraction

```typescript
import { convertToJSON } from '@nanocollective/get-md';

const schema = {
  schema: {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price: { type: 'number' }
          }
        }
      }
    }
  }
};

const result = await convertToJSON(html, schema);
console.log(result.data.products);
```

### CLI Examples

```bash
# Convert with frontmatter
get-md article.html --frontmatter -o article.md

# Extract JSON
get-md products.html -j schema.json -o products.json

# Fetch from URL (LLM optimization is enabled by default)
get-md https://blog.example.com/post -o post.md

# Get metadata only
get-md meta https://example.com --json
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

## Technical Details

- **Parser**: Cheerio (fast, jQuery-like DOM manipulation)
- **Cleaner**: @mozilla/readability (Firefox reader mode algorithm)
- **Converter**: Turndown (HTML to Markdown with custom rules)
- **Validator**: Ajv (JSON Schema validation)
- **Language**: TypeScript with ESM support
- **Node**: >=18

## License

MIT © 2024 Nano Collective

## Contributing

Contributions are welcome! Please check out our [GitHub repository](https://github.com/nano-collective/get-md).

## Support

- [Issues](https://github.com/nano-collective/get-md/issues)
- [Discussions](https://github.com/nano-collective/get-md/discussions)
