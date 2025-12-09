// src/types.ts

// ============================================================================
// LLM Event Types
// ============================================================================

/** Event emitted when checking for model availability */
export interface LLMModelCheckEvent {
  type: "model-check";
  status: "checking" | "found" | "not-found";
  path?: string;
}

/** Event emitted when model download starts */
export interface LLMDownloadStartEvent {
  type: "download-start";
  modelName: string;
  totalSize: number;
}

/** Event emitted during model download progress */
export interface LLMDownloadProgressEvent {
  type: "download-progress";
  downloaded: number;
  total: number;
  percentage: number;
  speed?: string;
}

/** Event emitted when model download completes */
export interface LLMDownloadCompleteEvent {
  type: "download-complete";
  path: string;
  size: number;
}

/** Event emitted when model download fails */
export interface LLMDownloadErrorEvent {
  type: "download-error";
  error: Error;
}

/** Event emitted when model is loading */
export interface LLMModelLoadingEvent {
  type: "model-loading";
  modelName: string;
}

/** Event emitted when model has loaded */
export interface LLMModelLoadedEvent {
  type: "model-loaded";
  loadTime: number;
}

/** Event emitted when conversion starts */
export interface LLMConversionStartEvent {
  type: "conversion-start";
  inputSize: number;
}

/** Event emitted during conversion progress */
export interface LLMConversionProgressEvent {
  type: "conversion-progress";
  tokensProcessed?: number;
}

/** Event emitted when conversion completes */
export interface LLMConversionCompleteEvent {
  type: "conversion-complete";
  outputSize: number;
  duration: number;
}

/** Event emitted when conversion fails */
export interface LLMConversionErrorEvent {
  type: "conversion-error";
  error: Error;
}

/** Event emitted when falling back to Turndown */
export interface LLMFallbackStartEvent {
  type: "fallback-start";
  reason: string;
}

/** Union of all LLM events */
export type LLMEvent =
  | LLMModelCheckEvent
  | LLMDownloadStartEvent
  | LLMDownloadProgressEvent
  | LLMDownloadCompleteEvent
  | LLMDownloadErrorEvent
  | LLMModelLoadingEvent
  | LLMModelLoadedEvent
  | LLMConversionStartEvent
  | LLMConversionProgressEvent
  | LLMConversionCompleteEvent
  | LLMConversionErrorEvent
  | LLMFallbackStartEvent;

/** Callback for LLM events */
export type LLMEventCallback = (event: LLMEvent) => void | Promise<void>;

// ============================================================================
// LLM Utility Types
// ============================================================================

/** Result from checking LLM model availability */
export interface LLMModelStatus {
  /** Whether the model is available locally */
  available: boolean;
  /** Path to the model file */
  path?: string;
  /** Size of the model file in bytes */
  size?: number;
  /** Human-readable size (e.g., "986MB") */
  sizeFormatted?: string;
  /** Model version identifier */
  version?: string;
}

/** Options for downloading the LLM model */
export interface LLMDownloadOptions {
  /** Custom path to save the model */
  modelPath?: string;
  /** Progress callback */
  onProgress?: (downloaded: number, total: number, percentage: number) => void;
  /** Completion callback */
  onComplete?: (path: string) => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

/** Information about available LLM models */
export interface LLMModelInfo {
  /** Default storage path */
  defaultPath: string;
  /** Recommended model name */
  recommendedModel: string;
  /** List of available model variants */
  availableModels: LLMModelVariant[];
}

/** Information about a specific model variant */
export interface LLMModelVariant {
  /** Model name */
  name: string;
  /** Size in bytes */
  size: number;
  /** Quantization type (e.g., "Q4_K_M") */
  quantization: string;
  /** Estimated RAM required */
  ramRequired: string;
}

// ============================================================================
// Main Options Interface
// ============================================================================

/** Options for HTML to Markdown conversion */
export interface MarkdownOptions {
  /** Extract only main content using Readability (default: true) */
  extractContent?: boolean;

  /** Include metadata as YAML frontmatter (default: true) */
  includeMeta?: boolean;

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

  /** Force treat input as URL (bypasses auto-detection) */
  isUrl?: boolean;

  /** Request timeout in milliseconds (default: 15000) */
  timeout?: number;

  /** Follow redirects (default: true) */
  followRedirects?: boolean;

  /** Maximum redirects to follow (default: 5) */
  maxRedirects?: number;

  /** Custom headers for URL fetching */
  headers?: Record<string, string>;

  /** User agent string for URL fetching */
  userAgent?: string;

  // ========================================================================
  // LLM Options
  // ========================================================================

  /** Use LLM for HTML to Markdown conversion (default: false) */
  useLLM?: boolean;

  /** Custom path to the LLM model file */
  llmModelPath?: string;

  /** LLM temperature for generation (default: 0.1) */
  llmTemperature?: number;

  /** Maximum tokens for LLM generation (default: 512000) */
  llmMaxTokens?: number;

  /** Fall back to Turndown if LLM fails (default: true) */
  llmFallback?: boolean;

  /** Callback for all LLM events */
  onLLMEvent?: LLMEventCallback;

  /** Simplified callback for download progress */
  onDownloadProgress?: (
    downloaded: number,
    total: number,
    percentage: number,
  ) => void;

  /** Simplified callback for model status changes */
  onModelStatus?: (
    status: "checking" | "loading" | "loaded" | "not-found",
  ) => void;

  /** Simplified callback for conversion progress */
  onConversionProgress?: (progress: {
    stage: string;
    percentage?: number;
  }) => void;
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
  filter: string | string[] | ((node: TurndownNode) => boolean);

  /** Replacement function */
  replacement: (content: string, node: TurndownNode) => string;
}

/** Turndown DOM node type */
export interface TurndownNode {
  nodeName: string;
  textContent?: string | null;
  outerHTML?: string;
  className?: string;
  alt?: string;
  src?: string;
  title?: string;
  querySelector?: (selector: string) => TurndownNode | null;
  getAttribute?: (name: string) => string | null;
}
