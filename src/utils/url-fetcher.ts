// src/utils/url-fetcher.ts

import {
  DEFAULT_FETCH_MAX_BYTES,
  DEFAULT_FETCH_TIMEOUT,
  DEFAULT_USER_AGENT,
} from "../config.js";
import type { FetchOptions } from "../types.js";
import {
  DEFAULT_CACHE_MAX_AGE_MS,
  readFromCache,
  resolveCacheDir,
  writeToCache,
} from "./http-cache.js";

/**
 * Hard ceiling on retry backoff. Even with a slow `Retry-After` header we
 * don't park a request for longer than this — better to surface the error
 * to the caller and let them decide.
 */
const MAX_BACKOFF_MS = 30_000;

/**
 * Single-attempt fetch error annotated with the HTTP status (if any) and
 * whether the attempt should be retried. Plain `Error` works too, but a
 * typed shape lets `fetchUrl`'s retry loop reason about status without
 * regex-matching error messages.
 */
class FetchAttemptError extends Error {
  /** HTTP status code if the request reached the server, otherwise undefined. */
  status?: number;
  /** Whether `fetchUrl`'s retry loop should try again. */
  retryable: boolean;
  /** Optional Retry-After delay in ms (parsed from response header). */
  retryAfterMs?: number;

  constructor(
    message: string,
    opts: { status?: number; retryable: boolean; retryAfterMs?: number },
  ) {
    super(message);
    this.name = "FetchAttemptError";
    this.status = opts.status;
    this.retryable = opts.retryable;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

/**
 * Fetch HTML from a URL with timeout, redirect handling, a response-size
 * cap, and (optionally) retry-on-transient-failure with exponential backoff.
 *
 * Transient failures eligible for retry:
 * - Network errors (ECONNRESET, ECONNREFUSED, DNS failures, AbortError on timeout)
 * - HTTP 5xx
 * - HTTP 429 (with `Retry-After` honored when present)
 *
 * Non-retryable failures (raised on the first attempt):
 * - HTTP 4xx other than 429
 * - Response exceeds `maxBytes`
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  // Cache lookup happens BEFORE any network attempt — a cache hit avoids
  // the request entirely (and the retry loop, the timeout, the size check).
  const cacheDir = resolveCacheDir(options.cache);
  const cacheMaxAge = options.cacheMaxAge ?? DEFAULT_CACHE_MAX_AGE_MS;
  if (cacheDir) {
    const cached = await readFromCache(cacheDir, url, cacheMaxAge);
    if (cached !== null) return cached;
  }

  const body = await fetchWithRetry(url, options);

  if (cacheDir) {
    // Awaited so a subsequent fetchUrl for the same URL sees the entry —
    // otherwise back-to-back requests can race with the write and miss the
    // cache. The write is a single small JSON file; cost is negligible.
    // writeToCache swallows errors internally.
    await writeToCache(cacheDir, url, body);
  }

  return body;
}

async function fetchWithRetry(
  url: string,
  options: FetchOptions,
): Promise<string> {
  const maxAttempts = Math.max(1, (options.retries ?? 2) + 1);
  const baseDelay = Math.max(0, options.retryDelay ?? 500);

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchOnce(url, options);
    } catch (error) {
      lastError = error;
      const isAttemptError = error instanceof FetchAttemptError;
      const retryable = isAttemptError ? error.retryable : false;

      if (!retryable || attempt === maxAttempts - 1) {
        break;
      }

      const retryAfter = isAttemptError ? error.retryAfterMs : undefined;
      const delay = computeBackoffDelay(attempt, baseDelay, retryAfter);
      await sleep(delay);
    }
  }

  // Normalise the surfaced error: callers shouldn't have to know about our
  // internal FetchAttemptError type.
  if (lastError instanceof FetchAttemptError) {
    throw new Error(`Failed to fetch URL: ${lastError.message}`);
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error(`Failed to fetch URL: ${String(lastError)}`);
}

/**
 * One HTTP attempt with timeout, redirect handling, and size cap. Throws a
 * `FetchAttemptError` whose `retryable` flag controls what the outer retry
 * loop does next.
 */
async function fetchOnce(url: string, options: FetchOptions): Promise<string> {
  const timeout = options.timeout ?? DEFAULT_FETCH_TIMEOUT;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const followRedirects = options.followRedirects ?? true;
  const maxBytes = options.maxBytes ?? DEFAULT_FETCH_MAX_BYTES;

  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        signal: controller.signal,
        redirect: followRedirects ? "follow" : "manual",
      });
    } catch (err) {
      // Network-layer failure (DNS, TCP, timeout-via-abort). All retryable.
      if (err instanceof Error && err.name === "AbortError") {
        throw new FetchAttemptError(`Request timeout after ${timeout}ms`, {
          retryable: true,
        });
      }
      throw new FetchAttemptError(
        err instanceof Error ? err.message : String(err),
        { retryable: true },
      );
    }

    if (!response.ok) {
      const status = response.status;
      const retryable = status === 429 || (status >= 500 && status < 600);
      const retryAfterMs = retryable
        ? parseRetryAfter(response.headers?.get("retry-after"))
        : undefined;
      throw new FetchAttemptError(`HTTP ${status}: ${response.statusText}`, {
        status,
        retryable,
        retryAfterMs,
      });
    }

    // Cheap pre-check: trust Content-Length when present so we can fail fast
    // before reading anything off the wire. Guarded so test mocks that return
    // a bare Response-shaped object without a headers map still work.
    const contentLength = response.headers?.get("content-length");
    if (contentLength) {
      const declared = Number.parseInt(contentLength, 10);
      if (Number.isFinite(declared) && declared > maxBytes) {
        controller.abort();
        throw new FetchAttemptError(
          `Response too large: Content-Length ${declared} exceeds maxBytes ${maxBytes}`,
          { retryable: false },
        );
      }
    }

    // Stream the body so we can stop early if a server lies about / omits
    // Content-Length and sends more than maxBytes anyway.
    return await readBodyWithLimit(response, maxBytes, controller);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
  controller: AbortController,
): Promise<string> {
  if (!response.body) {
    // No streaming body (e.g. some test/mock environments) — fall back to
    // buffered read but still enforce the cap on the resulting string.
    const text = await response.text();
    if (Buffer.byteLength(text, "utf-8") > maxBytes) {
      throw new FetchAttemptError(
        `Response too large: body exceeds maxBytes ${maxBytes}`,
        { retryable: false },
      );
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        controller.abort();
        throw new FetchAttemptError(
          `Response too large: body exceeds maxBytes ${maxBytes}`,
          { retryable: false },
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

/**
 * Compute the delay before the next retry attempt. Prefers an explicit
 * Retry-After value when the server gave one, otherwise falls back to
 * exponential backoff (base * 2^attempt) with up to 25% jitter to spread
 * retries from a thundering herd of clients.
 */
function computeBackoffDelay(
  attempt: number,
  baseDelay: number,
  retryAfterMs: number | undefined,
): number {
  if (retryAfterMs !== undefined) {
    return Math.min(retryAfterMs, MAX_BACKOFF_MS);
  }
  const expBackoff = baseDelay * 2 ** attempt;
  const jitter = expBackoff * 0.25 * Math.random();
  return Math.min(expBackoff + jitter, MAX_BACKOFF_MS);
}

/**
 * Parse a `Retry-After` header. Supports the two forms RFC 9110 allows:
 * seconds (e.g. `"120"`) or HTTP-date (e.g. `"Wed, 21 Oct 2026 07:28:00 GMT"`).
 * Returns the delay in milliseconds, or undefined for unparseable input.
 */
function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const seconds = Number.parseInt(trimmed, 10);
  if (Number.isFinite(seconds) && !trimmed.includes(" ")) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
