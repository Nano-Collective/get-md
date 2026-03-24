---
title: "Model Management"
description: "API reference for LLM model management functions in get-md"
sidebar_order: 2
---

# Model Management

Functions for managing the optional LLM model used for AI-powered conversion.

## checkLLMModel()

Check if the LLM model is downloaded and available.

```typescript
import { checkLLMModel } from "@nanocollective/get-md";

const status = await checkLLMModel();
console.log(status.available);      // true/false
console.log(status.sizeFormatted);  // "986MB"
```

### Returns

```typescript
interface LLMModelStatus {
  available: boolean;
  path: string;
  size: number;
  sizeFormatted: string;
  version: string;
}
```

## downloadLLMModel()

Download the LLM model (~986MB, one-time download).

```typescript
import { downloadLLMModel } from "@nanocollective/get-md";

await downloadLLMModel({
  onProgress: (downloaded, total, percentage) => {
    console.log(`Downloading: ${percentage.toFixed(1)}%`);
  },
});
```

The model is saved to `~/.get-md/models/ReaderLM-v2-Q4_K_M.gguf`.

## getLLMModelInfo()

Get information about the model including the default path.

```typescript
import { getLLMModelInfo } from "@nanocollective/get-md";

const info = getLLMModelInfo();
console.log(info.defaultPath);      // ~/.get-md/models/ReaderLM-v2-Q4_K_M.gguf
console.log(info.recommendedModel); // "ReaderLM-v2-Q4_K_M"
```

## removeLLMModel()

Remove the downloaded LLM model to free disk space.

```typescript
import { removeLLMModel } from "@nanocollective/get-md";

await removeLLMModel();
```

## Model Details

| Property | Value |
|----------|-------|
| Model | ReaderLM-v2 |
| Format | GGUF |
| Quantization | Q4_K_M |
| Size | ~986MB |
| Languages | 29 |
| Max Tokens | 512,000 |
| Storage Path | `~/.get-md/models/` |

## See Also

- [convertToMarkdown()](convert-to-markdown.md) — Main conversion function with LLM options
- [LLM Conversion](../guides/llm-conversion.md) — When and how to use LLM conversion
- [CLI](../cli/index.md) — Model management from the command line
