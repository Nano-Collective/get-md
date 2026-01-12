#!/usr/bin/env node

// src/cli.ts

import fs from "node:fs/promises";
import readline from "node:readline";
import { Presets, SingleBar } from "cli-progress";
import { Command } from "commander";
import {
  checkLLMModel,
  convertToMarkdown,
  downloadLLMModel,
  getLLMModelInfo,
  removeLLMModel,
} from "./index.js";
import type { LLMEvent, MarkdownOptions } from "./types.js";
import {
  findConfigPath,
  loadConfig,
  mergeConfigWithOptions,
} from "./utils/config-loader.js";

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
}

const program = new Command();

program
  .name("get-md")
  .description(
    "Convert HTML to LLM-optimized Markdown or extract structured JSON",
  )
  .version("1.0.0");

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
    // Event callbacks for CLI feedback
    onLLMEvent: options.verbose ? createLLMEventHandler() : undefined,
  };

  // Merge config with CLI options (CLI takes precedence)
  const conversionOptions = mergeConfigWithOptions(fileConfig, cliOptions);

  // Check if LLM mode is requested (from config or CLI)
  if (conversionOptions.useLLM) {
    // Check if model is available
    const status = await checkLLMModel({
      modelPath: conversionOptions.llmModelPath,
    });

    if (!status.available) {
      // Prompt user to download
      const shouldDownload = await promptYesNo(
        "LLM model not found. Download ReaderLM-v2 (986MB)?",
      );

      if (shouldDownload) {
        await handleDownloadModel();
      } else {
        console.error("LLM mode requires the model. Falling back to Turndown.");
        conversionOptions.useLLM = false;
      }
    }
  }

  // Show spinner for LLM conversion
  if (conversionOptions.useLLM && process.stdout.isTTY) {
    process.stderr.write("Converting with LLM... ");
  }

  const result = await convertToMarkdown(html, conversionOptions);

  if (conversionOptions.useLLM && process.stdout.isTTY) {
    process.stderr.write("done!\n");
  }

  // Write output
  if (options.output) {
    await fs.writeFile(options.output, result.markdown, "utf-8");
    if (process.stdout.isTTY) {
      console.error(`✓ Written to ${options.output}`);
      if (options.verbose) {
        console.error(`  Input: ${result.stats.inputLength} chars`);
        console.error(`  Output: ${result.stats.outputLength} chars`);
        console.error(`  Time: ${result.stats.processingTime}ms`);
      }
    }
  } else {
    console.log(result.markdown);
  }
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
      format: "Progress |{bar}| {percentage}% | {downloaded}/{total}",
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
            total: formatBytes(total),
          });
          started = true;
        }
        progressBar.update(Math.round(percentage), {
          downloaded: formatBytes(downloaded),
          total: formatBytes(total),
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
      "LLM model not found. Download ReaderLM-v2 (986MB) to run comparison?",
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
    console.log(JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(
      `\nError loading config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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
        process.stderr.write(`Loading ${event.modelName}... `);
        break;
      case "model-loaded":
        process.stderr.write(`done (${event.loadTime}ms)\n`);
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
