#!/usr/bin/env node

// src/cli.ts

import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { Presets, SingleBar } from "cli-progress";
import { Command } from "commander";
import { convertBatch } from "./batch.js";
import {
  checkLLMModel,
  convertToMarkdown,
  downloadLLMModel,
  getLLMModelInfo,
  removeLLMModel,
} from "./index.js";
import { parseSitemap } from "./sitemap.js";
import type {
  ConversionStats,
  LLMEvent,
  LlmConfig,
  MarkdownOptions,
  SdkProvider,
} from "./types.js";
import {
  findConfigPath,
  loadConfig,
  mergeConfigWithOptions,
} from "./utils/config-loader.js";
import {
  DEFAULT_NAME_PATTERN,
  uniqueFilenameForUrl,
} from "./utils/filename.js";

interface CliOptions {
  output?: string;
  extract: boolean;
  frontmatter: boolean;
  images: boolean;
  links: boolean;
  tables: boolean;
  maxLength: string;
  baseUrl?: string;
  verbose?: boolean;
  // LLM options
  useLlm?: boolean;
  llmModelPath?: string;
  llmTemperature?: string;
  // Pluggable LLM backend
  llmProvider?: string;
  llmBaseUrl?: string;
  llmModel?: string;
  llmApiKey?: string;
  // Model management
  downloadModel?: boolean;
  modelInfo?: boolean;
  removeModel?: boolean;
  modelPath?: boolean;
  // Config
  config?: string;
  showConfig?: boolean;
  // Comparison mode
  compare?: boolean;
  // Output format
  json?: boolean;
  // Batch mode
  batch?: string;
  concurrency?: string;
  namePattern?: string;
  manifest?: string;
  stopOnError?: boolean;
  // Sitemap mode
  sitemap?: string;
  include?: string[];
  exclude?: string[];
  maxDepth?: string;
  maxUrls?: string;
}

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("get-md")
  .description("Convert HTML to LLM-optimized Markdown")
  .version(pkg.version);

// Main conversion command
program
  .argument("[input]", "HTML file path, URL, or stdin")
  .option("-o, --output <file>", "Output file (default: stdout)")
  .option("--no-extract", "Disable Readability content extraction")
  .option("--no-frontmatter", "Exclude metadata from YAML frontmatter")
  .option("--no-images", "Remove images from output")
  .option("--no-links", "Remove links from output")
  .option("--no-tables", "Remove tables from output")
  .option("--max-length <n>", "Maximum output length", "1000000")
  .option("--base-url <url>", "Base URL for resolving relative links")
  .option("-v, --verbose", "Verbose output")
  // LLM options
  .option("--use-llm", "Use LLM for higher quality HTML to Markdown conversion")
  .option("--llm-model-path <path>", "Custom path to LLM model file")
  .option("--llm-temperature <n>", "LLM temperature (default: 0.1)")
  // Pluggable LLM backend (override config file)
  .option(
    "--llm-provider <name>",
    "LLM provider: openai-compatible | anthropic | google | local-llama (default: local-llama)",
  )
  .option(
    "--llm-base-url <url>",
    "Base URL for the LLM provider (required for openai-compatible)",
  )
  .option("--llm-model <id>", "Model identifier for the LLM provider")
  .option(
    "--llm-api-key <key>",
    "API key for the LLM provider (prefer env vars + config file)",
  )
  // Model management commands
  .option("--download-model", "Download the LLM model")
  .option("--model-info", "Show LLM model information and status")
  .option("--remove-model", "Remove the downloaded LLM model")
  .option("--model-path", "Show default model storage path")
  // Config options
  .option("--config <path>", "Path to config file")
  .option("--show-config", "Show current configuration and exit")
  // Comparison mode
  .option("--compare", "Compare Turndown vs LLM conversion side-by-side")
  // Output format
  .option(
    "--json",
    "Output the full result as JSON (markdown + metadata + stats) instead of just the markdown body. In batch mode, emits JSONL (one result per line).",
  )
  // Batch mode
  .option(
    "--batch <file>",
    "Read URLs from <file> (one per line, # comments allowed) and convert each. Use -o <dir> to write per-URL .md files.",
  )
  .option(
    "--concurrency <n>",
    "Max concurrent conversions in batch mode (default: 5)",
  )
  .option(
    "--name-pattern <pattern>",
    "Filename pattern for batch output. Placeholders: {host} {path} {slug} {index} (default: {host}-{slug}.md)",
  )
  .option(
    "--manifest <file>",
    "Write a JSON summary of the batch ({url, file, status, error?, stats?}[]) to <file>",
  )
  .option(
    "--stop-on-error",
    "Abort the batch on the first failed URL instead of recording the error and continuing",
  )
  // Sitemap mode (composes with all the batch flags above)
  .option(
    "--sitemap <url>",
    "Crawl a sitemap.xml (or sitemap index) and convert every URL. Use -o <dir> to write per-URL .md files.",
  )
  .option(
    "--include <pattern>",
    "Only convert URLs matching this glob pattern (repeatable). Supports * and **",
    collectRepeatable,
    [] as string[],
  )
  .option(
    "--exclude <pattern>",
    "Skip URLs matching this glob pattern (repeatable). Applied after --include",
    collectRepeatable,
    [] as string[],
  )
  .option(
    "--max-depth <n>",
    "Max recursion depth when following nested sitemap-index files (default: 3)",
  )
  .option(
    "--max-urls <n>",
    "Hard cap on the number of URLs taken from a sitemap (default: 10000)",
  )
  .action(async (input: string | undefined, options: CliOptions) => {
    try {
      // Handle model management commands first
      if (options.modelInfo) {
        await handleModelInfo();
        return;
      }

      if (options.downloadModel) {
        await handleDownloadModel();
        return;
      }

      if (options.removeModel) {
        await handleRemoveModel();
        return;
      }

      if (options.modelPath) {
        handleModelPath();
        return;
      }

      if (options.showConfig) {
        handleShowConfig(options.config);
        return;
      }

      // Sitemap mode: walks a sitemap.xml (and any nested indexes) then
      // hands off to the same batch machinery as --batch.
      if (options.sitemap) {
        await handleSitemapMode(options);
        return;
      }

      // Batch mode: takes precedence over the single-URL flow and ignores
      // the positional [input] argument.
      if (options.batch) {
        await handleBatchMode(options);
        return;
      }

      // Get input HTML
      const html = await getInput(input);

      // Comparison mode
      if (options.compare) {
        await handleComparisonMode(html, options);
        return;
      }

      // Markdown conversion mode
      await handleMarkdownConversion(html, options);
    } catch (error) {
      console.error("Error:", (error as Error).message);
      if (options.verbose) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  });

async function getInput(input?: string): Promise<string> {
  // Read from URL
  if (input?.startsWith("http")) {
    const response = await fetch(input, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${input}: ${response.statusText}`);
    }
    return await response.text();
  }

  // Read from file
  if (input && input !== "-") {
    return await fs.readFile(input, "utf-8");
  }

  // Read from stdin
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks).toString("utf-8");
  }

  throw new Error(
    "No input provided. Provide a file path, URL, or pipe to stdin.",
  );
}

async function handleMarkdownConversion(
  html: string,
  options: CliOptions,
): Promise<void> {
  // Load config from file(s)
  const fileConfig = loadConfig();

  // Build options from CLI flags
  const cliOptions: MarkdownOptions = {
    extractContent: options.extract,
    includeMeta: options.frontmatter,
    includeImages: options.images,
    includeLinks: options.links,
    includeTables: options.tables,
    maxLength: parseInt(options.maxLength, 10),
    baseUrl: options.baseUrl,
    // LLM options from CLI
    useLLM: options.useLlm,
    llmModelPath: options.llmModelPath,
    llmTemperature: options.llmTemperature
      ? parseFloat(options.llmTemperature)
      : undefined,
    // Pluggable LLM backend from CLI flags
    llm: buildCliLlmConfig(options),
    // Event callbacks for CLI feedback - always show progress for LLM since it can be slow
    onLLMEvent: options.useLlm
      ? options.verbose
        ? createLLMEventHandler()
        : createMinimalLLMEventHandler()
      : undefined,
  };

  // Merge config with CLI options (CLI takes precedence)
  const conversionOptions = mergeConfigWithOptions(fileConfig, cliOptions);

  // For the local-llama path, prompt to download the model if it's missing.
  // Remote providers don't need a local file — skip the check for those.
  const resolvedProvider = conversionOptions.llm?.sdkProvider ?? "local-llama";

  if (conversionOptions.useLLM && resolvedProvider === "local-llama") {
    // Check if model is available
    const status = await checkLLMModel({
      modelPath: conversionOptions.llmModelPath,
    });

    if (!status.available) {
      // Prompt user to download
      const shouldDownload = await promptYesNo(
        "LLM model not found. Download ReaderLM-v2 (~1.12GB)?",
      );

      if (shouldDownload) {
        await handleDownloadModel();
      } else {
        console.error("LLM mode requires the model. Falling back to Turndown.");
        conversionOptions.useLLM = false;
      }
    }
  }

  const result = await convertToMarkdown(html, conversionOptions);

  // JSON mode emits the full result (markdown + metadata + stats) so the
  // output is pipeable into `jq` and other structured tooling.
  const payload = options.json
    ? JSON.stringify(result, null, 2)
    : result.markdown;

  // Write output
  if (options.output) {
    await fs.writeFile(options.output, payload, "utf-8");
    if (process.stdout.isTTY) {
      console.error(`✓ Written to ${options.output}`);
      if (options.verbose) {
        console.error(`  Input: ${result.stats.inputLength} chars`);
        console.error(`  Output: ${result.stats.outputLength} chars`);
        console.error(`  Time: ${result.stats.processingTime}ms`);
      }
    }
  } else {
    console.log(payload);
  }
}

// ============================================================================
// Batch Mode
// ============================================================================

interface BatchManifestEntry {
  url: string;
  status: "ok" | "error";
  file?: string;
  error?: string;
  stats?: ConversionStats;
}

async function handleBatchMode(options: CliOptions): Promise<void> {
  if (!options.batch) {
    throw new Error("Batch mode requires --batch <file>");
  }
  const urls = await readBatchUrls(options.batch);
  if (urls.length === 0) {
    throw new Error(`No URLs found in ${options.batch}`);
  }
  await runBatchOverUrls(urls, options);
}

async function handleSitemapMode(options: CliOptions): Promise<void> {
  if (!options.sitemap) {
    throw new Error("Sitemap mode requires --sitemap <url>");
  }

  const maxDepth = options.maxDepth
    ? Number.parseInt(options.maxDepth, 10)
    : undefined;
  const maxUrls = options.maxUrls
    ? Number.parseInt(options.maxUrls, 10)
    : undefined;
  if (maxDepth !== undefined && Number.isNaN(maxDepth)) {
    throw new Error("--max-depth must be a positive integer");
  }
  if (maxUrls !== undefined && Number.isNaN(maxUrls)) {
    throw new Error("--max-urls must be a positive integer");
  }

  if (process.stderr.isTTY) {
    process.stderr.write(`Fetching sitemap: ${options.sitemap}\n`);
  }

  const urls = await parseSitemap(options.sitemap, {
    maxDepth,
    maxUrls,
    include: options.include?.length ? options.include : undefined,
    exclude: options.exclude?.length ? options.exclude : undefined,
  });

  if (urls.length === 0) {
    throw new Error(
      `No URLs found in sitemap ${options.sitemap} (after include/exclude filtering)`,
    );
  }

  if (process.stderr.isTTY) {
    process.stderr.write(`Found ${urls.length} URL(s); starting batch...\n`);
  }

  await runBatchOverUrls(urls, options);
}

/**
 * Shared batch driver. Takes a URL list (from --batch or --sitemap) and a
 * resolved CLI options object; handles concurrency, per-URL output, JSONL,
 * manifest, progress, and exit codes.
 */
async function runBatchOverUrls(
  urls: string[],
  options: CliOptions,
): Promise<void> {
  const concurrency = options.concurrency
    ? Math.max(1, Number.parseInt(options.concurrency, 10))
    : undefined;
  if (concurrency !== undefined && Number.isNaN(concurrency)) {
    throw new Error("--concurrency must be a positive integer");
  }

  const continueOnError = !options.stopOnError;
  const namePattern = options.namePattern || DEFAULT_NAME_PATTERN;

  // Output target. -o <dir> writes per-URL files; without it, results stream
  // to stdout (JSONL when --json, otherwise a divider-separated stream).
  let outDir: string | null = null;
  if (options.output) {
    outDir = options.output;
    await fs.mkdir(outDir, { recursive: true });
  }

  // Load file config so the LLM block + env-substituted apiKey flow through.
  const fileConfig = loadConfig();
  const cliOptions = {
    extractContent: options.extract,
    includeMeta: options.frontmatter,
    includeImages: options.images,
    includeLinks: options.links,
    includeTables: options.tables,
    maxLength: parseInt(options.maxLength, 10),
    baseUrl: options.baseUrl,
    useLLM: options.useLlm,
    llmModelPath: options.llmModelPath,
    llmTemperature: options.llmTemperature
      ? parseFloat(options.llmTemperature)
      : undefined,
    llm: buildCliLlmConfig(options),
  };
  const conversionOptions = mergeConfigWithOptions(fileConfig, cliOptions);

  const takenNames = new Set<string>();
  const manifest: BatchManifestEntry[] = [];
  let processedIndex = 0;
  let okCount = 0;
  let errCount = 0;

  const progressToTty = process.stderr.isTTY;
  const startedAt = Date.now();

  try {
    for await (const result of convertBatch(urls, {
      ...conversionOptions,
      concurrency,
      continueOnError,
    })) {
      const entry: BatchManifestEntry = {
        url: result.url,
        status: result.status,
      };
      let fileName: string | undefined;
      if (outDir) {
        fileName = uniqueFilenameForUrl(
          result.url,
          namePattern,
          processedIndex,
          takenNames,
        );
        entry.file = fileName;
      }
      processedIndex++;

      if (result.status === "ok") {
        okCount++;
        entry.stats = result.stats;
        if (outDir && fileName) {
          await fs.writeFile(
            path.join(outDir, fileName),
            result.markdown,
            "utf-8",
          );
        } else if (options.json) {
          process.stdout.write(`${JSON.stringify(result)}\n`);
        } else {
          process.stdout.write(
            `# ${result.url}\n\n${result.markdown}\n\n---\n\n`,
          );
        }
      } else {
        errCount++;
        entry.error = result.error.message;
        if (options.json && !outDir) {
          process.stdout.write(
            `${JSON.stringify({ status: "error", url: result.url, error: result.error.message })}\n`,
          );
        }
      }

      manifest.push(entry);

      if (progressToTty) {
        const indicator = result.status === "ok" ? "✓" : "✗";
        process.stderr.write(
          `${indicator} [${processedIndex}/${urls.length}] ${result.url}${
            entry.file ? ` → ${entry.file}` : ""
          }${result.status === "error" ? `  (${result.error.message})` : ""}\n`,
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Batch aborted: ${message}`);
    if (options.manifest) {
      await writeManifest(options.manifest, manifest, urls.length, startedAt);
    }
    process.exit(1);
  }

  if (options.manifest) {
    await writeManifest(options.manifest, manifest, urls.length, startedAt);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.error(
    `\nBatch complete: ${okCount} ok, ${errCount} error, ${elapsed}s elapsed`,
  );

  if (errCount > 0 && !continueOnError) {
    process.exit(1);
  }
}

async function readBatchUrls(filePath: string): Promise<string[]> {
  const raw = await fs.readFile(filePath, "utf-8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** Commander `--option <val>` collector for repeatable string options. */
function collectRepeatable(value: string, previous: string[]): string[] {
  return previous.concat(value);
}

async function writeManifest(
  filePath: string,
  entries: BatchManifestEntry[],
  total: number,
  startedAt: number,
): Promise<void> {
  const okCount = entries.filter((e) => e.status === "ok").length;
  const summary = {
    total,
    ok: okCount,
    error: entries.length - okCount,
    durationMs: Date.now() - startedAt,
    entries,
  };
  await fs.writeFile(filePath, JSON.stringify(summary, null, 2), "utf-8");
}

// ============================================================================
// Model Management Commands
// ============================================================================

async function handleModelInfo(): Promise<void> {
  const info = getLLMModelInfo();
  const status = await checkLLMModel();

  console.log("\nLLM Model Information");
  console.log("=====================");
  console.log(`Recommended model: ${info.recommendedModel}`);
  console.log(`Default path: ${info.defaultPath}`);
  console.log(`Status: ${status.available ? "Installed" : "Not installed"}`);

  if (status.available) {
    console.log(`Size: ${status.sizeFormatted}`);
  }

  console.log("\nAvailable variants:");
  for (const variant of info.availableModels) {
    const marker =
      variant.name === info.recommendedModel ? " (recommended)" : "";
    console.log(`  - ${variant.name}${marker}`);
    console.log(`    Size: ${Math.round(variant.size / (1024 * 1024))}MB`);
    console.log(`    RAM required: ${variant.ramRequired}`);
  }
}

async function handleDownloadModel(): Promise<void> {
  const status = await checkLLMModel();

  if (status.available) {
    console.log(`Model already installed at: ${status.path}`);
    console.log(`Size: ${status.sizeFormatted}`);
    return;
  }

  console.log("Downloading ReaderLM-v2 model...\n");

  // Create progress bar
  const progressBar = new SingleBar(
    {
      format: "Progress |{bar}| {percentage}% | {downloaded}/{totalSize}",
      hideCursor: true,
    },
    Presets.shades_classic,
  );

  let started = false;

  try {
    const path = await downloadLLMModel({
      onProgress: (downloaded, total, percentage) => {
        if (!started) {
          progressBar.start(100, 0, {
            downloaded: formatBytes(downloaded),
            totalSize: formatBytes(total),
          });
          started = true;
        }
        progressBar.update(Math.round(percentage), {
          downloaded: formatBytes(downloaded),
          totalSize: formatBytes(total),
        });
      },
    });

    progressBar.stop();
    console.log(`\n✓ Model downloaded successfully to: ${path}`);
  } catch (error) {
    progressBar.stop();
    throw error;
  }
}

async function handleRemoveModel(): Promise<void> {
  const status = await checkLLMModel();

  if (!status.available) {
    console.log("No model installed.");
    return;
  }

  const confirm = await promptYesNo(
    `Remove model at ${status.path}? (${status.sizeFormatted})`,
  );

  if (confirm) {
    await removeLLMModel();
    console.log("✓ Model removed successfully.");
  } else {
    console.log("Cancelled.");
  }
}

function handleModelPath(): void {
  const info = getLLMModelInfo();
  console.log(info.defaultPath);
}

async function handleComparisonMode(
  html: string,
  options: CliOptions,
): Promise<void> {
  // Check if LLM model is available
  const status = await checkLLMModel({
    modelPath: options.llmModelPath,
  });

  if (!status.available) {
    const shouldDownload = await promptYesNo(
      "LLM model not found. Download ReaderLM-v2 (~1.12GB) to run comparison?",
    );

    if (shouldDownload) {
      await handleDownloadModel();
    } else {
      console.error("Cannot run comparison without LLM model.");
      process.exit(1);
    }
  }

  console.log("\nRunning comparison: Turndown vs LLM\n");
  console.log("=".repeat(50));

  // Common options
  const baseOptions: MarkdownOptions = {
    extractContent: options.extract,
    includeMeta: options.frontmatter,
    includeImages: options.images,
    includeLinks: options.links,
    includeTables: options.tables,
    maxLength: parseInt(options.maxLength, 10),
    baseUrl: options.baseUrl,
  };

  // Run Turndown conversion
  console.log("\n[1/2] Converting with Turndown...");
  const turndownStart = Date.now();
  const turndownResult = await convertToMarkdown(html, {
    ...baseOptions,
    useLLM: false,
  });
  const turndownTime = Date.now() - turndownStart;
  console.log(`      Done in ${turndownTime}ms`);

  // Run LLM conversion
  console.log("\n[2/2] Converting with LLM...");
  const llmStart = Date.now();
  const llmResult = await convertToMarkdown(html, {
    ...baseOptions,
    useLLM: true,
    llmModelPath: options.llmModelPath,
    llmTemperature: options.llmTemperature
      ? parseFloat(options.llmTemperature)
      : undefined,
  });
  const llmTime = Date.now() - llmStart;
  console.log(`      Done in ${llmTime}ms`);

  // Print comparison table
  console.log(`\n${"=".repeat(50)}`);
  console.log("\nComparison Results");
  console.log("-".repeat(50));
  console.log(
    `| ${"Method".padEnd(12)} | ${"Time".padEnd(10)} | ${"Output Size".padEnd(12)} |`,
  );
  console.log(`| ${"-".repeat(12)} | ${"-".repeat(10)} | ${"-".repeat(12)} |`);
  console.log(
    `| ${"Turndown".padEnd(12)} | ${formatTime(turndownTime).padEnd(10)} | ${formatBytes(turndownResult.stats.outputLength).padEnd(12)} |`,
  );
  console.log(
    `| ${"LLM".padEnd(12)} | ${formatTime(llmTime).padEnd(10)} | ${formatBytes(llmResult.stats.outputLength).padEnd(12)} |`,
  );
  console.log("-".repeat(50));

  // Speed comparison
  const speedRatio = llmTime / turndownTime;
  console.log(`\nSpeed: LLM is ${speedRatio.toFixed(1)}x slower than Turndown`);

  // Size comparison
  const sizeDiff =
    llmResult.stats.outputLength - turndownResult.stats.outputLength;
  const sizePercent = (
    (sizeDiff / turndownResult.stats.outputLength) *
    100
  ).toFixed(1);
  if (sizeDiff > 0) {
    console.log(
      `Size: LLM output is ${formatBytes(sizeDiff)} larger (+${sizePercent}%)`,
    );
  } else if (sizeDiff < 0) {
    console.log(
      `Size: LLM output is ${formatBytes(Math.abs(sizeDiff))} smaller (${sizePercent}%)`,
    );
  } else {
    console.log("Size: Outputs are the same size");
  }

  // Write outputs if requested
  if (options.output) {
    const baseName = options.output.replace(/\.md$/, "");
    const turndownFile = `${baseName}.turndown.md`;
    const llmFile = `${baseName}.llm.md`;

    await fs.writeFile(turndownFile, turndownResult.markdown, "utf-8");
    await fs.writeFile(llmFile, llmResult.markdown, "utf-8");

    console.log(`\nOutputs written to:`);
    console.log(`  - ${turndownFile}`);
    console.log(`  - ${llmFile}`);
  } else {
    console.log("\nTip: Use -o <file> to save outputs for detailed comparison");
  }
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function handleShowConfig(configPath?: string): void {
  const configFile = configPath || findConfigPath();

  console.log("\nConfiguration");
  console.log("=============");

  if (configFile) {
    console.log(`Config file: ${configFile}`);
  } else {
    console.log("Config file: None found");
    console.log("\nSupported config file names:");
    console.log("  - .getmdrc");
    console.log("  - .getmdrc.json");
    console.log("  - get-md.config.json");
    console.log("  - getmd.config.json");
    console.log("\nSearch locations:");
    console.log("  1. Current working directory");
    console.log("  2. Home directory (~/)");
    return;
  }

  try {
    const config = loadConfig();
    console.log("\nLoaded configuration:");
    console.log(JSON.stringify(redactSecrets(config), null, 2));
  } catch (error) {
    console.error(
      `\nError loading config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Redact obvious secrets before printing a config blob to stdout. Currently
 * just the LLM apiKey — the only documented secret in the config schema.
 */
function redactSecrets<T>(config: T): T {
  // Cheap structural copy + walk; the config schema is small.
  const cloned = JSON.parse(JSON.stringify(config));
  if (cloned?.llm?.apiKey && typeof cloned.llm.apiKey === "string") {
    cloned.llm.apiKey = "[REDACTED]";
  }
  return cloned;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

const VALID_CLI_PROVIDERS: readonly SdkProvider[] = [
  "openai-compatible",
  "anthropic",
  "google",
  "local-llama",
];

/**
 * Translate the pluggable-LLM CLI flags into a MarkdownOptions.llm block.
 * Returns undefined if no provider-related flag was passed, in which case
 * the config-file value (if any) wins.
 */
function buildCliLlmConfig(options: CliOptions): LlmConfig | undefined {
  const provider = options.llmProvider;
  if (
    !provider &&
    !options.llmBaseUrl &&
    !options.llmModel &&
    !options.llmApiKey
  ) {
    return undefined;
  }

  // If a non-provider LLM flag is passed without --llm-provider, assume
  // openai-compatible since that's the most-used remote backend.
  const sdkProvider: SdkProvider =
    (provider as SdkProvider | undefined) ?? "openai-compatible";

  if (!VALID_CLI_PROVIDERS.includes(sdkProvider)) {
    throw new Error(
      `--llm-provider must be one of: ${VALID_CLI_PROVIDERS.join(", ")}`,
    );
  }

  if (sdkProvider === "local-llama") {
    return {
      sdkProvider: "local-llama",
      ...(options.llmModelPath ? { modelPath: options.llmModelPath } : {}),
    };
  }

  if (!options.llmModel) {
    throw new Error(
      `--llm-model is required when --llm-provider is ${sdkProvider}`,
    );
  }
  if (sdkProvider === "openai-compatible" && !options.llmBaseUrl) {
    throw new Error(
      "--llm-base-url is required when --llm-provider is openai-compatible",
    );
  }
  return {
    sdkProvider,
    model: options.llmModel,
    ...(options.llmBaseUrl ? { baseUrl: options.llmBaseUrl } : {}),
    ...(options.llmApiKey ? { apiKey: options.llmApiKey } : {}),
  };
}

async function promptYesNo(question: string): Promise<boolean> {
  // Non-interactive mode - default to no
  if (!process.stdin.isTTY) {
    return false;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

function createMinimalLLMEventHandler(): (event: LLMEvent) => void {
  return (event: LLMEvent) => {
    // Show minimal progress for LLM operations without verbose mode
    if (process.stdout.isTTY) {
      switch (event.type) {
        case "llama-init-start":
          process.stderr.write(
            "Initializing LLM (may take a few minutes on first run)... ",
          );
          break;
        case "llama-init-complete":
          process.stderr.write("done\n");
          break;
        case "model-file-loading":
          process.stderr.write("Loading model... ");
          break;
        case "model-loaded":
          process.stderr.write("done\n");
          break;
        case "conversion-start":
          process.stderr.write("Converting... ");
          break;
        case "conversion-complete":
          process.stderr.write("done\n");
          break;
        case "fallback-start":
          process.stderr.write(`Falling back to Turndown: ${event.reason}\n`);
          break;
        case "conversion-error":
          process.stderr.write(`Error: ${event.error.message}\n`);
          break;
      }
    }
  };
}

function createLLMEventHandler(): (event: LLMEvent) => void {
  return (event: LLMEvent) => {
    switch (event.type) {
      case "model-check":
        if (event.status === "checking") {
          process.stderr.write("Checking model... ");
        } else if (event.status === "found") {
          process.stderr.write("found\n");
        } else {
          process.stderr.write("not found\n");
        }
        break;
      case "model-loading":
        process.stderr.write(`Loading ${event.modelName}...\n`);
        break;
      case "llama-init-start":
        process.stderr.write(
          "  Initializing llama.cpp (may take a few minutes on first run)... ",
        );
        break;
      case "llama-init-complete":
        process.stderr.write("done\n");
        break;
      case "model-file-loading":
        process.stderr.write("  Loading model file... ");
        break;
      case "model-loaded":
        process.stderr.write(`done (${event.loadTime}ms total)\n`);
        break;
      case "conversion-start":
        process.stderr.write(
          `Converting ${formatBytes(event.inputSize)} of HTML... `,
        );
        break;
      case "conversion-complete":
        process.stderr.write(`done (${event.duration}ms)\n`);
        break;
      case "fallback-start":
        process.stderr.write(`\nFalling back to Turndown: ${event.reason}\n`);
        break;
      case "conversion-error":
        process.stderr.write(`\nError: ${event.error.message}\n`);
        break;
    }
  };
}

program.parse();
