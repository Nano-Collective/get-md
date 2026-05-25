// src/sitemap.ts

// Sitemap parsing and crawling. Handles both flat `urlset` sitemaps and
// nested `sitemapindex` files (recursively, with a depth cap). Uses cheerio
// for XML parsing — already a dependency, no new install cost.

import * as cheerio from "cheerio/slim";
import { convertBatch } from "./batch.js";
import type { BatchOptions, BatchResult } from "./types.js";
import { fetchUrl } from "./utils/url-fetcher.js";

/** Options for `parseSitemap` and `convertSitemap` */
export interface SitemapOptions {
  /**
   * How deep to follow nested `<sitemapindex>` files. The top-level sitemap
   * is depth 0. Default: 3. Prevents runaway recursion against hostile or
   * misconfigured sitemap servers.
   */
  maxDepth?: number;

  /**
   * Hard cap on the number of URLs returned. Defaults to 10,000. The walker
   * stops adding URLs once the cap is reached — useful when you point at a
   * giant ecommerce sitemap by accident.
   */
  maxUrls?: number;

  /**
   * Only keep URLs matching at least one of these glob patterns. Supports
   * `*` and `**` wildcards (the same shape Node's minimatch / picomatch use,
   * but evaluated with a simple regex translation — no peer dep added).
   * Applied after fetching, before recursing into nested indexes.
   */
  include?: string[];

  /**
   * Drop URLs matching any of these glob patterns. Applied AFTER `include`
   * so an exclude can carve exceptions out of a broader include.
   */
  exclude?: string[];

  /**
   * Custom user agent for the sitemap fetch. Defaults to the same user-agent
   * `fetchUrl` uses for HTML.
   */
  userAgent?: string;
}

/**
 * Fetch a sitemap URL (or parse a sitemap XML string) and return the flat
 * list of page URLs. Recurses into `<sitemapindex>` entries up to `maxDepth`.
 *
 * @example
 * ```typescript
 * import { parseSitemap } from '@nanocollective/get-md';
 *
 * const urls = await parseSitemap('https://example.com/sitemap.xml', {
 *   include: ['*&#47;blog&#47;*'],
 *   maxUrls: 500,
 * });
 * console.log(`Found ${urls.length} URLs`);
 * ```
 */
export async function parseSitemap(
  source: string,
  options: SitemapOptions = {},
): Promise<string[]> {
  const maxDepth = options.maxDepth ?? 3;
  const maxUrls = options.maxUrls ?? 10_000;
  const include = options.include?.map(globToRegExp) ?? [];
  const exclude = options.exclude?.map(globToRegExp) ?? [];

  // Both an XML string and a URL are accepted. Heuristic: starts with "<" =
  // raw XML, otherwise treat as URL to fetch.
  const seen = new Set<string>();
  const collected: string[] = [];

  await walk(source, 0);

  return collected;

  async function walk(src: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    if (collected.length >= maxUrls) return;

    const xml = src.trimStart().startsWith("<")
      ? src
      : await fetchUrl(src, { userAgent: options.userAgent });

    const parsed = parseSitemapXml(xml);

    if (parsed.type === "index") {
      for (const nested of parsed.entries) {
        if (collected.length >= maxUrls) break;
        if (seen.has(nested)) continue;
        seen.add(nested);
        try {
          await walk(nested, depth + 1);
        } catch (error) {
          // One bad nested sitemap shouldn't kill the whole crawl. Surface
          // via stderr so callers can decide whether to investigate.
          const message =
            error instanceof Error ? error.message : String(error);
          console.warn(`Skipping nested sitemap ${nested}: ${message}`);
        }
      }
      return;
    }

    for (const url of parsed.entries) {
      if (collected.length >= maxUrls) break;
      if (!matchesFilters(url, include, exclude)) continue;
      collected.push(url);
    }
  }
}

interface ParsedSitemap {
  type: "urlset" | "index";
  entries: string[];
}

/**
 * Parse a sitemap XML payload. Detects whether it's a flat `<urlset>` or a
 * `<sitemapindex>`. Returns URLs in document order.
 */
export function parseSitemapXml(xml: string): ParsedSitemap {
  const $ = cheerio.load(xml, { xml: true });

  const indexEntries = $("sitemapindex > sitemap > loc")
    .toArray()
    .map((el) => $(el).text().trim())
    .filter(Boolean);

  if (indexEntries.length > 0) {
    return { type: "index", entries: indexEntries };
  }

  const urlEntries = $("urlset > url > loc")
    .toArray()
    .map((el) => $(el).text().trim())
    .filter(Boolean);

  return { type: "urlset", entries: urlEntries };
}

/**
 * Convenience: walk a sitemap and convert every URL it produces. Yields
 * `BatchResult` per page — same shape as `convertBatch`, so downstream code
 * doesn't care whether the input was an explicit URL list or a sitemap.
 *
 * Combines `parseSitemap` and `convertBatch` so callers don't need to write
 * the glue themselves. All `SitemapOptions` and `BatchOptions` fields are
 * supported in one options object.
 *
 * @example
 * ```typescript
 * import { convertSitemap } from '@nanocollective/get-md';
 *
 * for await (const result of convertSitemap('https://example.com/sitemap.xml', {
 *   include: ['*&#47;blog&#47;*'],
 *   concurrency: 5,
 *   useLLM: true,
 * })) {
 *   if (result.status === 'ok') console.log(result.url);
 * }
 * ```
 */
export async function* convertSitemap(
  sitemapUrl: string,
  options: SitemapOptions & BatchOptions = {},
): AsyncGenerator<BatchResult, void, void> {
  const urls = await parseSitemap(sitemapUrl, {
    maxDepth: options.maxDepth,
    maxUrls: options.maxUrls,
    include: options.include,
    exclude: options.exclude,
    userAgent: options.userAgent,
  });
  if (urls.length === 0) return;
  yield* convertBatch(urls, options);
}

function matchesFilters(
  url: string,
  include: RegExp[],
  exclude: RegExp[],
): boolean {
  if (include.length > 0 && !include.some((re) => re.test(url))) return false;
  if (exclude.some((re) => re.test(url))) return false;
  return true;
}

/**
 * Convert a glob pattern to a RegExp. Supports:
 *
 * - `*`  — matches any run of characters except `/`
 * - `**` — matches any run of characters including `/`
 * - `?`  — matches a single character except `/`
 * - everything else is escaped literally
 *
 * Intentionally simple — no brace expansion, no character classes. For the
 * URL-filter use case this is plenty and avoids pulling in micromatch.
 */
function globToRegExp(glob: string): RegExp {
  let pattern = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        pattern += ".*";
        i++;
      } else {
        pattern += "[^/]*";
      }
    } else if (c === "?") {
      pattern += "[^/]";
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      pattern += `\\${c}`;
    } else {
      pattern += c;
    }
  }
  // Glob patterns come from caller-supplied SitemapOptions, not untrusted
  // network input. The translation above only emits bounded constructs
  // (`[^/]*`, `.*`, escaped literals) — no catastrophic backtracking shapes.
  return new RegExp(`^${pattern}$`); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
}
