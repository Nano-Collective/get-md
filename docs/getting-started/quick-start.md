---
title: "Quick Start"
description: "Convert your first HTML page to Markdown with get-md"
sidebar_order: 2
---

# Quick Start

This guide walks you through the basics: converting HTML, PDF, DOCX, and Markdown to clean Markdown using the library and the CLI.

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

## 4. Convert a PDF, DOCX, or Markdown File

Pass a `Buffer` and get-md auto-detects PDF vs. DOCX from its magic bytes. For
existing Markdown, set `inputType: "markdown"`:

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";
import { promises as fs } from "fs";

// PDF — title/author flow into the frontmatter; text is reflowed into structure
const pdf = await convertToMarkdown(await fs.readFile("handbook.pdf"));

// DOCX
const docx = await convertToMarkdown(await fs.readFile("report.docx"));

// Existing Markdown — skips HTML parsing, just optimizes
const md = await convertToMarkdown(await fs.readFile("notes.md", "utf-8"), {
  inputType: "markdown",
});
```

## 5. Use the CLI

```bash
# From a URL
getmd https://example.com -o output.md

# From a file — the type is detected from the extension
getmd article.html -o article.md
getmd handbook.pdf -o handbook.md
getmd document.docx -o document.md
getmd notes.md -o notes.clean.md

# From stdin (HTML, or a PDF via its magic bytes)
echo '<h1>Hello</h1>' | getmd
```

## 6. Try LLM-Powered Conversion (Optional)

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
