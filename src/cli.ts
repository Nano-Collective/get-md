#!/usr/bin/env node

// src/cli.ts

import { Command } from 'commander';
import fs from 'fs/promises';
import {
  convertToMarkdown,
  convertToJSON,
  extractMetadata,
} from './index.js';
import type { MarkdownOptions, JsonExtractionOptions } from './types.js';

const program = new Command();

program
  .name('get-md')
  .description('Convert HTML to LLM-optimized Markdown or extract structured JSON')
  .version('1.0.0');

// Main conversion command
program
  .argument('[input]', 'HTML file path, URL, or stdin')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-j, --json <schema>', 'Extract JSON using schema file')
  .option('--no-extract', 'Disable Readability content extraction')
  .option('--no-llm-optimize', 'Disable LLM-specific formatting')
  .option('--frontmatter', 'Include metadata as YAML frontmatter')
  .option('--no-images', 'Remove images from output')
  .option('--no-links', 'Remove links from output')
  .option('--no-tables', 'Remove tables from output')
  .option('--max-length <n>', 'Maximum output length', '1000000')
  .option('--base-url <url>', 'Base URL for resolving relative links')
  .option('--selectors <file>', 'JSON file with custom selectors for JSON extraction')
  .option('--partial', 'Return partial results on validation errors (JSON mode)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (input, options) => {
    try {
      // Get input HTML
      const html = await getInput(input);

      if (options.json) {
        // JSON extraction mode
        await handleJsonExtraction(html, options);
      } else {
        // Markdown conversion mode
        await handleMarkdownConversion(html, options);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      if (options.verbose) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  });

// Metadata extraction command
program
  .command('meta')
  .description('Extract only metadata from HTML')
  .argument('<input>', 'HTML file path or URL')
  .option('--json', 'Output as JSON')
  .action(async (input, options) => {
    try {
      const html = await getInput(input);
      const metadata = await extractMetadata(html);

      if (options.json) {
        console.log(JSON.stringify(metadata, null, 2));
      } else {
        Object.entries(metadata).forEach(([key, value]) => {
          if (value) console.log(`${key}: ${value}`);
        });
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

async function getInput(input?: string): Promise<string> {
  // Read from URL
  if (input && input.startsWith('http')) {
    if (process.stdout.isTTY) {
      process.stderr.write('Fetching URL...\n');
    }
    const response = await fetch(input, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${input}: ${response.statusText}`);
    }
    return await response.text();
  }

  // Read from file
  if (input && input !== '-') {
    return await fs.readFile(input, 'utf-8');
  }

  // Read from stdin
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  throw new Error(
    'No input provided. Provide a file path, URL, or pipe to stdin.'
  );
}

async function handleMarkdownConversion(
  html: string,
  options: any
): Promise<void> {
  const conversionOptions: MarkdownOptions = {
    extractContent: options.extract,
    llmOptimized: options.llmOptimize,
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
    await fs.writeFile(options.output, result.markdown, 'utf-8');
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

async function handleJsonExtraction(
  html: string,
  options: any
): Promise<void> {
  // Load schema
  const schemaContent = await fs.readFile(options.json, 'utf-8');
  const schema = JSON.parse(schemaContent);

  // Load custom selectors if provided
  let selectors: Record<string, string> | undefined;
  if (options.selectors) {
    const selectorsContent = await fs.readFile(options.selectors, 'utf-8');
    selectors = JSON.parse(selectorsContent);
  }

  const extractionOptions: JsonExtractionOptions = {
    selectors,
    partial: options.partial,
    baseUrl: options.baseUrl,
  };

  const result = await convertToJSON(html, { schema }, extractionOptions);

  // Format output
  const output = JSON.stringify(result.data, null, 2);

  // Write output
  if (options.output) {
    await fs.writeFile(options.output, output, 'utf-8');
    if (process.stdout.isTTY) {
      console.error(`✓ Written to ${options.output}`);
      if (options.verbose || result.warnings) {
        if (result.warnings) {
          result.warnings.forEach((w) => console.error(`  Warning: ${w}`));
        }
        if (options.verbose) {
          console.error(
            `  Fields extracted: ${result.stats.fieldsExtracted}`
          );
          console.error(`  Time: ${result.stats.processingTime}ms`);
        }
      }
    }
  } else {
    console.log(output);
  }
}

program.parse();
