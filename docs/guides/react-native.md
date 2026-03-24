---
title: "React Native"
description: "Using get-md in React Native apps for HTML-to-Markdown conversion"
sidebar_order: 2
---

# React Native

get-md fully supports React Native including content extraction. We use `happy-dom-without-node` instead of JSDOM, which works across Node.js, React Native, and browser environments.

## Usage

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

const result = await convertToMarkdown(html, {
  extractContent: true,
  includeMeta: true,
});
```

No special configuration needed — all standard features work out of the box.

## Supported Features

All features work in React Native:

- HTML to Markdown conversion
- Mozilla Readability content extraction
- Metadata extraction
- Content cleaning and optimization
- All formatting options

## Limitations

- **LLM conversion** requires Node.js and is not available in React Native environments
- **URL fetching** works but may require additional network permission configuration in your React Native app

## See Also

- [Quick Start](../getting-started/quick-start.md) — Get started with get-md
- [API Reference](../api/convert-to-markdown.md) — Full options reference
