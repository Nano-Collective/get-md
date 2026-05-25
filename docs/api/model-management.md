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
console.log(status.sizeFormatted);  // "1.12GB"
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

Download the LLM model (~1.12GB, one-time download).

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
| Size | ~1.12GB |
| Languages | 29 |
| Max Tokens | 32,768 (Qwen2.5 native context) |
| Storage Path | `~/.get-md/models/` |

## Advanced: direct converter classes

Most users only need `convertToMarkdown({ useLLM: true })`, which transparently picks the right backend. For more control — long-running services that want to load the model once and convert many pages, custom event handling, or building your own orchestration layer — get-md also exports the underlying classes.

### LLMConverter (local llama.cpp)

Wraps the local ReaderLM-v2 / `node-llama-cpp` path. Load once, convert many times, dispose when done.

```typescript
import { LLMConverter, createLLMConverter } from "@nanocollective/get-md";

const converter = createLLMConverter({
  modelPath: "/path/to/ReaderLM-v2.Q4_K_M.gguf",
  temperature: 0.1,
  maxTokens: 8192,
  onEvent: (event) => console.log(event.type),
});

await converter.loadModel();
const markdown1 = await converter.convert(html1);
const markdown2 = await converter.convert(html2);
await converter.unload(); // free GPU/RAM
```

| Method | Returns | Description |
|--------|---------|-------------|
| `loadModel()` | `Promise<void>` | Initialize llama.cpp and load the model file. Slow on first call (binaries may compile). |
| `isLoaded()` | `boolean` | Whether the model is loaded and ready |
| `convert(html)` | `Promise<string>` | Convert HTML to Markdown. Must call `loadModel()` first. |
| `unload()` | `Promise<void>` | Free the model + context. Safe to call multiple times. |

### LLMManager (model lifecycle)

The class behind the top-level model-management functions. Use directly if you want to bundle the same operations with custom event tracking.

```typescript
import { LLMManager } from "@nanocollective/get-md";

const manager = new LLMManager({
  modelPath: "/custom/path/model.gguf",
  onEvent: (event) => console.log(event),
});

const status = await manager.checkModel();
if (!status.available) {
  await manager.downloadModel();
}
```

Same surface as the top-level `checkLLMModel`/`downloadLLMModel`/`removeLLMModel`/`getLLMModelInfo`, but with shared `modelPath` and `onEvent` state.

### Remote LLM converter

For the remote (OpenAI-compatible / Anthropic / Google) path, see [Remote LLM Providers](../guides/remote-llm.md). The `RemoteLlmConverter` class is structured to mirror `LLMConverter` but isn't directly exported — wire your provider through `convertToMarkdown`'s `llm` option, which uses it internally.

## See Also

- [convertToMarkdown()](convert-to-markdown.md) — Main conversion function with LLM options
- [LLM Conversion](../guides/llm-conversion.md) — When and how to use LLM conversion
- [Remote LLM Providers](../guides/remote-llm.md) — OpenAI-compatible, Anthropic, Google
- [CLI](../cli/index.md) — Model management from the command line
