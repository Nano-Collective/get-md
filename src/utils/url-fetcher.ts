// src/utils/url-fetcher.ts

import { DEFAULT_FETCH_TIMEOUT, DEFAULT_USER_AGENT } from "../config.js";
import type { FetchOptions } from "../types.js";

/**
 * Fetch HTML from a URL with timeout and redirect handling
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const timeout = options.timeout ?? DEFAULT_FETCH_TIMEOUT;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const followRedirects = options.followRedirects ?? true;

  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    ...options.headers,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: followRedirects ? "follow" : "manual",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return html;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw new Error(`Failed to fetch URL: ${error.message}`);
    }
    throw error;
  }
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
