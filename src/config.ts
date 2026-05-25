// src/config.ts

/** Default user agent for fetching URLs */
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; get-md/1.0; +https://github.com/nano-collective/get-md)";

/** Default timeout for URL fetching (15 seconds) */
export const DEFAULT_FETCH_TIMEOUT = 15000;

/**
 * Default cap on the size of an HTML response read by `fetchUrl`, in bytes.
 * Prevents a hostile or misbehaving server from forcing the converter to
 * buffer an unbounded amount of HTML into memory. 10MB is well above any
 * legitimate article and still leaves plenty of headroom for content-heavy
 * pages (long blog posts, docs sites).
 */
export const DEFAULT_FETCH_MAX_BYTES = 10 * 1024 * 1024;
