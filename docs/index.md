---
title: "Introduction"
description: "get-md is a fast, lightweight HTML to Markdown converter optimized for LLM consumption"
sidebar_order: 1
---

# get-md

get-md is a fast, lightweight HTML to Markdown converter optimized for LLM consumption. Pass in HTML or a URL and get clean, structured Markdown back — as a library or from the command line.

## What You Can Do

- **Convert HTML to Markdown** in under 100ms using Turndown and Mozilla Readability
- **Fetch and convert URLs** with automatic detection and configurable fetching
- **Extract metadata** including title, author, reading time, and more as YAML frontmatter
- **Use AI-powered conversion** with a local ReaderLM-v2 model for higher quality output
- **Filter content** by toggling images, links, tables, and noise removal

get-md works as both a Node.js library and a CLI tool, with full React Native support.

## How It Works

### As a Library

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

const result = await convertToMarkdown("https://example.com");
console.log(result.markdown);
```

### As a CLI

```bash
getmd https://example.com -o output.md
```

## Next Steps

- [Installation](getting-started/installation.md) — Requirements and setup
- [Quick Start](getting-started/quick-start.md) — Convert your first page
- [API Reference](api/index.md) — Full library API reference
- [CLI](cli/index.md) — Command-line interface reference
- [Guides](guides/index.md) — In-depth walkthroughs for LLM conversion, React Native, and more
- [Community](community.md) — Get involved
