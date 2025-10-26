// src/config.ts

import type { MarkdownOptions } from './types.js';

/** Default configuration for markdown conversion */
export const DEFAULT_MARKDOWN_OPTIONS: Required<MarkdownOptions> = {
  extractContent: true,
  includeMeta: true,
  llmOptimized: true,
  customRules: [],
  preserveElements: [],
  maxLength: 1000000,
  baseUrl: undefined as any,
  includeImages: true,
  includeLinks: true,
  includeTables: true,
  aggressiveCleanup: true,
};

/** Default user agent for fetching URLs */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; get-md/1.0; +https://github.com/nano-collective/get-md)';

/** Default timeout for URL fetching (15 seconds) */
export const DEFAULT_FETCH_TIMEOUT = 15000;
