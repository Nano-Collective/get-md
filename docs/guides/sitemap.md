---
title: "Sitemap Crawling"
description: "Convert every URL in a sitemap.xml (or sitemap index) with one command"
sidebar_order: 4
---

# Sitemap Crawling

Since v1.5.0, get-md can walk a `sitemap.xml` and convert every page it lists in one go. Handles both flat sitemaps and nested sitemap indexes, with glob-based URL filtering and depth/URL caps to keep runaway crawls in check.

Builds directly on [Batch Mode](./batch.md) — the same `-o ./out/`, `--json`, `--manifest`, `--concurrency`, and LLM-config options all apply.

## CLI

### Convert every URL in a sitemap

```bash
getmd --sitemap https://example.com/sitemap.xml -o ./out/
```

One `.md` file per page in `./out/`. Default filename pattern is `{host}-{slug}.md`.

### Filter URLs with globs

```bash
# Only blog posts
getmd --sitemap https://example.com/sitemap.xml \
  --include "**/blog/**" \
  -o ./blog/

# Everything except drafts
getmd --sitemap https://example.com/sitemap.xml \
  --exclude "**draft**" \
  -o ./out/

# Combine: blog posts but no drafts
getmd --sitemap https://example.com/sitemap.xml \
  --include "**/blog/**" \
  --exclude "**draft**" \
  -o ./out/
```

Both flags are **repeatable** (`--include A --include B`). `--exclude` is applied AFTER `--include`, so an exclude can carve exceptions out of a broader include.

**Glob syntax:**
- `*` — any run of characters except `/`
- `**` — any run of characters including `/`
- `?` — a single character except `/`

For URL filtering, `**` is usually what you want since URLs have lots of slashes.

### Cap depth and URL count

```bash
getmd --sitemap https://example.com/sitemap.xml \
  --max-depth 2 \
  --max-urls 100 \
  -o ./out/
```

- `--max-depth` (default 3) limits recursion into nested `<sitemapindex>` files.
- `--max-urls` (default 10,000) is a hard cap on URLs taken from the sitemap. Stops you accidentally converting 50,000 ecommerce product pages.

### Combine with LLM mode

Sitemap mode picks up your `.getmdrc` LLM config automatically — same as [batch mode](./batch.md):

```bash
# .getmdrc.json points at OpenRouter
getmd --sitemap https://example.com/sitemap.xml \
  --include "**/docs/**" \
  --concurrency 3 \
  -o ./docs-md/
```

Concurrency caps requests to your LLM provider — pick conservatively when hitting rate-limited APIs.

## Library

### `parseSitemap(source, options)` — just the URLs

```typescript
import { parseSitemap } from "@nanocollective/get-md";

const urls = await parseSitemap("https://example.com/sitemap.xml", {
  include: ["**/blog/**"],
  exclude: ["**draft**"],
  maxUrls: 500,
});
```

Accepts either a sitemap URL or a raw XML string. Returns a flat `string[]` of page URLs, with nested sitemap indexes recursively expanded.

### `convertSitemap(sitemapUrl, options)` — async iterator over conversions

```typescript
import { convertSitemap } from "@nanocollective/get-md";

for await (const result of convertSitemap(
  "https://example.com/sitemap.xml",
  {
    include: ["**/blog/**"],
    concurrency: 5,
    useLLM: true,
  },
)) {
  if (result.status === "ok") {
    console.log(`${result.url}: ${result.stats.estimatedTokens} tokens`);
  } else {
    console.error(`${result.url}: ${result.error.message}`);
  }
}
```

Same `BatchResult` shape as `convertBatch` — downstream code doesn't care whether the URLs came from a sitemap or a manual list.

### Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxDepth` | number | `3` | Max recursion into nested sitemap indexes |
| `maxUrls` | number | `10000` | Hard cap on URLs collected |
| `include` | string[] | — | Glob patterns to keep |
| `exclude` | string[] | — | Glob patterns to drop |
| `userAgent` | string | — | Custom UA for the sitemap fetch |
| _...plus all_ `BatchOptions` | | | `concurrency`, `continueOnError`, `onProgress`, etc. |

## End-to-end RAG ingestion

```typescript
import { convertSitemap, chunkMarkdown } from "@nanocollective/get-md";

for await (const result of convertSitemap(
  "https://docs.example.com/sitemap.xml",
  { include: ["**/docs/**"], concurrency: 5, useLLM: true },
)) {
  if (result.status !== "ok") continue;
  const chunks = chunkMarkdown(result.markdown, {
    maxTokens: 1000,
    overlap: 100,
  });
  for (const chunk of chunks) {
    await embed(chunk.content, {
      source_url: result.url,
      heading: chunk.headingPath.join(" / "),
    });
  }
}
```

## See Also

- [Batch Mode](./batch.md) — Manual URL lists, output options reference
- [Remote LLM Providers](./remote-llm.md) — Pluggable LLM backend that sitemap mode inherits
