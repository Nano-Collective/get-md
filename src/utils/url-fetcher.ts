// src/utils/url-fetcher.ts

import {
  DEFAULT_FETCH_MAX_BYTES,
  DEFAULT_FETCH_TIMEOUT,
  DEFAULT_USER_AGENT,
} from "../config.js";
import type { FetchOptions } from "../types.js";

/**
 * Fetch HTML from a URL with timeout, redirect handling, and a response-size
 * cap so a hostile server can't make the converter buffer unbounded HTML.
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
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
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: followRedirects ? "follow" : "manual",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Cheap pre-check: trust Content-Length when present so we can fail fast
    // before reading anything off the wire. Guarded so test mocks that return
    // a bare Response-shaped object without a headers map still work.
    const contentLength = response.headers?.get("content-length");
    if (contentLength) {
      const declared = Number.parseInt(contentLength, 10);
      if (Number.isFinite(declared) && declared > maxBytes) {
        controller.abort();
        throw new Error(
          `Response too large: Content-Length ${declared} exceeds maxBytes ${maxBytes}`,
        );
      }
    }

    // Stream the body so we can stop early if a server lies about / omits
    // Content-Length and sends more than maxBytes anyway.
    return await readBodyWithLimit(response, maxBytes, controller);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw new Error(`Failed to fetch URL: ${error.message}`);
    }
    throw error;
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
      throw new Error(`Response too large: body exceeds maxBytes ${maxBytes}`);
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
        throw new Error(
          `Response too large: body exceeds maxBytes ${maxBytes}`,
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
