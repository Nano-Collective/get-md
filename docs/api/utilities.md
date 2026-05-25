---
title: "Utilities"
description: "Helper exports: chunkMarkdown, estimateTokens, hasContent, and the config-loader API"
sidebar_order: 4
---

# Utilities

Helper exports that pair naturally with `convertToMarkdown` but are independently useful.

## chunkMarkdown()

Split a Markdown document into LLM-friendly chunks at semantic boundaries. Prefers heading boundaries, falls back to paragraphs, then sentences, then character windows. Tracks the heading trail per chunk and can prepend it for context.

```typescript
import { chunkMarkdown } from "@nanocollective/get-md";

const chunks = chunkMarkdown(markdown, { maxTokens: 1000, overlap: 100 });

for (const chunk of chunks) {
  await embed(chunk.content); // your vector store of choice
}
```

### Parameters

- `markdown` (`string`) — Markdown text
- `options` (`ChunkOptions`) — Required; `maxTokens` is the only mandatory field

### Returns

`MarkdownChunk[]` — one per chunk.

### Types

```typescript
interface ChunkOptions {
  /** Hard upper bound on tokens per chunk */
  maxTokens: number;

  /**
   * Tokens to overlap between adjacent chunks. Useful for RAG retrieval
   * so an answer that straddles a chunk boundary still surfaces. Default: 0.
   */
  overlap?: number;

  /**
   * Prepend the current heading trail to each chunk so the model has
   * context about where the chunk came from. Default: true.
   */
  includeHeadingPath?: boolean;
}

interface MarkdownChunk {
  /** The chunk's text (heading path already prepended if enabled) */
  content: string;
  /** Estimated tokens for `content` (matches estimateTokens(content)) */
  estimatedTokens: number;
  /** The heading trail this chunk lives under, e.g. ["Docs","Setup","Install"] */
  headingPath: string[];
  /** Zero-based chunk index */
  index: number;
  /** Total chunks produced */
  total: number;
}
```

### Behavior

- **Frontmatter is stripped** before chunking — it belongs to the document, not individual chunks.
- **Headings prefer their own chunk start** — when the packer hits a heading and the current chunk already has body content, it starts a new chunk so sections stay coherent for retrieval.
- **Oversized blocks split internally** — a single paragraph larger than `maxTokens` is split on sentence boundaries, then on raw characters as a last resort.
- **Overlap is taken from the tail** of the previous chunk so the next chunk has context for what came just before.

### Example

```typescript
import { convertToMarkdown, chunkMarkdown } from "@nanocollective/get-md";

const { markdown } = await convertToMarkdown(
  "https://example.com/long-article",
);
const chunks = chunkMarkdown(markdown, {
  maxTokens: 1500,
  overlap: 150,
});

for (const chunk of chunks) {
  console.log(`[${chunk.index + 1}/${chunk.total}] ${chunk.headingPath.join(" / ")}`);
  await embed(chunk.content);
}
```

---

## estimateTokens()

Quick chars/4 token estimate. Designed for context-window budgeting and chunk-size decisions — not exact billing.

```typescript
import { estimateTokens } from "@nanocollective/get-md";

const tokens = estimateTokens(result.markdown);
if (tokens > 8000) {
  // chunk before sending
}
```

### Parameters

- `text` (`string`) — Any string

### Returns

`number` — `Math.ceil(text.length / 4)`. Rounds up so small strings register as 1 token rather than 0.

### Notes

- The heuristic targets OpenAI/Anthropic-family English text. Code, JSON, and CJK trend lower; long URLs and punctuation-heavy fragments trend higher.
- For an exact count, run the markdown through your target model's tokenizer (e.g. [`tiktoken`](https://github.com/openai/tiktoken), [`gpt-tokenizer`](https://github.com/niieani/gpt-tokenizer)).
- `ConversionStats.estimatedTokens` uses this helper, so you usually don't need to call it directly.

---

## hasContent()

Cheap check for whether an HTML string contains enough text to be worth converting. Strips scripts/styles/nav/header/footer, then checks if the remaining body has at least 100 characters of text.

```typescript
import { hasContent } from "@nanocollective/get-md";

if (!hasContent(html)) {
  console.log("Empty or chrome-only page — skipping");
  return;
}
```

### Parameters

- `html` (`string`) — Raw HTML

### Returns

`boolean` — `true` when the HTML has ≥100 characters of substantive text content after noise removal.

### When to use

- Skipping placeholder/redirect pages before paying for an LLM conversion
- Filtering out crawler results with no real content before they hit your storage
- Quick test in unit tests / sanity scripts

---

## Config-loader exports

The same loader the CLI uses for `.getmdrc` / `get-md.config.json`. Useful if you're embedding get-md in a larger tool and want to honor the same config surface.

```typescript
import {
  loadConfig,
  loadConfigFromFile,
  findConfigPath,
  mergeConfigWithOptions,
  type GetMdConfig,
} from "@nanocollective/get-md";
```

| Function | Returns | Description |
|----------|---------|-------------|
| `loadConfig()` | `GetMdConfig` | Search cwd then home for a config file; merge results (cwd wins). Returns `{}` if none found. |
| `loadConfigFromFile(path)` | `GetMdConfig` | Parse + validate a specific config file. Throws on parse / validation errors. |
| `findConfigPath()` | `string \| null` | The path to the config file that *would* be loaded, without parsing it. |
| `mergeConfigWithOptions(cfg, opts)` | `MarkdownOptions` | Merge a loaded config into per-call options (opts win when set). |

All loaded config goes through `${ENV_VAR}` substitution before validation, so secrets like `apiKey` can stay out of committed files.

### Example

```typescript
import {
  convertToMarkdown,
  loadConfig,
  mergeConfigWithOptions,
} from "@nanocollective/get-md";

const fileConfig = loadConfig();
const result = await convertToMarkdown(
  url,
  mergeConfigWithOptions(fileConfig, { useLLM: true }),
);
```

---

## See Also

- [convertToMarkdown](./convert-to-markdown.md) — Main entry, returns `stats.estimatedTokens` automatically
- [Batch API](./batch.md) — `chunkMarkdown` pairs naturally with batch for RAG ingestion
- [Configuration](../configuration/index.md) — Config file schema reference
