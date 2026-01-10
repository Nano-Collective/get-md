// src/parsers/markdown-parser.ts

import * as cheerio from "cheerio/slim";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { LLMConverter } from "../converters/llm-converter.js";
import { checkLLMModel } from "../converters/llm-manager.js";
import { extractMetadata } from "../extractors/metadata-extractor.js";
import { cleanHTML } from "../optimizers/html-cleaner.js";
import { formatForLLM } from "../optimizers/llm-formatter.js";
import { enhanceStructure } from "../optimizers/structure-enhancer.js";
import type {
  ContentMetadata,
  LLMEventCallback,
  MarkdownOptions,
  MarkdownResult,
  TurndownNode,
  TurndownRule,
} from "../types.js";

export class MarkdownParser {
  private turndown: TurndownService;

  constructor() {
    // Initialize Turndown with LLM-friendly settings
    this.turndown = new TurndownService({
      headingStyle: "atx", // Use # style headings
      hr: "---", // Horizontal rule style
      bulletListMarker: "-", // Use - for lists
      codeBlockStyle: "fenced", // Use ``` for code blocks
      fence: "```", // Fence marker
      emDelimiter: "*", // Emphasis delimiter
      strongDelimiter: "**", // Strong delimiter
      linkStyle: "inlined", // Inline links
      linkReferenceStyle: "full", // Full reference links
    });

    // Add GitHub Flavored Markdown support (tables, strikethrough, etc.)
    this.turndown.use(gfm);

    // Set up custom rules optimized for LLMs
    this.setupLLMRules();
  }

  /**
   * Convert HTML to Markdown (async version with LLM support)
   *
   * When `useLLM` option is true, this method will use a local LLM model
   * for conversion, providing higher quality output for complex HTML.
   */
  async convertAsync(
    html: string,
    options: MarkdownOptions = {},
  ): Promise<MarkdownResult> {
    const startTime = Date.now();
    const opts = this.normalizeOptions(options);

    // Prepare preprocessed HTML and metadata
    const { contentHtml, metadata, readabilitySuccess } =
      await this.preprocessHtml(html, opts);

    // Create event emitter that unifies both callback styles
    const emitEvent = this.createEventEmitter(opts);

    let markdown: string;

    // Decision point: Use LLM or Turndown
    if (opts.useLLM) {
      try {
        markdown = await this.convertWithLLM(contentHtml, opts, emitEvent);
      } catch (error) {
        // Handle fallback to Turndown
        if (opts.llmFallback !== false) {
          const reason =
            error instanceof Error ? error.message : "Unknown error";
          await emitEvent({ type: "fallback-start", reason });
          markdown = this.convertWithTurndown(contentHtml, opts);
        } else {
          throw error;
        }
      }
    } else {
      markdown = this.convertWithTurndown(contentHtml, opts);
    }

    // Post-process and finalize
    return this.finalizeConversion(
      html,
      contentHtml,
      markdown,
      metadata,
      opts,
      readabilitySuccess,
      startTime,
    );
  }

  /**
   * Convert HTML to Markdown (sync version, uses Turndown only)
   *
   * For LLM-based conversion, use `convertAsync()` instead.
   */
  convert(html: string, options: MarkdownOptions = {}): MarkdownResult {
    const startTime = Date.now();
    const opts = this.normalizeOptions(options);

    // Warn if LLM options are passed to sync method
    if (opts.useLLM) {
      console.warn(
        "LLM conversion is not available in sync convert(). Use convertAsync() instead.",
      );
    }

    // Disable extractContent for sync version since it requires async
    if (opts.extractContent) {
      console.warn(
        "Content extraction (Readability) is not available in sync convert(). Use convertAsync() instead. Falling back to raw HTML.",
      );
      opts.extractContent = false;
    }

    // Prepare preprocessed HTML and metadata (sync version)
    const { contentHtml, metadata, readabilitySuccess } =
      this.preprocessHtmlSync(html, opts);

    // Convert with Turndown (sync path)
    const markdown = this.convertWithTurndown(contentHtml, opts);

    // Post-process and finalize
    return this.finalizeConversion(
      html,
      contentHtml,
      markdown,
      metadata,
      opts,
      readabilitySuccess,
      startTime,
    );
  }

  /**
   * Preprocess HTML: extract content, clean, enhance structure, filter
   */
  private async preprocessHtml(
    html: string,
    opts: Required<MarkdownOptions>,
  ): Promise<{
    contentHtml: string;
    metadata: ContentMetadata;
    readabilitySuccess: boolean;
  }> {
    // Step 1: Extract main content using Readability
    let contentHtml = html;
    let metadata: ContentMetadata = {};
    let readabilitySuccess = false;

    if (opts.extractContent) {
      try {
        const extracted = await this.extractMainContent(html, opts.baseUrl);
        if (extracted) {
          contentHtml = extracted.content;
          metadata = extracted.metadata;
          readabilitySuccess = true;
        }
      } catch (error) {
        // Fallback to raw HTML if Readability fails or is unavailable (React Native)
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `Readability extraction failed: ${errorMessage}. Using raw HTML.`,
        );
      }
    }

    // Step 2: Additional metadata extraction
    const additionalMeta = extractMetadata(contentHtml, opts.baseUrl);
    metadata = { ...additionalMeta, ...metadata };

    // Step 3: Clean HTML (remove scripts, styles, ads, etc.)
    contentHtml = cleanHTML(contentHtml, {
      aggressive: opts.aggressiveCleanup,
      baseUrl: opts.baseUrl,
    });

    // Step 4: Enhance structure (improve heading hierarchy, etc.)
    contentHtml = enhanceStructure(contentHtml);

    // Step 4.5: Normalize code blocks (GitHub, etc.)
    contentHtml = this.normalizeCodeBlocks(contentHtml);

    // Step 5: Filter content based on options
    contentHtml = this.filterContent(contentHtml, opts);

    return { contentHtml, metadata, readabilitySuccess };
  }

  /**
   * Preprocess HTML: clean, enhance structure, filter (sync version - no content extraction)
   */
  private preprocessHtmlSync(
    html: string,
    opts: Required<MarkdownOptions>,
  ): {
    contentHtml: string;
    metadata: ContentMetadata;
    readabilitySuccess: boolean;
  } {
    // Skip content extraction in sync version (requires async)
    let contentHtml = html;
    let metadata: ContentMetadata = {};
    const readabilitySuccess = false;

    // Step 2: Additional metadata extraction
    const additionalMeta = extractMetadata(contentHtml, opts.baseUrl);
    metadata = { ...additionalMeta, ...metadata };

    // Step 3: Clean HTML (remove scripts, styles, ads, etc.)
    contentHtml = cleanHTML(contentHtml, {
      aggressive: opts.aggressiveCleanup,
      baseUrl: opts.baseUrl,
    });

    // Step 4: Enhance structure (improve heading hierarchy, etc.)
    contentHtml = enhanceStructure(contentHtml);

    // Step 4.5: Normalize code blocks (GitHub, etc.)
    contentHtml = this.normalizeCodeBlocks(contentHtml);

    // Step 5: Filter content based on options
    contentHtml = this.filterContent(contentHtml, opts);

    return { contentHtml, metadata, readabilitySuccess };
  }

  /**
   * Convert preprocessed HTML to Markdown using Turndown
   */
  private convertWithTurndown(
    contentHtml: string,
    opts: Required<MarkdownOptions>,
  ): string {
    // Apply custom rules if provided
    if (opts.customRules && opts.customRules.length > 0) {
      this.applyCustomRules(opts.customRules);
    }

    // Convert to markdown
    let markdown = this.turndown.turndown(contentHtml);

    // Apply LLM-specific formatting
    markdown = formatForLLM(markdown);

    return markdown;
  }

  /**
   * Convert preprocessed HTML to Markdown using LLM
   */
  private async convertWithLLM(
    contentHtml: string,
    opts: Required<MarkdownOptions>,
    emitEvent: LLMEventCallback,
  ): Promise<string> {
    // Check if model is available
    await emitEvent({ type: "model-check", status: "checking" });

    const modelPath = opts.llmModelPath;
    const modelStatus = await checkLLMModel({
      modelPath: modelPath || undefined,
    });

    if (!modelStatus.available) {
      await emitEvent({ type: "model-check", status: "not-found" });
      throw new Error(
        "LLM model not found. Download it first using downloadLLMModel() or the CLI command: getmd --download-model",
      );
    }

    await emitEvent({
      type: "model-check",
      status: "found",
      path: modelStatus.path,
    });

    // Create and load the converter
    const converter = new LLMConverter({
      modelPath: modelStatus.path || "",
      onEvent: emitEvent,
      temperature: opts.llmTemperature,
      maxTokens: opts.llmMaxTokens,
    });

    try {
      await converter.loadModel();

      // Convert HTML to Markdown using LLM
      const markdown = await converter.convert(contentHtml);

      return markdown;
    } finally {
      // Always unload the model to free memory
      await converter.unload();
    }
  }

  /**
   * Create a unified event emitter from options
   */
  private createEventEmitter(
    opts: Required<MarkdownOptions>,
  ): LLMEventCallback {
    return async (event) => {
      // Call unified callback if provided
      if (opts.onLLMEvent) {
        await opts.onLLMEvent(event);
      }

      // Call simplified callbacks based on event type
      if (opts.onDownloadProgress && event.type === "download-progress") {
        opts.onDownloadProgress(
          event.downloaded,
          event.total,
          event.percentage,
        );
      }

      if (opts.onModelStatus) {
        if (event.type === "model-check") {
          if (event.status === "not-found") {
            opts.onModelStatus("not-found");
          }
        } else if (event.type === "model-loading") {
          opts.onModelStatus("loading");
        } else if (event.type === "model-loaded") {
          opts.onModelStatus("loaded");
        }
      }

      if (opts.onConversionProgress) {
        if (event.type === "conversion-start") {
          opts.onConversionProgress({ stage: "starting" });
        } else if (event.type === "conversion-progress") {
          opts.onConversionProgress({
            stage: "converting",
            percentage: event.tokensProcessed
              ? Math.min(100, event.tokensProcessed / 100)
              : undefined,
          });
        } else if (event.type === "conversion-complete") {
          opts.onConversionProgress({ stage: "complete", percentage: 100 });
        }
      }
    };
  }

  /**
   * Finalize conversion: add metadata, frontmatter, and calculate stats
   */
  private finalizeConversion(
    originalHtml: string,
    contentHtml: string,
    markdown: string,
    metadata: ContentMetadata,
    opts: Required<MarkdownOptions>,
    readabilitySuccess: boolean,
    startTime: number,
  ): MarkdownResult {
    // Calculate word count and reading time from markdown
    const { wordCount, readingTime } = this.calculateMarkdownStats(markdown);
    metadata.wordCount = wordCount;
    metadata.readingTime = readingTime;

    // Add frontmatter if requested
    if (opts.includeMeta && Object.keys(metadata).length > 0) {
      markdown = this.addFrontmatter(markdown, metadata);
    }

    // Final cleanup
    markdown = this.postProcess(markdown);

    // Validate length
    if (opts.maxLength && markdown.length > opts.maxLength) {
      markdown = `${markdown.substring(0, opts.maxLength)}\n\n[Content truncated]`;
    }

    const processingTime = Date.now() - startTime;

    // Calculate statistics
    const $ = cheerio.load(contentHtml);
    const imageCount = opts.includeImages ? $("img").length : 0;
    const linkCount = opts.includeLinks ? $("a").length : 0;

    return {
      markdown,
      metadata,
      stats: {
        inputLength: originalHtml.length,
        outputLength: markdown.length,
        processingTime,
        readabilitySuccess,
        imageCount,
        linkCount,
      },
    };
  }

  private async extractMainContent(
    html: string,
    baseUrl?: string,
  ): Promise<{ content: string; metadata: ContentMetadata } | null> {
    try {
      // Use happy-dom-without-node for DOM implementation
      // Works in Node.js, React Native, and browser environments
      const { Window } = await import("happy-dom-without-node");
      const { Readability } = await import("@mozilla/readability");

      // Save original process (happy-dom overrides it)
      const originalProcess =
        typeof globalThis !== "undefined"
          ? (globalThis as typeof globalThis & { process?: typeof process })
              .process
          : undefined;

      const window = new Window({
        url: baseUrl || "https://example.com",
      });
      const document = window.document;
      document.body.innerHTML = html;

      // Restore original process
      if (originalProcess && typeof globalThis !== "undefined") {
        (
          globalThis as typeof globalThis & { process?: typeof process }
        ).process = originalProcess;
      }

      // Cast to bypass TypeScript type checking
      // happy-dom-without-node implements enough of the DOM API for Readability
      const reader = new Readability(document as unknown as Document, {
        charThreshold: 500,
      });

      const article = reader.parse();

      if (!article) {
        return null;
      }

      return {
        content: article.content || "",
        metadata: {
          title: article.title || undefined,
          author: article.byline || undefined,
          excerpt: article.excerpt || undefined,
          siteName: article.siteName || undefined,
        },
      };
    } catch {
      // Content extraction not available
      throw new Error(
        "Content extraction failed. Set extractContent: false to skip content extraction.",
      );
    }
  }

  private normalizeCodeBlocks(html: string): string {
    const $ = cheerio.load(html);

    // Step 1: Handle sites that store clean code in data attributes
    // (e.g., GitHub, GitLab, and other code hosting platforms)
    // Check common data attribute names used by various platforms
    const codeDataAttributes = [
      "data-snippet-clipboard-copy-content", // GitHub
      "data-code-content", // Some documentation sites
      "data-clipboard-text", // Generic clipboard libraries
      "data-source", // Some CMS platforms
    ];

    codeDataAttributes.forEach((attrName) => {
      $(`div[${attrName}], figure[${attrName}]`).each((_, el) => {
        const $container = $(el);
        const pre = $container.find("pre").first();

        if (pre.length > 0) {
          // Get the clean code content from the data attribute
          const cleanCode = $container.attr(attrName);

          if (cleanCode) {
            // Create a code element and set its text content (this will auto-escape)
            const $code = $("<code></code>");
            $code.text(cleanCode);

            // Replace the pre content with standard <pre><code> structure
            pre.empty().append($code);
          }
        }
      });
    });

    // Step 2: Handle bare <pre> tags without <code> children
    // This catches code blocks from sites that don't use the <pre><code> pattern
    $("pre").each((_, el) => {
      const $pre = $(el);

      // Skip if it already has a code child (already in correct format)
      if ($pre.find("code").length > 0) {
        return;
      }

      // Get the text content
      const codeContent = $pre.text();

      // Skip if empty
      if (!codeContent.trim()) {
        return;
      }

      // Wrap content in a code element
      const $code = $("<code></code>");
      $code.text(codeContent);

      // Replace the pre content with the code element
      $pre.empty().append($code);
    });

    return $.html();
  }

  private filterContent(
    html: string,
    options: Required<MarkdownOptions>,
  ): string {
    const $ = cheerio.load(html);

    // Remove images if disabled
    if (!options.includeImages) {
      $("img, picture, figure").remove();
    }

    // Remove links if disabled (keep text content)
    if (!options.includeLinks) {
      $("a").each((_, el) => {
        const $el = $(el);
        $el.replaceWith($el.text());
      });
    }

    // Remove tables if disabled
    if (!options.includeTables) {
      $("table").remove();
    }

    return $.html();
  }

  private setupLLMRules(): void {
    // Custom rule for better table formatting
    this.turndown.addRule("tables", {
      filter: "table",
      replacement: (_content, node) => {
        return this.convertTableToMarkdown(node as TurndownNode);
      },
    });

    // Custom rule for code blocks with language detection
    this.turndown.addRule("codeBlocks", {
      filter: (node: TurndownNode) => {
        return node.nodeName === "PRE" && node.querySelector?.("code") !== null;
      },
      replacement: (_content, node: TurndownNode) => {
        const code = node.querySelector?.("code");
        if (!code) return "";

        // Detect language from class name
        const className = code.className || "";
        const langMatch = className.match(/language-(\w+)|lang-(\w+)/);
        const language = langMatch?.[1] || langMatch?.[2] || "";

        const codeContent = code.textContent || "";

        return `\n\`\`\`${language}\n${codeContent}\n\`\`\`\n`;
      },
    });

    // Custom rule for better image handling with alt text
    this.turndown.addRule("images", {
      filter: "img",
      replacement: (_content, node: TurndownNode) => {
        const alt = node.alt || "Image";
        const src = node.src || node.getAttribute?.("data-src") || "";
        const title = node.title || "";

        if (!src) return "";

        if (title) {
          return `![${alt}](${src} "${title}")`;
        }
        return `![${alt}](${src})`;
      },
    });

    // Custom rule for blockquotes with better formatting
    this.turndown.addRule("blockquotes", {
      filter: "blockquote",
      replacement: (_content, node: TurndownNode) => {
        const text = node.textContent || "";
        const lines = text.trim().split("\n");
        return `\n${lines.map((line: string) => `> ${line}`).join("\n")}\n`;
      },
    });

    // Remove empty paragraphs and whitespace-only elements
    this.turndown.addRule("removeEmpty", {
      filter: (node: TurndownNode) => {
        return (
          ["P", "DIV", "SPAN"].includes(node.nodeName.toUpperCase()) &&
          (!node.textContent || node.textContent.trim() === "")
        );
      },
      replacement: () => "",
    });
  }

  private convertTableToMarkdown(table: TurndownNode): string {
    const $ = cheerio.load(table.outerHTML || "");
    const headers: string[] = [];
    const rows: string[][] = [];
    const alignments: string[] = [];

    // Extract headers and alignments
    $("thead tr, tr:first-child")
      .first()
      .find("th, td")
      .each((_, el) => {
        const $el = $(el);
        headers.push($el.text().trim().replace(/\n/g, " "));

        // Detect alignment from style or align attribute
        const align =
          $el.attr("align") ||
          ($el.css("text-align") === "center"
            ? "center"
            : $el.css("text-align") === "right"
              ? "right"
              : "left");
        alignments.push(align);
      });

    if (headers.length === 0) return "";

    // Extract rows
    const rowSelector =
      $("thead").length > 0 ? "tbody tr" : "tr:not(:first-child)";
    $(rowSelector).each((_, tr) => {
      const row: string[] = [];
      $(tr)
        .find("td")
        .each((_, td) => {
          row.push($(td).text().trim().replace(/\n/g, " "));
        });
      if (row.length > 0) {
        // Ensure row has same number of columns as headers
        while (row.length < headers.length) {
          row.push("");
        }
        rows.push(row.slice(0, headers.length));
      }
    });

    // Build markdown table
    let markdown = `\n| ${headers.join(" | ")} |\n`;

    // Add alignment row
    const alignRow = alignments.map((align) => {
      if (align === "center") return ":---:";
      if (align === "right") return "---:";
      return "---";
    });
    markdown += `| ${alignRow.join(" | ")} |\n`;

    // Add data rows
    rows.forEach((row) => {
      markdown += `| ${row.join(" | ")} |\n`;
    });

    return `${markdown}\n`;
  }

  private applyCustomRules(rules: TurndownRule[]): void {
    rules.forEach((rule) => {
      this.turndown.addRule(rule.name, {
        filter: rule.filter as unknown as TurndownService.Filter,
        replacement: rule.replacement as TurndownService.ReplacementFunction,
      });
    });
  }

  private addFrontmatter(markdown: string, metadata: ContentMetadata): string {
    // Build YAML frontmatter
    const yaml: string[] = ["---"];

    Object.entries(metadata).forEach(([key, value]: [string, unknown]) => {
      if (value !== undefined && value !== null) {
        // Escape string values with quotes if they contain special chars
        const yamlValue: string | number =
          typeof value === "string" && /[:\n\r]/.test(value)
            ? `"${value.replace(/"/g, '\\"')}"`
            : (value as string | number);
        yaml.push(`${key}: ${String(yamlValue)}`);
      }
    });

    yaml.push("---");

    return `${yaml.join("\n")}\n\n${markdown}`;
  }

  private calculateMarkdownStats(markdown: string): {
    wordCount: number;
    readingTime: number;
  } {
    // Remove frontmatter if present
    let contentOnly = markdown;
    if (markdown.startsWith("---")) {
      const frontmatterEnd = markdown.indexOf("---", 3);
      if (frontmatterEnd !== -1) {
        contentOnly = markdown.substring(frontmatterEnd + 3).trim();
      }
    }

    // Count words in the actual content (excluding code blocks and URLs)
    // Remove code blocks first
    contentOnly = contentOnly.replace(/```[\s\S]*?```/g, "");
    // Remove inline code
    contentOnly = contentOnly.replace(/`[^`]+`/g, "");
    // Remove URLs
    contentOnly = contentOnly.replace(/https?:\/\/[^\s)]+/g, "");
    // Remove markdown link syntax but keep the text
    contentOnly = contentOnly.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    // Remove image syntax
    contentOnly = contentOnly.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

    // Count words
    const words = contentOnly
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const wordCount = words.length;

    // Calculate reading time (250 words per minute is more realistic)
    const readingTime = Math.ceil(wordCount / 250);

    return { wordCount, readingTime };
  }

  private postProcess(markdown: string): string {
    // Remove excessive blank lines (more than 2 consecutive)
    markdown = markdown.replace(/\n{3,}/g, "\n\n");

    // Clean up list formatting (remove blank lines within lists)
    markdown = markdown.replace(
      /^(-|\d+\.)\s+(.+?)(\n\n)(-|\d+\.)/gm,
      "$1 $2\n$4",
    );

    // Ensure code blocks have spacing
    markdown = markdown.replace(/([^\n])\n```/g, "$1\n\n```");
    markdown = markdown.replace(/```\n([^`\n])/g, "```\n\n$1");

    // Fix heading spacing (ensure blank line before headings, but not right after frontmatter)
    markdown = markdown.replace(/([^\n-])\n(#{1,6}\s)/g, "$1\n\n$2");

    // Ensure consistent spacing around horizontal rules (but not frontmatter delimiters)
    // Only add spacing to --- that are not at the start and not part of frontmatter
    const lines = markdown.split("\n");
    let frontmatterCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterCount++;
        if (frontmatterCount <= 2) {
          continue;
        }
      }

      // After frontmatter is closed, add spacing around horizontal rules
      if (
        frontmatterCount >= 2 &&
        lines[i].trim() === "---" &&
        i > 0 &&
        i < lines.length - 1
      ) {
        if (lines[i - 1].trim() !== "" && !lines[i - 1].startsWith("#")) {
          lines.splice(i, 0, "");
          i++;
        }
        if (lines[i + 1].trim() !== "" && !lines[i + 1].startsWith("#")) {
          lines.splice(i + 1, 0, "");
          i++;
        }
      }
    }

    markdown = lines.join("\n");

    // Remove trailing whitespace from lines
    markdown = markdown.replace(/[^\S\n]+$/gm, "");

    return `${markdown.trim()}\n`;
  }

  private normalizeOptions(
    options: MarkdownOptions,
  ): Required<MarkdownOptions> {
    return {
      // Core options
      extractContent: options.extractContent ?? true,
      includeMeta: options.includeMeta ?? true,
      customRules: options.customRules ?? [],
      preserveElements: options.preserveElements ?? [],
      maxLength: options.maxLength ?? 1000000,
      baseUrl: options.baseUrl,
      includeImages: options.includeImages ?? true,
      includeLinks: options.includeLinks ?? true,
      includeTables: options.includeTables ?? true,
      aggressiveCleanup: options.aggressiveCleanup ?? true,

      // URL fetching options
      isUrl: options.isUrl,
      timeout: options.timeout ?? 15000,
      followRedirects: options.followRedirects ?? true,
      maxRedirects: options.maxRedirects ?? 5,
      headers: options.headers,
      userAgent: options.userAgent,

      // LLM options
      useLLM: options.useLLM ?? false,
      llmModelPath: options.llmModelPath,
      llmTemperature: options.llmTemperature ?? 0.1,
      llmMaxTokens: options.llmMaxTokens ?? 512000,
      llmFallback: options.llmFallback ?? true,
      onLLMEvent: options.onLLMEvent,
      onDownloadProgress: options.onDownloadProgress,
      onModelStatus: options.onModelStatus,
      onConversionProgress: options.onConversionProgress,
    } as Required<MarkdownOptions>;
  }
}
