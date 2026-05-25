// src/utils/config-loader.ts

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type {
  LlmConfig,
  LocalLlamaConfig,
  MarkdownOptions,
  RemoteLlmConfig,
  SdkProvider,
} from "../types.js";
import { substituteEnvVars } from "./env-substitution.js";

/**
 * Configuration schema for .getmdrc or get-md.config.json
 */
export interface GetMdConfig {
  /** Use LLM for HTML to Markdown conversion */
  useLLM?: boolean;
  /**
   * Pluggable LLM backend. Takes precedence over the legacy
   * `llmModelPath`/`llmTemperature` shorthand. Supports `${ENV_VAR}` in
   * string values so API keys can live in env vars rather than the file.
   */
  llm?: LlmConfig;
  /** Custom path to the LLM model file (legacy shorthand for llm.modelPath) */
  llmModelPath?: string;
  /** LLM temperature for generation */
  llmTemperature?: number;
  /** Fall back to Turndown if LLM fails */
  llmFallback?: boolean;
  /** Extract main content using Readability */
  extractContent?: boolean;
  /** Include metadata as YAML frontmatter */
  includeMeta?: boolean;
  /** Include images in output */
  includeImages?: boolean;
  /** Include links in output */
  includeLinks?: boolean;
  /** Include tables in output */
  includeTables?: boolean;
  /** Aggressive noise removal */
  aggressiveCleanup?: boolean;
  /** Maximum output length */
  maxLength?: number;
}

/**
 * Supported config file names in order of priority
 */
const CONFIG_FILE_NAMES = [
  ".getmdrc",
  ".getmdrc.json",
  "get-md.config.json",
  "getmd.config.json",
];

/**
 * Search for a config file in the given directory
 */
function findConfigInDir(dir: string): string | null {
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = path.join(dir, fileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Load and parse a config file. Environment variable references like
 * `${OPENROUTER_API_KEY}` are expanded before validation so secrets never
 * need to live in the file itself.
 */
function loadConfigFile(filePath: string): GetMdConfig {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const rawConfig = JSON.parse(content);
    const substituted = substituteEnvVars(rawConfig);
    return validateConfig(substituted);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config from ${filePath}: ${message}`);
  }
}

/**
 * Validate config values and return a clean config object
 */
function validateConfig(config: unknown): GetMdConfig {
  if (typeof config !== "object" || config === null) {
    throw new Error("Config must be a JSON object");
  }

  const result: GetMdConfig = {};
  const cfg = config as Record<string, unknown>;

  // Validate boolean options
  const booleanKeys: (keyof GetMdConfig)[] = [
    "useLLM",
    "llmFallback",
    "extractContent",
    "includeMeta",
    "includeImages",
    "includeLinks",
    "includeTables",
    "aggressiveCleanup",
  ];

  for (const key of booleanKeys) {
    if (key in cfg) {
      const value = cfg[key];
      if (typeof value !== "boolean") {
        throw new Error(`Config option "${key}" must be a boolean`);
      }
      (result as Record<string, boolean>)[key] = value;
    }
  }

  // Validate string options
  if ("llmModelPath" in cfg) {
    if (typeof cfg.llmModelPath !== "string") {
      throw new Error('Config option "llmModelPath" must be a string');
    }
    result.llmModelPath = cfg.llmModelPath;
  }

  // Validate number options
  if ("llmTemperature" in cfg) {
    if (typeof cfg.llmTemperature !== "number") {
      throw new Error('Config option "llmTemperature" must be a number');
    }
    if (cfg.llmTemperature < 0 || cfg.llmTemperature > 2) {
      throw new Error('Config option "llmTemperature" must be between 0 and 2');
    }
    result.llmTemperature = cfg.llmTemperature;
  }

  if ("maxLength" in cfg) {
    if (typeof cfg.maxLength !== "number" || !Number.isInteger(cfg.maxLength)) {
      throw new Error('Config option "maxLength" must be an integer');
    }
    if (cfg.maxLength < 0) {
      throw new Error('Config option "maxLength" must be positive');
    }
    result.maxLength = cfg.maxLength;
  }

  if ("llm" in cfg) {
    result.llm = validateLlmConfig(cfg.llm);
  }

  return result;
}

const VALID_SDK_PROVIDERS: readonly SdkProvider[] = [
  "openai-compatible",
  "anthropic",
  "google",
  "local-llama",
];

function validateLlmConfig(raw: unknown): LlmConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error('Config option "llm" must be an object');
  }
  const llm = raw as Record<string, unknown>;

  const sdkProvider = llm.sdkProvider;
  if (
    typeof sdkProvider !== "string" ||
    !VALID_SDK_PROVIDERS.includes(sdkProvider as SdkProvider)
  ) {
    throw new Error(
      `Config option "llm.sdkProvider" must be one of: ${VALID_SDK_PROVIDERS.join(", ")}`,
    );
  }

  // Shared optional fields — same rules across every provider.
  const name = optionalString(llm, "llm.name");
  const temperature = optionalNumber(llm, "llm.temperature", {
    min: 0,
    max: 2,
  });
  const maxTokens = optionalInteger(llm, "llm.maxTokens", { min: 1 });

  if (sdkProvider === "local-llama") {
    const modelPath = optionalString(llm, "llm.modelPath");
    const local: LocalLlamaConfig = { sdkProvider: "local-llama" };
    if (name !== undefined) local.name = name;
    if (temperature !== undefined) local.temperature = temperature;
    if (maxTokens !== undefined) local.maxTokens = maxTokens;
    if (modelPath !== undefined) local.modelPath = modelPath;
    return local;
  }

  // Remote providers require `model`.
  if (typeof llm.model !== "string" || llm.model.length === 0) {
    throw new Error(
      `Config option "llm.model" is required for sdkProvider "${sdkProvider}"`,
    );
  }
  const baseUrl = optionalString(llm, "llm.baseUrl");
  const apiKey = optionalString(llm, "llm.apiKey");

  if (sdkProvider === "openai-compatible" && !baseUrl) {
    throw new Error(
      'Config option "llm.baseUrl" is required for sdkProvider "openai-compatible"',
    );
  }

  const remote: RemoteLlmConfig = {
    sdkProvider: sdkProvider as RemoteLlmConfig["sdkProvider"],
    model: llm.model,
  };
  if (name !== undefined) remote.name = name;
  if (temperature !== undefined) remote.temperature = temperature;
  if (maxTokens !== undefined) remote.maxTokens = maxTokens;
  if (baseUrl !== undefined) remote.baseUrl = baseUrl;
  if (apiKey !== undefined) remote.apiKey = apiKey;
  return remote;
}

function optionalString(
  obj: Record<string, unknown>,
  fieldPath: string,
): string | undefined {
  const key = fieldPath.split(".").pop() as string;
  if (!(key in obj)) return undefined;
  const value = obj[key];
  if (typeof value !== "string") {
    throw new Error(`Config option "${fieldPath}" must be a string`);
  }
  return value;
}

function optionalNumber(
  obj: Record<string, unknown>,
  fieldPath: string,
  bounds?: { min?: number; max?: number },
): number | undefined {
  const key = fieldPath.split(".").pop() as string;
  if (!(key in obj)) return undefined;
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Config option "${fieldPath}" must be a number`);
  }
  if (bounds?.min !== undefined && value < bounds.min) {
    throw new Error(`Config option "${fieldPath}" must be >= ${bounds.min}`);
  }
  if (bounds?.max !== undefined && value > bounds.max) {
    throw new Error(`Config option "${fieldPath}" must be <= ${bounds.max}`);
  }
  return value;
}

function optionalInteger(
  obj: Record<string, unknown>,
  fieldPath: string,
  bounds?: { min?: number; max?: number },
): number | undefined {
  const value = optionalNumber(obj, fieldPath, bounds);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) {
    throw new Error(`Config option "${fieldPath}" must be an integer`);
  }
  return value;
}

/**
 * Load configuration from file(s)
 *
 * Searches for config files in the following order:
 * 1. Current working directory
 * 2. Home directory (~/.getmdrc)
 *
 * Config from CWD takes precedence over home directory config.
 *
 * @returns Merged config from all found config files, or empty object if none found
 */
export function loadConfig(): GetMdConfig {
  let config: GetMdConfig = {};

  // 1. Load from home directory (lowest priority)
  const homeConfig = findConfigInDir(os.homedir());
  if (homeConfig) {
    config = { ...config, ...loadConfigFile(homeConfig) };
  }

  // 2. Load from current working directory (highest priority)
  const cwdConfig = findConfigInDir(process.cwd());
  if (cwdConfig) {
    config = { ...config, ...loadConfigFile(cwdConfig) };
  }

  return config;
}

/**
 * Load configuration from a specific file path
 *
 * @param filePath Path to the config file
 * @returns Parsed config object
 */
export function loadConfigFromFile(filePath: string): GetMdConfig {
  return loadConfigFile(filePath);
}

/**
 * Find the config file path that would be loaded
 *
 * @returns Path to the config file, or null if none found
 */
export function findConfigPath(): string | null {
  // Check CWD first (takes precedence)
  const cwdConfig = findConfigInDir(process.cwd());
  if (cwdConfig) {
    return cwdConfig;
  }

  // Then check home directory
  const homeConfig = findConfigInDir(os.homedir());
  if (homeConfig) {
    return homeConfig;
  }

  return null;
}

/**
 * Merge loaded config with options, with options taking precedence
 *
 * @param config Loaded config
 * @param options User-provided options (CLI flags or SDK options)
 * @returns Merged options
 */
export function mergeConfigWithOptions(
  config: GetMdConfig,
  options: MarkdownOptions,
): MarkdownOptions {
  // Start with config as base, then override with explicit options
  const merged: MarkdownOptions = { ...config };

  // Only override with options that are explicitly set (not undefined)
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}
