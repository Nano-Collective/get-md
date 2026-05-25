---
title: "Batch Mode"
description: "Convert many URLs in one go from the CLI or the library, with bounded concurrency and per-URL error reporting"
sidebar_order: 3
---

# Batch Mode

Since v1.5.0, get-md can convert a list of URLs in one go — from the CLI or programmatically. Works seamlessly with the [pluggable LLM backend](./remote-llm.md), so your OpenRouter / Anthropic / Ollama config applies to every URL.

## CLI

### Convert a list of URLs to one Markdown file per URL

```bash
# urls.txt
# https://example.com/post-1
# https://example.com/post-2
# https://example.com/post-3

getmd --batch urls.txt -o ./out/
```

Each URL becomes one `.md` file in `./out/`. Default filename pattern is `{host}-{slug}.md` (e.g. `example-com-post-1.md`).

`urls.txt` is one URL per line. Blank lines and lines starting with `#` are ignored.

### Stream JSONL for piping

```bash
getmd --batch urls.txt --json | jq '.url'
```

`--json` in batch mode emits **JSONL** — one self-contained JSON object per line — so you can stream into `jq`, a JSON DB, or another tool without buffering the whole batch.

### Get a summary manifest

```bash
getmd --batch urls.txt -o ./out/ --manifest ./batch-summary.json
```

The manifest is JSON shaped like:

```json
{
  "total": 3,
  "ok": 2,
  "error": 1,
  "durationMs": 4321,
  "entries": [
    { "url": "...", "status": "ok", "file": "example-com-post-1.md", "stats": { ... } },
    { "url": "...", "status": "error", "error": "HTTP 404: Not Found" }
  ]
}
```

### Tune the rate

```bash
getmd --batch urls.txt -o ./out/ --concurrency 3
```

Default is 5. Pick conservatively when hitting LLM providers — most have rate limits well below "as fast as you can." `--stop-on-error` aborts on the first failure (default is to record the error and keep going).

### Custom filename pattern

```bash
getmd --batch urls.txt -o ./out/ --name-pattern "{index}-{slug}.md"
```

Placeholders:

- `{host}` — `example.com`
- `{path}` — full URL path, slugified
- `{slug}` — last meaningful path segment
- `{index}` — 1-based batch position, zero-padded to 4 digits

If two URLs produce the same filename, get-md appends `-2`, `-3`, etc. — nothing silently overwrites.

## Library

Two surfaces — pick one based on batch size:

### `convertBatch(urls, options)` — async iterator

Best for **large batches** or **streaming output**. Yields results as each URL completes (not in input order).

```typescript
import { convertBatch } from "@nanocollective/get-md";

for await (const result of convertBatch(urls, { concurrency: 5 })) {
  if (result.status === "ok") {
    console.log(`${result.url}: ${result.stats.estimatedTokens} tokens`);
    await saveToS3(result.url, result.markdown);
  } else {
    console.error(`${result.url} failed: ${result.error.message}`);
  }
}
```

### `convertBatchAll(urls, options)` — Promise convenience

For **small batches** where you want everything in memory:

```typescript
import { convertBatchAll } from "@nanocollective/get-md";

const results = await convertBatchAll(urls);
const ok = results.filter((r) => r.status === "ok");
console.log(`${ok.length} / ${results.length} succeeded`);
```

### Options

`BatchOptions` extends `MarkdownOptions` (so any LLM / extraction option you'd pass to `convertToMarkdown` works) plus:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `concurrency` | number | `5` | Max parallel conversions |
| `continueOnError` | boolean | `true` | When false, the iterator throws on the first failure |
| `onProgress` | callback | — | `({ completed, total, url, status }) => void` |

### Result shape

```typescript
type BatchResult =
  | { status: "ok"; url: string; markdown: string; metadata: ContentMetadata; stats: ConversionStats }
  | { status: "error"; url: string; error: Error };
```

TypeScript narrows after a `status` check.

## RAG pipeline example

Combine batch with [chunking](../api/index.md) and [token counting](../api/index.md) for a RAG ingestion pipeline:

```typescript
import { convertBatch, chunkMarkdown } from "@nanocollective/get-md";

for await (const result of convertBatch(urls, { concurrency: 5, useLLM: true })) {
  if (result.status !== "ok") continue;
  const chunks = chunkMarkdown(result.markdown, {
    maxTokens: 1000,
    overlap: 100,
  });
  for (const chunk of chunks) {
    await embed(chunk.content); // your vector store of choice
  }
}
```

## See Also

- [Remote LLM Providers](./remote-llm.md) — Configure which LLM batch mode routes through
- [Configuration](../configuration/index.md) — Settings reference (the same options work in batch)
