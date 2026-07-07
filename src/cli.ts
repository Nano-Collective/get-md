#!/usr/bin/env node

// src/cli.ts

import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { Presets, SingleBar } from "cli-progress";
import { Command } from "commander";
import { convertBatch } from "./batch.js";
import { convertDocxToMarkdown } from "./converters/docx-converter.js";
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
  MarkdownResult,
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

/**
 * Detect the input type from a file path or content string.
 * URLs and `.html`/`.htm` files are "html".
 * `.md`/`.markdown` files are "markdown".
 * Anything else defaults to "html" (backward compatible).
 */
export function detectInputType(input: string): "html" | "markdown" {
  // URLs are always HTML (fetched as HTML)
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return "html";
  }

  const ext = path.extname(input).toLowerCase();

  switch (ext) {
    case ".md":
    case ".markdown":
      return "markdown";
    default:
      // No recognized extension or .html/.htm/.pdf/.docx etc — treat as HTML (backward compatible)
      return "html";
  }
}

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
  // Image localization
  downloadImages?: string;
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
  // HTTP retry + cache
  retries?: string;
  retryDelay?: string;
  cache?: boolean;
  cacheDir?: string;
  cacheMaxAge?: string;
}

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("get-md")
  .description(
    "Convert HTML, PDF, DOCX, and Markdown to LLM-optimized Markdown",
  )
  .version(pkg.version);

// Main conversion command
program
  .argument("[input]", "HTML/PDF/DOCX/Markdown file path, URL, or stdin")
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
  .option(
    "--download-images <dir>",
    "Download referenced images to <dir> and rewrite the markdown src to point at the local copies",
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
  // HTTP retry + cache (apply to every fetch — single URL, batch, sitemap)
  .option(
    "--retries <n>",
    "Retry attempts on transient HTTP failures: 5xx, 429, network errors (default: 2)",
  )
  .option(
    "--retry-delay <ms>",
    "Initial backoff between retries in ms (default: 500). Exponential + jitter.",
  )
  .option(
    "--cache",
    "Cache successful responses on disk (default dir: ~/.get-md/cache). A cache hit skips the network entirely.",
  )
  .option(
    "--cache-dir <path>",
    "Custom directory for the HTTP cache. Implies --cache.",
  )
  .option(
    "--cache-max-age <seconds>",
    "Max age of a cached entry in seconds (default: 3600 = 1 hour)",
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

      // DOCX mode: detect .docx file (local or remote) and convert
      if (input?.toLowerCase().endsWith(".docx")) {
        await handleDocxInput(input, options);
        return;
      }

      // Get input content + detected type
      const { content: html, inputType } = await getInput(input);

      // When auto-detection identifies markdown, route through the markdown
      // optimization pipeline directly — no HTML conversion needed.
      if (inputType === "markdown" && typeof html === "string") {
        await handleMarkdownInput(html, input, options);
        return;
      }

      // When the positional arg was a URL, treat it as the implicit
      // --base-url so downstream things (relative link/image resolution,
      // image localization) work without the user having to pass --base-url
      // explicitly. User-supplied --base-url still wins.
      if (input?.startsWith("http") && !options.baseUrl) {
        options.baseUrl = input;
      }

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

async function getInput(input?: string): Promise<{
  content: string | Buffer;
  inputType: "html" | "markdown" | "pdf";
}> {
  const inputType: "html" | "markdown" | "pdf" = detectInputType(
    input ?? "",
  ) as any;
  // Read from URL
  if (input?.startsWith("http")) {
    const response = await fetch(input, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${input}: ${response.statusText}`);
    }
    if (
      response.headers.get("content-type")?.includes("application/pdf") ||
      input.toLowerCase().endsWith(".pdf")
    ) {
      return {
        content: Buffer.from(await response.arrayBuffer()),
        inputType: "pdf",
      };
    }
    return { content: await response.text(), inputType };
  }

  // Read from file
  if (input && input !== "-") {
    if (input.toLowerCase().endsWith(".pdf")) {
      return { content: await fs.readFile(input), inputType: "pdf" };
    }
    return {
      content: await fs.readFile(input, "utf-8"),
      inputType,
    };
  }

  // Read from stdin — always treat as HTML (no extension hint available)
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    const buf = Buffer.concat(chunks);
    if (buf.subarray(0, 4).toString() === "%PDF") {
      return { content: buf, inputType: "pdf" };
    }
    return {
      content: buf.toString("utf-8"),
      inputType: "html",
    };
  }

  throw new Error(
    "No input provided. Provide a file path, URL, or pipe to stdin.",
  );
}

async function handleMarkdownInput(
  markdown: string,
  _inputPath: string | undefined,
  options: CliOptions,
): Promise<void> {
  const fileConfig = loadConfig();

  // Build options. Readability content extraction is N/A for markdown input,
  // but the content filters (--no-images/--no-links/--no-tables) DO apply —
  // a markdown file can contain images, links, and tables a user may want
  // stripped, so we forward the real flags.
  const cliOptions: MarkdownOptions = {
    extractContent: false,
    includeMeta: options.frontmatter,
    includeImages: options.images,
    includeLinks: options.links,
    includeTables: options.tables,
    maxLength: parseInt(options.maxLength, 10),
    baseUrl: options.baseUrl,
    // Signal to convertToMarkdown to skip HTML parsing
    inputType: "markdown",
    // LLM options from CLI
    useLLM: false,
    llmModelPath: options.llmModelPath,
    llmTemperature: options.llmTemperature
      ? parseFloat(options.llmTemperature)
      : undefined,
    // Pluggable LLM backend from CLI flags
    llm: buildCliLlmConfig(options),
    // HTTP retry + cache flags
    ...buildCliFetchOptions(options),
    // Image localization
    downloadImages: options.downloadImages,
    outputPath: options.output,
    // Event callbacks for CLI feedback
    onLLMEvent: options.useLlm
      ? options.verbose
        ? createLLMEventHandler()
        : createMinimalLLMEventHandler()
      : undefined,
  };

  // Merge config with CLI options (CLI takes precedence)
  const conversionOptions = mergeConfigWithOptions(fileConfig, cliOptions);

  const result = await convertToMarkdown(markdown, conversionOptions);

  // JSON mode emits the full result
  const payload = options.json
    ? JSON.stringify(result, null, 2)
    : result.markdown;

  // Write output
  if (options.output) {
    await writeFileEnsureDir(options.output, payload);
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

async function handleMarkdownConversion(
  html: string | Buffer,
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
    // HTTP retry + cache flags
    ...buildCliFetchOptions(options),
    // Image localization
    downloadImages: options.downloadImages,
    // Tell the localizer where the markdown will live so it can compute
    // correct relative paths to the assets dir.
    outputPath: options.output,
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
    await writeFileEnsureDir(options.output, payload);
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
// DOCX Mode
// ============================================================================

async function handleDocxInput(
  input: string,
  options: CliOptions,
): Promise<void> {
  // Build conversion options from CLI flags (same as markdown conversion)
  const fileConfig = loadConfig();

  const cliOptions: MarkdownOptions = {
    extractContent: false, // DOCX converter already gives clean HTML
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
    ...buildCliFetchOptions(options),
    downloadImages: options.downloadImages,
    outputPath: options.output,
    onLLMEvent: options.useLlm
      ? options.verbose
        ? createLLMEventHandler()
        : createMinimalLLMEventHandler()
      : undefined,
  };

  const conversionOptions = mergeConfigWithOptions(fileConfig, cliOptions);

  // Route URL .docx through the fetch pipeline so remote DOCX files
  // are downloaded and written to a temp file before conversion.
  if (input.startsWith("http")) {
    const fetchOptions = buildCliFetchOptions(options);
    const buffer = await fetchDocxFromUrl(input, fetchOptions);
    const result = await convertDocxToMarkdown(buffer, conversionOptions);
    await writeDocxResult(result, options);
  } else {
    const docxBuffer = await fs.readFile(input);
    const result = await convertDocxToMarkdown(docxBuffer, conversionOptions);
    await writeDocxResult(result, options);
  }
}

async function fetchDocxFromUrl(
  url: string,
  fetchOptions: Partial<MarkdownOptions>,
): Promise<Buffer> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(fetchOptions.timeout ?? 30000),
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch DOCX from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function writeDocxResult(
  result: MarkdownResult,
  options: CliOptions,
): Promise<void> {
  const payload = options.json
    ? JSON.stringify(result, null, 2)
    : result.markdown;

  if (options.output) {
    await writeFileEnsureDir(options.output, payload);
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
    ...buildCliFetchOptions(options),
    downloadImages: options.downloadImages,
    // Per-page markdown lives in outDir; the localizer only uses the
    // dirname, so a placeholder filename is fine here.
    outputPath: outDir ? path.join(outDir, "page.md") : undefined,
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

/**
 * Write a file to disk, creating the parent directory if it doesn't exist.
 * Saves the user from `ENOENT` when they pass `-o ./nested/out.md` without
 * having made `./nested/` first.
 */
async function writeFileEnsureDir(
  filePath: string,
  contents: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  if (dir && dir !== "." && dir !== "/") {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.writeFile(filePath, contents, "utf-8");
}

/**
 * Translate the HTTP retry + cache CLI flags into MarkdownOptions fields.
 * Returns only the fields that were explicitly set so config-file defaults
 * still win when the user didn't pass a flag.
 */
function buildCliFetchOptions(options: CliOptions): Partial<MarkdownOptions> {
  const out: Partial<MarkdownOptions> = {};
  if (options.retries !== undefined) {
    const n = Number.parseInt(options.retries, 10);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("--retries must be a non-negative integer");
    }
    out.retries = n;
  }
  if (options.retryDelay !== undefined) {
    const n = Number.parseInt(options.retryDelay, 10);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("--retry-delay must be a non-negative integer");
    }
    out.retryDelay = n;
  }
  if (options.cacheDir !== undefined) {
    out.cache = options.cacheDir;
  } else if (options.cache) {
    out.cache = true;
  }
  if (options.cacheMaxAge !== undefined) {
    const n = Number.parseInt(options.cacheMaxAge, 10);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("--cache-max-age must be a non-negative integer");
    }
    out.cacheMaxAge = n * 1000; // CLI takes seconds, internal API uses ms
  }
  return out;
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
  await writeFileEnsureDir(filePath, JSON.stringify(summary, null, 2));
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
  html: string | Buffer,
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

    await writeFileEnsureDir(turndownFile, turndownResult.markdown);
    await writeFileEnsureDir(llmFile, llmResult.markdown);

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
