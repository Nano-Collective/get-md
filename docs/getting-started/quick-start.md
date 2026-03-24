---
title: "Quick Start"
description: "Convert your first HTML page to Markdown with get-md"
sidebar_order: 2
---

# Quick Start

This guide walks you through the basics: converting HTML to Markdown using the library and the CLI.

## 1. Install get-md

```bash
npm install @nanocollective/get-md
```

## 2. Convert HTML with the Library

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

// From a URL (auto-detected)
const result = await convertToMarkdown("https://example.com");
console.log(result.markdown);
console.log(result.metadata.title);
```

The result includes clean Markdown with YAML frontmatter metadata, plus extraction stats.

## 3. Convert HTML from a String

```typescript
const html = `
  <article>
    <h1>My Article</h1>
    <p>This is a <strong>test</strong>.</p>
  </article>
`;

const result = await convertToMarkdown(html);
console.log(result.markdown);
```

## 4. Use the CLI

```bash
# From a URL
getmd https://example.com -o output.md

# From a file
getmd article.html -o article.md

# From stdin
echo '<h1>Hello</h1>' | getmd
```

## 5. Try LLM-Powered Conversion (Optional)

For higher quality output, use the optional local LLM model:

```bash
# Download the model (one-time, ~1GB)
getmd --download-model

# Convert with LLM
getmd https://example.com --use-llm -o output.md
```

> **Tip:** LLM conversion produces better structure for complex pages but takes 5-10 seconds. Use standard conversion for batch processing and real-time workflows.

See the [LLM Conversion](../guides/llm-conversion.md) guide for details.

## Next Steps

- [API Reference](../api/index.md) — Full library API reference with all options
- [CLI](../cli/index.md) — Complete command-line interface reference
- [LLM Conversion](../guides/llm-conversion.md) — AI-powered conversion guide
- [Configuration](../configuration/index.md) — Config files and default options
