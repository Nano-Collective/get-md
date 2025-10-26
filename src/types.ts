// src/types.ts

/** Options for HTML to Markdown conversion */
export interface MarkdownOptions {
  /** Extract only main content using Readability (default: true) */
  extractContent?: boolean;

  /** Include metadata as YAML frontmatter (default: false) */
  includeMeta?: boolean;

  /** LLM-optimized formatting (default: true) */
  llmOptimized?: boolean;

  /** Custom Turndown rules */
  customRules?: TurndownRule[];

  /** Preserve specific HTML elements as HTML */
  preserveElements?: string[];

  /** Maximum content length in characters (default: 1000000) */
  maxLength?: number;

  /** Base URL for resolving relative links */
  baseUrl?: string;

  /** Include images (default: true) */
  includeImages?: boolean;

  /** Include links (default: true) */
  includeLinks?: boolean;

  /** Include tables (default: true) */
  includeTables?: boolean;

  /** Aggressive noise removal (default: true) */
  aggressiveCleanup?: boolean;
}

/** Result from markdown conversion */
export interface MarkdownResult {
  /** Generated markdown content */
  markdown: string;

  /** Extracted metadata */
  metadata: ContentMetadata;

  /** Conversion statistics */
  stats: ConversionStats;
}

/** Extracted content metadata */
export interface ContentMetadata {
  /** Page title */
  title?: string;

  /** Author/byline */
  author?: string;

  /** Excerpt/description */
  excerpt?: string;

  /** Site name */
  siteName?: string;

  /** Publication date */
  publishedTime?: string;

  /** Language code */
  language?: string;

  /** Canonical URL */
  canonicalUrl?: string;

  /** Reading time estimate (minutes) */
  readingTime?: number;

  /** Word count */
  wordCount?: number;
}

/** Conversion statistics */
export interface ConversionStats {
  /** Input HTML length */
  inputLength: number;

  /** Output markdown length */
  outputLength: number;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Whether Readability extraction succeeded */
  readabilitySuccess: boolean;

  /** Number of images found */
  imageCount: number;

  /** Number of links found */
  linkCount: number;
}

/** Options for JSON extraction */
export interface JsonExtractionOptions {
  /** Use automatic selector detection (default: true) */
  autoDetect?: boolean;

  /** Custom CSS selectors for schema fields */
  selectors?: Record<string, string>;

  /** Strict schema validation (default: true) */
  strict?: boolean;

  /** Return partial results on validation error (default: false) */
  partial?: boolean;

  /** Base URL for resolving relative URLs */
  baseUrl?: string;
}

/** JSON Schema definition */
export interface JsonSchema {
  /** JSON Schema object */
  schema: Record<string, any>;

  /** Optional description of what to extract */
  description?: string;
}

/** Result from JSON extraction */
export interface JsonResult<T = any> {
  /** Extracted data matching schema */
  data: T;

  /** Extraction statistics */
  stats: ExtractionStats;

  /** Warnings from extraction process */
  warnings?: string[];
}

/** Extraction statistics */
export interface ExtractionStats {
  /** Input HTML length */
  inputLength: number;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Number of fields extracted */
  fieldsExtracted: number;

  /** Number of fields missing */
  fieldsMissing: number;
}

/** Options for URL fetching */
export interface FetchOptions {
  /** Request timeout in milliseconds (default: 15000) */
  timeout?: number;

  /** Follow redirects (default: true) */
  followRedirects?: boolean;

  /** Maximum redirects to follow (default: 5) */
  maxRedirects?: number;

  /** Custom headers */
  headers?: Record<string, string>;

  /** User agent string */
  userAgent?: string;
}

/** Custom Turndown rule */
export interface TurndownRule {
  /** Rule name */
  name: string;

  /** Filter for elements to apply rule to */
  filter: string | string[] | ((node: any) => boolean);

  /** Replacement function */
  replacement: (content: string, node: any) => string;
}
