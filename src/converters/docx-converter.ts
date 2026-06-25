// src/converters/docx-converter.ts

import * as cheerio from "cheerio/slim";
import type { Element as DomElement } from "domhandler";
import { convertToMarkdown } from "../index.js";
import type { MarkdownOptions, MarkdownResult } from "../types.js";

/** Element type for OOXML nodes parsed by cheerio in xmlMode. */
type XmlElement = DomElement;

// ============================================================================
// OOXML Constants
// ============================================================================

/** Word heading style name → heading level.
 * Covers both the space-separated ("Heading 1") and compact ("Heading1")
 * naming conventions used by different Word versions and templates. */
const BUILTIN_HEADING_STYLES: Record<string, number> = {
  // Space-separated (most common)
  "Heading 1": 1,
  "Heading 2": 2,
  "Heading 3": 3,
  "Heading 4": 4,
  "Heading 5": 5,
  "Heading 6": 6,
  // Compact (used by some templates, non-English versions)
  Heading1: 1,
  Heading2: 2,
  Heading3: 3,
  Heading4: 4,
  Heading5: 5,
  Heading6: 6,
  // Title / Subtitle
  Title: 1,
  Subtitle: 2,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Convert a DOCX file to Markdown using get-md's full pipeline.
 *
 * Extracts `word/document.xml` from the .docx ZIP, parses the OOXML
 * structure into semantic HTML, then feeds through the existing
 * Turndown-based pipeline for high-quality Markdown output.
 *
 * @param docxBuffer - The .docx file as a Buffer
 * @param options   - Standard get-md MarkdownOptions
 * @returns MarkdownResult with markdown, metadata, and stats
 */
export async function convertDocxToMarkdown(
  docxBuffer: Buffer,
  options?: MarkdownOptions,
): Promise<MarkdownResult> {
  const html = await convertDocxToHtml(docxBuffer);
  // Feed through get-md's existing HTML → Markdown pipeline.
  // Disable Readability — the docx converter already gives clean, structured HTML.
  return convertToMarkdown(html, {
    ...options,
    extractContent: false,
  });
}

/**
 * Convert a DOCX file (as Buffer) to HTML by parsing the OOXML structure.
 *
 * Supported:
 * - Headings (via paragraph style names: "Heading 1", "Heading 2", etc.)
 * - Bold, italic, underline, strikethrough runs
 * - Ordered and unordered lists (via numbering properties)
 * - Tables
 * - Basic text content
 */
export async function convertDocxToHtml(docxBuffer: Buffer): Promise<string> {
  const xml = await extractDocumentXml(docxBuffer);
  return parseDocumentXml(xml);
}

// ============================================================================
// ZIP extraction
// ============================================================================

/**
 * Extract word/document.xml from a .docx ZIP archive.
 * Uses node-stream-zip (lightweight, zero-dep ZIP reader).
 */
async function extractDocumentXml(docxBuffer: Buffer): Promise<string> {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");

  // node-stream-zip requires a file path, not a buffer.
  // Write to a temp file, extract, then clean up.
  const tmpFile = path.join(
    os.tmpdir(),
    `get-md-docx-${process.pid}-${Date.now()}.docx`,
  );
  fs.writeFileSync(tmpFile, docxBuffer);

  try {
    const { default: StreamZip } = await import("node-stream-zip");
    const zip = new StreamZip.async({ file: tmpFile });
    const xmlBuffer = await zip.entryData("word/document.xml");
    await zip.close();
    return xmlBuffer.toString("utf-8");
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// ============================================================================
// OOXML → HTML
// ============================================================================

function parseDocumentXml(xml: string): string {
  const $ = cheerio.load(xml, { xmlMode: true });

  const body = $("w\\:body");
  if (!body.length) return "";

  const htmlParts: string[] = [];
  let listState: { type: "ul" | "ol" } | null = null;

  body.children().each((_idx: number, element: XmlElement) => {
    const el = $(element);
    const tagName = element.tagName?.toLowerCase() ?? "";

    if (tagName === "w:p") {
      const result = processParagraph($, el);

      if (result.isList) {
        const listType = result.listType ?? "ul";
        if (!listState || listState.type !== listType) {
          if (listState) htmlParts.push(`</${listState.type}>`);
          htmlParts.push(`<${listType}>`);
          listState = { type: listType };
        }
        htmlParts.push(`<li>${result.html}</li>`);
      } else {
        closeList(htmlParts, listState);
        listState = null;
        if (result.html) htmlParts.push(result.html);
      }
    } else if (tagName === "w:tbl") {
      closeList(htmlParts, listState);
      listState = null;
      const tableHtml = processTable($, el);
      if (tableHtml) htmlParts.push(tableHtml);
    }
  });

  closeList(htmlParts, listState);

  return htmlParts.join("\n");
}

function closeList(
  htmlParts: string[],
  listState: { type: "ul" | "ol" } | null,
): void {
  if (listState) htmlParts.push(`</${listState.type}>`);
}

// ============================================================================
// Paragraph processing
// ============================================================================

interface ParagraphResult {
  html: string;
  isList: boolean;
  listType?: "ul" | "ol";
}

function processParagraph(
  $: cheerio.CheerioAPI,
  p: cheerio.Cheerio<XmlElement>,
): ParagraphResult {
  // Check for numbering (list item)
  const numPr = p.find("w\\:numPr").first();
  const isList = numPr.length > 0;
  let listType: "ul" | "ol" = "ul";

  if (isList) {
    const numId = numPr.find("w\\:numId").attr("w:val");
    if (numId) {
      // Heuristic: even numIds tend to be ordered, odd tend to be unordered.
      // A full implementation would parse word/numbering.xml.
      listType = parseInt(numId, 10) % 2 === 0 ? "ol" : "ul";
    }
  }

  // Get paragraph style name
  const styleName = p.find("w\\:pStyle").first().attr("w:val") || "";

  // Collect formatted text from runs
  const textParts: string[] = [];
  p.find("w\\:r").each((_idx: number, runEl: XmlElement) => {
    const text = processRun($, $(runEl));
    if (text) textParts.push(text);
  });

  // processRun() already escapes HTML entities in raw text content,
  // so we join the run output directly without re-escaping.
  // Double-escaping would corrupt formatting tags (e.g. <strong> → &lt;strong&gt;).
  const textContent = textParts.join("");

  // Check if this is a heading
  const headingLevel =
    BUILTIN_HEADING_STYLES[styleName] ??
    BUILTIN_HEADING_STYLES[styleName.toLowerCase()];

  if (headingLevel) {
    return {
      html: `<h${headingLevel}>${textContent}</h${headingLevel}>`,
      isList: false,
    };
  }

  // Empty paragraph
  if (!textContent.trim()) {
    return { html: "<p></p>", isList: false };
  }

  return {
    html: `<p>${textContent}</p>`,
    isList,
    listType: isList ? listType : undefined,
  };
}

// ============================================================================
// Run processing (text + inline formatting)
// ============================================================================

function processRun(
  $: cheerio.CheerioAPI,
  run: cheerio.Cheerio<XmlElement>,
): string {
  // Check for images
  if (run.find("w\\:drawing").length > 0) {
    return processImage();
  }

  // Collect text from w:t elements
  const texts: string[] = [];
  run.find("w\\:t").each((_idx: number, tEl: XmlElement) => {
    texts.push($(tEl).text());
  });

  let content = escapeHtml(texts.join(""));
  if (!content) return "";

  // Apply run formatting
  const rPr = run.find("w\\:rPr").first();
  if (rPr.length > 0) {
    if (rPr.find("w\\:b").length > 0) content = `<strong>${content}</strong>`;
    if (rPr.find("w\\:i").length > 0) content = `<em>${content}</em>`;
    if (rPr.find("w\\:u").length > 0) content = `<u>${content}</u>`;
    if (rPr.find("w\\:strike").length > 0) content = `<s>${content}</s>`;
  }

  return content;
}

// ============================================================================
// Image processing
// ============================================================================

function processImage(): string {
  // Full implementation would extract image binary from the ZIP.
  // For now, emit a placeholder.
  return `<img src="" alt="Image" />`;
}

// ============================================================================
// Table processing
// ============================================================================

function processTable(
  $: cheerio.CheerioAPI,
  tbl: cheerio.Cheerio<XmlElement>,
): string {
  const rows: string[][] = [];

  tbl.find("w\\:tr").each((_idx: number, trEl: XmlElement) => {
    const tr = $(trEl);
    const cells: string[] = [];

    tr.find("w\\:tc").each((_tcIdx: number, tcEl: XmlElement) => {
      const tc = $(tcEl);
      const cellTexts: string[] = [];
      tc.find("w\\:p").each((_pIdx: number, pEl: XmlElement) => {
        const p = $(pEl);
        const runTexts: string[] = [];
        p.find("w\\:r").each((_rIdx: number, rEl: XmlElement) => {
          $(rEl)
            .find("w\\:t")
            .each((_tIdx: number, tEl: XmlElement) => {
              runTexts.push($(tEl).text());
            });
        });
        cellTexts.push(runTexts.join(""));
      });
      cells.push(cellTexts.join(" ").trim());
    });

    if (cells.length > 0) rows.push(cells);
  });

  if (rows.length === 0) return "";

  const htmlRows: string[] = [];
  // First row as header
  htmlRows.push(
    `<tr>${rows[0].map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`,
  );
  // Remaining rows as data
  for (let i = 1; i < rows.length; i++) {
    htmlRows.push(
      `<tr>${rows[i].map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
    );
  }

  return `<table>\n${htmlRows.join("\n")}\n</table>`;
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
