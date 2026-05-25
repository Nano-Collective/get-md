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

/** Event emitted when llama.cpp initialization starts */
export interface LLMInitStartEvent {
  type: "llama-init-start";
}

/** Event emitted when llama.cpp initialization completes */
export interface LLMInitCompleteEvent {
  type: "llama-init-complete";
}

/** Event emitted when model file is being loaded */
export interface LLMModelFileLoadingEvent {
  type: "model-file-loading";
  path: string;
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
  | LLMInitStartEvent
  | LLMInitCompleteEvent
  | LLMModelFileLoadingEvent
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
  /** Human-readable size (e.g., "1.12GB") */
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
// Pluggable LLM Backend
// ============================================================================

/**
 * SDK backend used to run LLM-powered HTML→Markdown conversion.
 *
 * - `openai-compatible` — covers Ollama, OpenRouter, Together, Groq, LM Studio,
 *   the llama.cpp server, OpenAI itself, vLLM, etc. The default for remote.
 * - `anthropic` — Claude API.
 * - `google` — Gemini.
 * - `local-llama` — local ReaderLM-v2 inference via `node-llama-cpp`.
 *   This is the default if `useLLM: true` and no `llm` block is configured —
 *   keeps the existing zero-API-key path working out of the box.
 */
export type SdkProvider =
  | "openai-compatible"
  | "anthropic"
  | "google"
  | "local-llama";

/** Shared fields across every provider variant */
interface LlmConfigBase {
  /** Optional display name (e.g. "OpenRouter", "Ollama") */
  name?: string;
  /** Sampling temperature (default: 0.1) */
  temperature?: number;
  /** Max tokens for context (input + generation). Default: 8192 */
  maxTokens?: number;
}

/** Local llama.cpp / ReaderLM-v2 configuration */
export interface LocalLlamaConfig extends LlmConfigBase {
  sdkProvider: "local-llama";
  /** Override the GGUF path. Defaults to ~/.get-md/models/ReaderLM-v2.Q4_K_M.gguf */
  modelPath?: string;
}

/** Configuration for any remote SDK provider (openai-compatible, anthropic, google) */
export interface RemoteLlmConfig extends LlmConfigBase {
  sdkProvider: "openai-compatible" | "anthropic" | "google";
  /** Base URL for the provider API. Required for openai-compatible. */
  baseUrl?: string;
  /**
   * API key. Supports `${ENV_VAR}` substitution when loaded from a config
   * file so the key never lives in the file itself.
   */
  apiKey?: string;
  /** Model identifier passed to the provider, e.g. `anthropic/claude-haiku-4.5` */
  model: string;
}

/** Resolved LLM configuration — discriminated by sdkProvider */
export type LlmConfig = LocalLlamaConfig | RemoteLlmConfig;

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

  /** Maximum response body size for URL fetches, in bytes (default: 10MB) */
  maxBytes?: number;

  // ========================================================================
  // LLM Options
  // ========================================================================

  /**
   * Pluggable LLM backend configuration. When set, takes precedence over the
   * legacy `llmModelPath` / `llmTemperature` / `llmMaxTokens` shorthand. If
   * `useLLM` is true and `llm` is unset, get-md defaults to local ReaderLM-v2
   * via `node-llama-cpp` — keeps the zero-API-key path working unchanged.
   *
   * @example
   * ```ts
   * // Remote provider (OpenAI-compatible, covers Ollama/OpenRouter/etc.)
   * await convertToMarkdown(url, {
   *   useLLM: true,
   *   llm: {
   *     sdkProvider: 'openai-compatible',
   *     baseUrl: 'https://openrouter.ai/api/v1',
   *     apiKey: process.env.OPENROUTER_API_KEY,
   *     model: 'anthropic/claude-haiku-4.5',
   *   },
   * });
   * ```
   */
  llm?: LlmConfig;

  /** Use LLM for HTML to Markdown conversion (default: false) */
  useLLM?: boolean;

  /**
   * Custom path to the LLM model file. Legacy shorthand for
   * `llm: { sdkProvider: 'local-llama', modelPath: ... }`.
   */
  llmModelPath?: string;

  /** LLM temperature for generation (default: 0.1) */
  llmTemperature?: number;

  /**
   * Maximum tokens for the LLM context window (input + generation), in tokens.
   * Defaults to 8192. The converter caps this at 32768 (Qwen2.5 native context)
   * to prevent OOM on the local llama.cpp path; remote SDK providers honor the
   * value directly.
   */
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

  /**
   * Estimated token count of the output markdown, using a chars/4 heuristic.
   * Useful for LLM context budgeting. For an exact count, run the markdown
   * through your target model's tokenizer.
   */
  estimatedTokens: number;
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

  /**
   * Maximum response body size in bytes (default: 10MB). The fetch is aborted
   * with a clear error if the response exceeds this limit. Use Infinity to
   * disable the cap (not recommended for untrusted URLs).
   */
  maxBytes?: number;
}

// ============================================================================
// Batch conversion
// ============================================================================

/** Per-URL progress event surfaced via `BatchOptions.onProgress` */
export interface BatchProgress {
  /** Number of URLs completed (success or error) */
  completed: number;
  /** Total URLs in the batch */
  total: number;
  /** The URL that just finished */
  url: string;
  /** Status of the URL that just finished */
  status: "ok" | "error";
}

/** Options for `convertBatch` / `convertBatchAll` */
export interface BatchOptions extends MarkdownOptions {
  /**
   * Maximum number of conversions running in parallel. Default: 5.
   * Pick conservatively when hitting remote LLM providers — most have rate
   * limits well below "as fast as you can".
   */
  concurrency?: number;

  /**
   * When true (default), URL failures don't abort the batch — they surface
   * as `BatchResult` entries with status `'error'`. When false, the iterator
   * throws on the first failure.
   */
  continueOnError?: boolean;

  /**
   * Called once per URL as it completes. Useful for progress bars in CLI /
   * UI integrations.
   */
  onProgress?: (progress: BatchProgress) => void | Promise<void>;
}

/**
 * One entry in a batch result. Discriminated by `status` so TypeScript narrows
 * to either the successful payload or the error payload after a check.
 */
export type BatchResult =
  | {
      status: "ok";
      url: string;
      markdown: string;
      metadata: ContentMetadata;
      stats: ConversionStats;
    }
  | {
      status: "error";
      url: string;
      error: Error;
    };

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
