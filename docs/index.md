# get-md Documentation

A fast, lightweight HTML to Markdown converter optimized for LLM consumption. Uses proven parsing libraries to deliver clean, well-structured markdown with intelligent content extraction and noise filtering.

## Features

- **Lightning-fast**: Converts HTML to Markdown in <100ms
- **Intelligent extraction**: Uses Mozilla Readability to extract main content
- **LLM-optimized**: Consistent formatting perfect for AI consumption
- **Optional AI conversion**: Higher quality output with local ReaderLM-v2 model
- **CLI included**: Use from the command line or as a library
- **TypeScript**: Full type definitions included
- **Zero downloads**: Works instantly (AI model optional, ~1GB)
- **Lightweight**: Small package size (~10MB)
- **React Native compatible**: Full support including content extraction

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

// From URL (auto-detected)
const result = await convertToMarkdown("https://example.com");
console.log(result.metadata.title);
```

### As a CLI

```bash
# From stdin
echo '<h1>Hello</h1>' | getmd

# From URL
getmd https://example.com

# Save to file
getmd input.html -o output.md
```

## Documentation

- [API Reference](api.md) - Full API documentation for `convertToMarkdown()`
- [CLI Usage](cli.md) - Command-line interface options and examples
- [LLM-Powered Conversion](llm.md) - Using the optional AI model for higher quality output
- [React Native Support](react-native.md) - Using get-md in React Native apps

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
