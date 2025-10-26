#!/usr/bin/env node

// src/cli.ts

import { Command } from "commander";
import fs from "fs/promises";
import { convertToMarkdown } from "./index.js";
import type { MarkdownOptions } from "./types.js";

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
  .action(async (input, options) => {
    try {
      // Get input HTML
      const html = await getInput(input);

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
  if (input && input.startsWith("http")) {
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
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf-8");
  }

  throw new Error(
    "No input provided. Provide a file path, URL, or pipe to stdin.",
  );
}

async function handleMarkdownConversion(
  html: string,
  options: any,
): Promise<void> {
  const conversionOptions: MarkdownOptions = {
    extractContent: options.extract,
    includeMeta: options.frontmatter,
    includeImages: options.images,
    includeLinks: options.links,
    includeTables: options.tables,
    maxLength: parseInt(options.maxLength),
    baseUrl: options.baseUrl,
  };

  const result = await convertToMarkdown(html, conversionOptions);

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

program.parse();
