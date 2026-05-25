---
title: "Batch API"
description: "Convert many URLs in one go with bounded concurrency — async iterator and Promise-based variants"
sidebar_order: 2
---

# Batch API

Convert many URLs in one call with bounded concurrency. Pairs naturally with the [pluggable LLM backend](../guides/remote-llm.md) — your OpenRouter / Anthropic / Ollama config applies to every URL.

For the CLI surface (`--batch`, `--json`, `--manifest`) see the [Batch Mode guide](../guides/batch.md).

## convertBatch()

Async iterator that yields one `BatchResult` per URL **as it completes** (not in input order). Best for large batches and streaming output — the iterator never buffers more than the in-flight worker count in memory.

```typescript
import { convertBatch } from "@nanocollective/get-md";

for await (const result of convertBatch(urls, options?)) {
  if (result.status === "ok") {
    console.log(`${result.url}: ${result.stats.estimatedTokens} tokens`);
  } else {
    console.error(`${result.url}: ${result.error.message}`);
  }
}
```

### Parameters

- `urls` (`string[]`) — Page URLs to convert
- `options` (`BatchOptions`) — Optional; extends `MarkdownOptions` (see [convertToMarkdown](./convert-to-markdown.md)) with batch-specific fields

### Returns

`AsyncGenerator<BatchResult>` — one `BatchResult` per URL.

## convertBatchAll()

Promise-based convenience over `convertBatch`. Buffers every result into an array. Use for small batches when you want the full set in memory anyway.

```typescript
import { convertBatchAll } from "@nanocollective/get-md";

const results = await convertBatchAll(urls, { concurrency: 5 });
const ok = results.filter((r) => r.status === "ok");
console.log(`${ok.length} / ${results.length} succeeded`);
```

### Parameters

Same as `convertBatch`.

### Returns

`Promise<BatchResult[]>` — every URL's outcome, in completion order.

## Types

### `BatchOptions`

```typescript
interface BatchOptions extends MarkdownOptions {
  /** Max parallel conversions. Default: 5 */
  concurrency?: number;

  /**
   * When true (default), URL failures don't abort the batch — they surface
   * as BatchResult entries with status 'error'. When false, the iterator
   * throws on the first failure.
   */
  continueOnError?: boolean;

  /** Called once per URL as it completes. */
  onProgress?: (progress: BatchProgress) => void | Promise<void>;
}
```

Every `MarkdownOptions` field also applies — `useLLM`, `llm`, `extractContent`, `downloadImages`, `cache`, `retries`, etc.

### `BatchResult`

Discriminated union. TypeScript narrows after a `status` check:

```typescript
type BatchResult =
  | {
      status: "ok";
      url: string;
      markdown: string;
      metadata: ContentMetadata;
      stats: ConversionStats;
    }
  | {
      status: "error";
      url: string;
      error: Error;
    };
```

### `BatchProgress`

```typescript
interface BatchProgress {
  completed: number;   // URLs done so far (success or error)
  total: number;       // URLs in the batch
  url: string;         // The URL that just finished
  status: "ok" | "error";
}
```

## Examples

### With progress reporting

```typescript
import { convertBatch } from "@nanocollective/get-md";

await convertBatch(urls, {
  concurrency: 5,
  onProgress: ({ completed, total, url, status }) => {
    console.log(`[${completed}/${total}] ${status.toUpperCase()} ${url}`);
  },
});
```

### Stop on first error

```typescript
try {
  for await (const result of convertBatch(urls, {
    continueOnError: false,
  })) {
    process(result);
  }
} catch (err) {
  console.error("Batch aborted on first failure:", err);
}
```

### Hit an LLM provider with conservative concurrency

```typescript
for await (const result of convertBatch(urls, {
  useLLM: true,
  llm: {
    sdkProvider: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    model: "anthropic/claude-haiku-4.5",
  },
  concurrency: 3, // most providers rate-limit well below "as fast as you can"
  retries: 5,    // transient 429s get retried with backoff
})) {
  if (result.status === "ok") await save(result.url, result.markdown);
}
```

### Combine with chunking for a RAG pipeline

```typescript
import { convertBatch, chunkMarkdown } from "@nanocollective/get-md";

for await (const r of convertBatch(urls, { concurrency: 5, useLLM: true })) {
  if (r.status !== "ok") continue;
  const chunks = chunkMarkdown(r.markdown, { maxTokens: 1000, overlap: 100 });
  for (const chunk of chunks) {
    await embed(chunk.content, {
      source: r.url,
      heading: chunk.headingPath.join(" / "),
    });
  }
}
```

### Use the cache for fast dev loops

```typescript
const results = await convertBatchAll(urls, {
  cache: true,           // ~/.get-md/cache
  cacheMaxAge: 3_600_000, // 1 hour
});
```

Cache hits skip the network entirely — re-running a batch while iterating on chunk size or LLM config completes near-instantly.

## See Also

- [Batch Mode](../guides/batch.md) — CLI walkthrough and recipes
- [Sitemap API](./sitemap.md) — Walk a sitemap.xml and feed URLs into batch
- [convertToMarkdown](./convert-to-markdown.md) — Per-URL options that batch inherits
