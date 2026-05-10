---
title: "LLM Conversion"
description: "Using the optional AI model for higher quality HTML-to-Markdown conversion"
sidebar_order: 1
---

# LLM Conversion

For higher quality Markdown output, get-md supports optional AI-powered conversion using a local LLM model. This uses [ReaderLM-v2](https://huggingface.co/jinaai/ReaderLM-v2), a model specifically trained for HTML-to-Markdown conversion.

## Prerequisite: install `node-llama-cpp`

Since v1.4.0, `node-llama-cpp` is an **optional peer dependency** rather than a direct dependency. This keeps install size small for the ~95% of users who only need `convertToMarkdown`. To enable LLM features, install it alongside get-md:

```bash
npm install @nanocollective/get-md node-llama-cpp
```

If you call any LLM API (`LLMConverter`, `LLMManager`, `createLLMConverter`, `downloadLLMModel`, or `getmd --download-model`) without the peer installed, get-md throws a clear error pointing you here. The standard HTML→Markdown path (`convertToMarkdown`, `hasContent`, etc.) works without it.

## When to Use LLM vs Turndown

| Use Case | Recommended Method |
|----------|-------------------|
| High-quality single conversions | LLM (better structure) |
| Complex documentation sites | LLM (semantic understanding) |
| Batch processing (1000+ pages) | Turndown (speed) |
| CI/CD pipelines | Turndown (fast, deterministic) |
| Real-time conversion | Turndown (sub-second) |

## Quick Start

### Library

```typescript
import { convertToMarkdown, checkLLMModel, downloadLLMModel } from "@nanocollective/get-md";

// 1. Check if model is available
const status = await checkLLMModel();

if (!status.available) {
  // 2. Download model (one-time, ~986MB)
  await downloadLLMModel({
    onProgress: (downloaded, total, percentage) => {
      console.log(`Downloading: ${percentage.toFixed(1)}%`);
    },
  });
}

// 3. Convert with LLM
const result = await convertToMarkdown("https://example.com", {
  useLLM: true,
  onLLMEvent: (event) => {
    if (event.type === "conversion-complete") {
      console.log(`Done in ${event.duration}ms`);
    }
  },
});
```

### CLI

```bash
# Download model (one-time)
getmd --download-model

# Convert with LLM
getmd https://example.com --use-llm -o output.md

# Compare Turndown vs LLM output
getmd https://example.com --compare -o comparison.md
```

## LLM Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useLLM` | boolean | `false` | Use the local LLM model for conversion |
| `llmModelPath` | string | — | Custom path to a GGUF model file |
| `llmTemperature` | number | `0.1` | Generation temperature (lower = more deterministic) |
| `llmMaxTokens` | number | `512000` | Maximum tokens for generation |
| `llmFallback` | boolean | `true` | Fall back to Turndown if LLM conversion fails |

## Model Management

### Check Status

```bash
getmd --model-info
```

```typescript
import { checkLLMModel } from "@nanocollective/get-md";
const status = await checkLLMModel();
```

### Download

```bash
getmd --download-model
```

```typescript
import { downloadLLMModel } from "@nanocollective/get-md";
await downloadLLMModel();
```

### Remove

```bash
getmd --remove-model
```

```typescript
import { removeLLMModel } from "@nanocollective/get-md";
await removeLLMModel();
```

### Get Model Info

```bash
getmd --model-path
```

```typescript
import { getLLMModelInfo } from "@nanocollective/get-md";
const info = getLLMModelInfo();
console.log(info.defaultPath);
```

## Event Callbacks

Track conversion progress with event callbacks:

```typescript
const result = await convertToMarkdown("https://example.com", {
  useLLM: true,
  onLLMEvent: (event) => {
    switch (event.type) {
      case "model-loading":
        console.log("Loading model...");
        break;
      case "conversion-start":
        console.log("Starting conversion...");
        break;
      case "conversion-progress":
        console.log(`Progress: ${event.progress}%`);
        break;
      case "conversion-complete":
        console.log(`Done in ${event.duration}ms`);
        break;
      case "conversion-error":
        console.error(`Error: ${event.error}`);
        break;
    }
  },
});
```

## System Requirements

- **Disk Space**: ~1GB for the model file
- **RAM**: 2-4GB during inference (8GB+ system recommended)
- **Speed**: 5-10 seconds per typical webpage (vs <100ms for Turndown)

## See Also

- [convertToMarkdown()](../api/convert-to-markdown.md) — Full API reference with LLM options
- [Model Management](../api/model-management.md) — Detailed model management API
- [Configuration](../configuration/index.md) — Set LLM as default via config files
