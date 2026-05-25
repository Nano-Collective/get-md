// src/utils/http-cache.ts

// File-system response cache for fetchUrl. Keyed by SHA-256 of the URL so
// the cache key is short, fixed-length, and filesystem-safe. Each cached
// entry is a single JSON file containing the body + metadata (URL, mtime).
//
// Best-effort by design — cache failures (corrupt file, missing perms,
// stale partial write) all fall back to the live network fetch. The cache
// is an optimisation, never a correctness dependency.

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_CACHE_DIR = join(homedir(), ".get-md", "cache");

interface CacheEntry {
  url: string;
  storedAt: number;
  body: string;
}

/**
 * Resolve the cache directory. `true` and `undefined` both pick the default
 * (`~/.get-md/cache`). A string is used verbatim (treated as a path).
 */
export function resolveCacheDir(
  cache: boolean | string | undefined,
): string | null {
  if (cache === undefined || cache === false) return null;
  if (cache === true) return DEFAULT_CACHE_DIR;
  return cache;
}

/** SHA-256 of the URL, truncated to 32 hex chars. */
function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

function cachePath(dir: string, url: string): string {
  return join(dir, `${cacheKey(url)}.json`);
}

/**
 * Look up a URL in the cache. Returns the cached body if present and not
 * expired, otherwise null. Any error (missing file, parse failure, stat
 * miss) is treated as a cache miss.
 *
 * @param maxAgeMs Maximum age of a cache entry in milliseconds. Entries
 *                 older than this are treated as misses (and proactively
 *                 deleted so the cache stays small).
 */
export async function readFromCache(
  dir: string,
  url: string,
  maxAgeMs: number,
): Promise<string | null> {
  const file = cachePath(dir, url);
  let entry: CacheEntry;
  try {
    const raw = await readFile(file, "utf-8");
    entry = JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }

  // Trust mtime over storedAt — file mtime is harder to lie about and
  // matches what `find -mtime` etc. would see.
  let mtimeMs: number;
  try {
    const stats = await stat(file);
    mtimeMs = stats.mtimeMs;
  } catch {
    return null;
  }

  if (Date.now() - mtimeMs > maxAgeMs) {
    // Best-effort cleanup. Failure to remove a stale entry shouldn't break
    // the fetch — the next write will overwrite it.
    void rm(file, { force: true });
    return null;
  }

  if (typeof entry?.body !== "string") return null;
  return entry.body;
}

/**
 * Persist a URL's body to the cache. Best-effort — if the write fails, we
 * just log a warning and let the caller proceed with the live response.
 */
export async function writeToCache(
  dir: string,
  url: string,
  body: string,
): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
    const entry: CacheEntry = {
      url,
      storedAt: Date.now(),
      body,
    };
    await writeFile(cachePath(dir, url), JSON.stringify(entry), "utf-8");
  } catch (error) {
    // Don't surface — cache is an optimisation, not a requirement.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`get-md cache: write failed for ${url}: ${message}`);
  }
}

/** Default cache TTL: 1 hour. Reasonable for dev loops and short crawls. */
export const DEFAULT_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
