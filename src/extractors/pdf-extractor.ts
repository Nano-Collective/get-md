import { PDFParse } from "pdf-parse";
import { escapeHtml } from "../utils/escape.js";

/** Metadata pulled from the PDF's info dictionary, when present. */
export interface PdfMetadata {
  title?: string;
  author?: string;
  /** Publication/creation date as an ISO string, when parseable. */
  publishedTime?: string;
}

export interface PdfExtractResult {
  /** Extracted, cleaned text content (all pages joined). */
  text: string;
  /** Per-page text (page markers removed), used for structure reconstruction. */
  pages: string[];
  /** Document-level metadata from the PDF info dictionary. */
  metadata: PdfMetadata;
}

/**
 * pdf-parse renders page separators like `-- 1 of 3 --` into the text stream.
 * Those are presentation artifacts, not document content, so strip them before
 * the text flows into the Markdown pipeline.
 */
export function stripPageMarkers(text: string): string {
  return text.replace(/^\s*-{2,}\s*\d+\s+of\s+\d+\s*-{2,}\s*$/gim, "");
}

/**
 * Extracts text content from a PDF buffer.
 *
 * Note: pdf-parse is chosen because it provides lightweight,
 * cross-platform PDF text extraction without requiring the
 * heavier pdfjs rendering pipeline.
 *
 * @param buffer - The raw PDF buffer
 * @returns The extracted text content (page markers removed)
 */
export async function extractPdfContent(buffer: Buffer): Promise<string> {
  const { text } = await extractPdf(buffer);
  return text;
}

/**
 * Extract both the text and the document metadata from a PDF buffer.
 *
 * @param buffer - The raw PDF buffer
 * @returns Cleaned text plus any title/author/date from the info dictionary
 */
export async function extractPdf(buffer: Buffer): Promise<PdfExtractResult> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    // Prefer per-page text (enables running header/footer detection and
    // cross-page paragraph flow); fall back to the flat text if unavailable.
    const rawPages = Array.isArray(result.pages)
      ? result.pages.map((p: { text?: string }) => p.text ?? "")
      : [result.text ?? ""];
    const pages = rawPages.map((p) => stripPageMarkers(p));
    const text = pages.join("\n").trim();

    // Document metadata lives in a separate call (getInfo), not getText.
    // Treat it as best-effort — a missing/broken info dict must not fail
    // text extraction.
    let metadata: PdfMetadata = {};
    try {
      const infoResult = (await parser.getInfo()) as {
        info?: Record<string, unknown>;
      };
      metadata = extractPdfMetadata(infoResult?.info);
    } catch {
      // Ignore — metadata is optional.
    }

    return { text, pages, metadata };
  } catch (error) {
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Pull title/author/date out of the PDF's info dictionary.
 * The shape varies across producers, so read defensively.
 */
function extractPdfMetadata(
  info: Record<string, unknown> | undefined,
): PdfMetadata {
  if (!info || typeof info !== "object") return {};

  const metadata: PdfMetadata = {};

  const title = readString(info.Title);
  if (title) metadata.title = title;

  const author = readString(info.Author);
  if (author) metadata.author = author;

  const published = parsePdfDate(readString(info.CreationDate));
  if (published) metadata.publishedTime = published;

  return metadata;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * PDF dates look like `D:20240131120000Z` or `D:20240131120000+05'30'`.
 * Convert to an ISO string when we can; otherwise return undefined.
 */
function parsePdfDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return undefined;
  const [
    ,
    year,
    month = "01",
    day = "01",
    hour = "00",
    min = "00",
    sec = "00",
  ] = m;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(min),
      Number(sec),
    ),
  );
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// ============================================================================
// Structure reconstruction (text → semantic HTML)
// ============================================================================

// Common PDF bullet glyphs, plus markdown-style "- "/"* " bullets.
const BULLET_RE = /^[•·◦▪‣●○•▪●]\s+(.*)$/;
const DASH_BULLET_RE = /^[-*]\s+(.*)$/;
const NUMBERED_RE = /^(\d{1,3})[.)]\s+(.*)$/;
// A line that ends a sentence (optionally followed by a closing quote/bracket).
const SENTENCE_END_RE = /[.!?:]["'’”)\]]?$/;

/**
 * Is this line a section heading? Heuristic: short, all-caps (letters only),
 * and mostly letters/digits rather than punctuation. Catches things like
 * "INTRODUCTION" and "USE OF SOCIAL MEDIA SITES".
 */
function isHeadingLine(line: string): boolean {
  if (line.length === 0 || line.length > 60) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (letters.length < 2) return false;
  if (letters !== letters.toUpperCase()) return false;
  // Reject lines that are mostly digits/symbols (e.g. dates, rule lines).
  const letterAndSpace = line.replace(/[^A-Za-z ]/g, "");
  return letterAndSpace.length / line.length >= 0.6;
}

/**
 * Detect running headers/footers: identical short lines that repeat across a
 * majority of pages. These are page furniture, not content.
 */
function findBoilerplate(pageLines: string[][]): Set<string> {
  const counts = new Map<string, number>();
  for (const lines of pageLines) {
    const seen = new Set<string>();
    for (const line of lines) {
      if (line && !seen.has(line)) {
        seen.add(line);
        counts.set(line, (counts.get(line) ?? 0) + 1);
      }
    }
  }
  const threshold = Math.max(2, Math.ceil(pageLines.length / 2));
  const boilerplate = new Set<string>();
  if (pageLines.length >= 2) {
    for (const [line, count] of counts) {
      if (count >= threshold && line.length <= 120) boilerplate.add(line);
    }
  }
  return boilerplate;
}

/**
 * Reconstruct semantic HTML from extracted PDF pages.
 *
 * pdf-parse emits one line per visual line with wrapped paragraphs split
 * across several lines and no blank-line paragraph breaks. This reflows that
 * into headings, bullet/numbered lists, and paragraphs so the downstream
 * Markdown is structured rather than one giant blob. It:
 *  - drops repeated running headers/footers,
 *  - joins wrapped lines into paragraphs (breaking on sentence-ending
 *    punctuation), letting content flow across page furniture,
 *  - promotes ALL-CAPS lines to headings (first → h1, rest → h2),
 *  - turns bullet/numbered lines into lists, folding wrapped continuation
 *    lines into the current item.
 *
 * All text content is HTML-escaped. Returns an HTML body string.
 */
export function reconstructPdfHtml(pages: string[]): string {
  const pageLines = pages.map((p) => p.split(/\r?\n/).map((l) => l.trim()));
  const boilerplate = findBoilerplate(pageLines);

  const parts: string[] = [];
  let para: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let firstHeadingSeen = false;

  const flushPara = (): void => {
    if (para.length) {
      parts.push(`<p>${escapeHtml(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = (): void => {
    if (listType && listItems.length) {
      const items = listItems
        .map((it) => `<li>${escapeHtml(it)}</li>`)
        .join("");
      parts.push(`<${listType}>${items}</${listType}>`);
    }
    listItems = [];
    listType = null;
  };

  for (const lines of pageLines) {
    for (const line of lines) {
      // Skip blank lines and page furniture entirely so real content can flow
      // across them (paragraphs/lists often span a page break).
      if (!line || boilerplate.has(line)) continue;

      const bullet = line.match(BULLET_RE) ?? line.match(DASH_BULLET_RE);
      if (bullet) {
        flushPara();
        if (listType !== "ul") {
          flushList();
          listType = "ul";
        }
        listItems.push(bullet[1]);
        continue;
      }

      const numbered = line.match(NUMBERED_RE);
      if (numbered) {
        flushPara();
        if (listType !== "ol") {
          flushList();
          listType = "ol";
        }
        listItems.push(numbered[2]);
        continue;
      }

      // A plain line while a list is open is either a wrapped continuation of
      // the current item, or (if the item already looks complete) the start of
      // a new paragraph after the list.
      if (listType && listItems.length) {
        const last = listItems[listItems.length - 1];
        if (!SENTENCE_END_RE.test(last)) {
          listItems[listItems.length - 1] = `${last} ${line}`;
          continue;
        }
        flushList();
      }

      if (isHeadingLine(line)) {
        flushPara();
        flushList();
        const level = firstHeadingSeen ? 2 : 1;
        firstHeadingSeen = true;
        parts.push(`<h${level}>${escapeHtml(line)}</h${level}>`);
        continue;
      }

      para.push(line);
      if (SENTENCE_END_RE.test(line)) flushPara();
    }
  }

  flushPara();
  flushList();

  return parts.join("\n");
}
