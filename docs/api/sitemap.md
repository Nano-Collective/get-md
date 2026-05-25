---
title: "Sitemap API"
description: "Parse and crawl sitemap.xml files — recursive index support, glob filters, depth and URL caps"
sidebar_order: 3
---

# Sitemap API

Walk a `sitemap.xml` (or sitemap index) and either get back the flat URL list or convert every page. Handles nested `<sitemapindex>` files recursively with a depth cap.

For the CLI surface (`--sitemap`, `--include`, `--exclude`, `--max-depth`, `--max-urls`) see the [Sitemap Crawling guide](../guides/sitemap.md).

## parseSitemap()

Fetch a sitemap URL (or parse a raw XML string) and return the flat list of page URLs. Recursively follows `<sitemapindex>` entries up to `maxDepth`.

```typescript
import { parseSitemap } from "@nanocollective/get-md";

const urls = await parseSitemap("https://example.com/sitemap.xml", {
  include: ["**/blog/**"],
  maxUrls: 500,
});
console.log(`Found ${urls.length} URLs`);
```

### Parameters

- `source` (`string`) — A sitemap URL (fetched automatically) **or** a raw XML string (detected by leading `<`)
- `options` (`SitemapOptions`) — Optional filters and limits

### Returns

`Promise<string[]>` — flat list of page URLs after include/exclude filtering.

## convertSitemap()

Convenience over `parseSitemap` + [`convertBatch`](./batch.md): yields a `BatchResult` per page. Downstream code doesn't care whether the URLs came from a sitemap or a manual list.

```typescript
import { convertSitemap } from "@nanocollective/get-md";

for await (const r of convertSitemap("https://example.com/sitemap.xml", {
  include: ["**/docs/**"],
  concurrency: 5,
  useLLM: true,
})) {
  if (r.status === "ok") console.log(r.url, r.stats.estimatedTokens);
}
```

### Parameters

- `sitemapUrl` (`string`) — URL of the sitemap to walk
- `options` (`SitemapOptions & BatchOptions`) — Combined: every sitemap filter plus every batch option (`concurrency`, `continueOnError`, `useLLM`, `llm`, etc.)

### Returns

`AsyncGenerator<BatchResult>` — see [Batch API](./batch.md#batchresult).

## parseSitemapXml()

Pure-function helper for callers that already have the XML in hand. Detects whether the payload is a flat `<urlset>` or a `<sitemapindex>` and returns entries in document order.

```typescript
import { parseSitemapXml } from "@nanocollective/get-md";

const parsed = parseSitemapXml(xmlString);
// parsed.type is "urlset" or "index"
// parsed.entries is string[]
```

### Returns

```typescript
{
  type: "urlset" | "index";
  entries: string[];
}
```

## Types

### `SitemapOptions`

```typescript
interface SitemapOptions {
  /** Max recursion into nested <sitemapindex> files. Default: 3 */
  maxDepth?: number;

  /**
   * Hard cap on URLs returned. The walker stops collecting once this is
   * hit. Default: 10000 — safety against runaway crawls.
   */
  maxUrls?: number;

  /**
   * Glob patterns to keep. At least one must match for the URL to be
   * included. Supports `*` (no slashes), `**` (any chars), `?` (one char).
   */
  include?: string[];

  /**
   * Glob patterns to drop. Applied AFTER include, so an exclude can carve
   * exceptions out of a broader include.
   */
  exclude?: string[];

  /** Custom user agent for the sitemap fetch */
  userAgent?: string;
}
```

### Glob syntax

For URL filtering — same shape as minimatch's basic syntax:

- `*` — any run of characters except `/`
- `**` — any run of characters including `/`
- `?` — a single character except `/`

URLs have lots of slashes, so `**` is usually what you want for path-spanning matches: `**/blog/**`, not `*/blog/*`.

## Examples

### Walk a sitemap, return the URL list

```typescript
const urls = await parseSitemap("https://docs.example.com/sitemap.xml", {
  maxUrls: 200,
});
```

### Filter aggressively

```typescript
const urls = await parseSitemap("https://example.com/sitemap.xml", {
  include: ["**/blog/**", "**/docs/**"],
  exclude: ["**draft**", "**internal**"],
});
```

### Convert every page in a docs site with LLM cleanup

```typescript
for await (const result of convertSitemap(
  "https://docs.example.com/sitemap.xml",
  {
    include: ["**/docs/**"],
    concurrency: 3,
    useLLM: true,
    llm: {
      sdkProvider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-haiku-4-5",
    },
    cache: true, // skip pages we've already fetched
  },
)) {
  if (result.status !== "ok") continue;
  await saveToVectorDb(result.url, result.markdown);
}
```

### Parse already-fetched XML

```typescript
import { readFile } from "node:fs/promises";
import { parseSitemapXml } from "@nanocollective/get-md";

const xml = await readFile("./sitemap.xml", "utf-8");
const parsed = parseSitemapXml(xml);

if (parsed.type === "index") {
  console.log(`Index points at ${parsed.entries.length} child sitemaps`);
} else {
  console.log(`Flat sitemap with ${parsed.entries.length} URLs`);
}
```

## See Also

- [Sitemap Crawling guide](../guides/sitemap.md) — CLI walkthrough
- [Batch API](./batch.md) — Result shape and shared options
- [convertToMarkdown](./convert-to-markdown.md) — Per-page options
