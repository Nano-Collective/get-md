// src/parsers/markdown-parser.ts

import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import * as cheerio from "cheerio";
import { cleanHTML } from "../optimizers/html-cleaner.js";
import { formatForLLM } from "../optimizers/llm-formatter.js";
import { enhanceStructure } from "../optimizers/structure-enhancer.js";
import { extractMetadata } from "../extractors/metadata-extractor.js";
import type {
  MarkdownOptions,
  MarkdownResult,
  ContentMetadata,
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

  convert(html: string, options: MarkdownOptions = {}): MarkdownResult {
    const startTime = Date.now();
    const opts = this.normalizeOptions(options);

    // Step 1: Extract main content using Readability
    let contentHtml = html;
    let metadata: ContentMetadata = {};
    let readabilitySuccess = false;

    if (opts.extractContent) {
      try {
        const extracted = this.extractMainContent(html, opts.baseUrl);
        if (extracted) {
          contentHtml = extracted.content;
          metadata = extracted.metadata;
          readabilitySuccess = true;
        }
      } catch {
        // Fallback to raw HTML if Readability fails
        console.warn("Readability extraction failed, using raw HTML");
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

    // Step 6: Apply custom rules if provided
    if (opts.customRules && opts.customRules.length > 0) {
      this.applyCustomRules(opts.customRules);
    }

    // Step 7: Convert to markdown
    let markdown = this.turndown.turndown(contentHtml);

    // Step 8: Apply LLM-specific formatting
    markdown = formatForLLM(markdown);

    // Step 9: Calculate word count and reading time from markdown (before adding frontmatter)
    const { wordCount, readingTime } = this.calculateMarkdownStats(markdown);
    metadata.wordCount = wordCount;
    metadata.readingTime = readingTime;

    // Step 10: Add frontmatter if requested
    if (opts.includeMeta && Object.keys(metadata).length > 0) {
      markdown = this.addFrontmatter(markdown, metadata);
    }

    // Step 11: Final cleanup
    markdown = this.postProcess(markdown);

    // Step 12: Validate length
    if (opts.maxLength && markdown.length > opts.maxLength) {
      markdown =
        markdown.substring(0, opts.maxLength) + "\n\n[Content truncated]";
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
        inputLength: html.length,
        outputLength: markdown.length,
        processingTime,
        readabilitySuccess,
        imageCount,
        linkCount,
      },
    };
  }

  private extractMainContent(
    html: string,
    baseUrl?: string
  ): { content: string; metadata: ContentMetadata } | null {
    const doc = new JSDOM(html, { url: baseUrl });
    const reader = new Readability(doc.window.document, {
      // Increase content threshold to avoid extracting navigation/sidebars
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
        // wordCount and readingTime will be calculated from final markdown
      },
    };
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
    options: Required<MarkdownOptions>
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
        return (
          "\n" + lines.map((line: string) => `> ${line}`).join("\n") + "\n"
        );
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
    let markdown = "\n| " + headers.join(" | ") + " |\n";

    // Add alignment row
    const alignRow = alignments.map((align) => {
      if (align === "center") return ":---:";
      if (align === "right") return "---:";
      return "---";
    });
    markdown += "| " + alignRow.join(" | ") + " |\n";

    // Add data rows
    rows.forEach((row) => {
      markdown += "| " + row.join(" | ") + " |\n";
    });

    return markdown + "\n";
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

    return yaml.join("\n") + "\n\n" + markdown;
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
      "$1 $2\n$4"
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

    return markdown.trim() + "\n";
  }

  private normalizeOptions(
    options: MarkdownOptions
  ): Required<MarkdownOptions> {
    return {
      extractContent: options.extractContent ?? true,
      includeMeta: options.includeMeta ?? true,
      customRules: options.customRules ?? [],
      preserveElements: options.preserveElements ?? [],
      maxLength: options.maxLength ?? 1000000,
      baseUrl: options.baseUrl,
      includeImages: options.includeImages ?? true,
      includeLinks: options.includeLinks ?? true,
      includeTables: options.includeTables ?? true,
      aggressiveCleanup: options.aggressiveCleanup ?? true, // Back to true with smarter selectors
    } as Required<MarkdownOptions>;
  }
}
