// src/utils/config-loader.ts

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { MarkdownOptions } from "../types.js";

/**
 * Configuration schema for .getmdrc or get-md.config.json
 */
export interface GetMdConfig {
  /** Use LLM for HTML to Markdown conversion */
  useLLM?: boolean;
  /** Custom path to the LLM model file */
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
 * Load and parse a config file
 */
function loadConfigFile(filePath: string): GetMdConfig {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const config = JSON.parse(content);
    return validateConfig(config);
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

  return result;
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
