// src/utils/chunker.ts

import { estimateTokens } from "./tokens.js";

/** Options for `chunkMarkdown` */
export interface ChunkOptions {
  /** Hard upper bound on tokens per chunk */
  maxTokens: number;
  /**
   * Tokens to overlap between adjacent chunks. Useful for RAG retrieval so
   * an answer that straddles a chunk boundary still surfaces. Default: 0.
   */
  overlap?: number;
  /**
   * Prepend the current heading trail (e.g. "# Title\n## Section\n") to each
   * chunk so the model has context about where the chunk came from.
   * Default: true.
   */
  includeHeadingPath?: boolean;
}

/** One chunk of a markdown document */
export interface MarkdownChunk {
  /** The chunk's text (heading path already prepended if enabled) */
  content: string;
  /** Estimated tokens for `content` (matches `estimateTokens(content)`) */
  estimatedTokens: number;
  /**
   * The heading trail this chunk lives under, e.g. `["Docs", "Setup",
   * "Install"]`. Empty array if the chunk lives above the first heading.
   */
  headingPath: string[];
  /** Zero-based chunk index */
  index: number;
  /** Total number of chunks produced */
  total: number;
}

interface Block {
  text: string;
  tokens: number;
  headingPath: string[];
}

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n+/;
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

/**
 * Split a markdown document into LLM-friendly chunks at semantic boundaries.
 *
 * The chunker prefers to break on blank-line separated blocks (paragraphs,
 * code fences, lists, headings) so chunks stay coherent. If a single block
 * is larger than `maxTokens` it's split on sentences, then on characters as
 * a last resort.
 *
 * Token counts use the same chars/4 heuristic as `estimateTokens`. Pass a
 * `maxTokens` that's comfortably below your model's true window — the
 * estimate can under-count on token-dense text.
 *
 * @example
 * ```typescript
 * import { convertToMarkdown, chunkMarkdown } from '@nanocollective/get-md';
 *
 * const { markdown } = await convertToMarkdown('https://example.com/long-article');
 * const chunks = chunkMarkdown(markdown, { maxTokens: 1000, overlap: 100 });
 *
 * for (const chunk of chunks) {
 *   await embed(chunk.content); // feed to your RAG pipeline
 * }
 * ```
 */
export function chunkMarkdown(
  markdown: string,
  options: ChunkOptions,
): MarkdownChunk[] {
  const maxTokens = options.maxTokens;
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new Error("chunkMarkdown: maxTokens must be a positive number");
  }
  const overlap = Math.max(0, options.overlap ?? 0);
  if (overlap >= maxTokens) {
    throw new Error("chunkMarkdown: overlap must be smaller than maxTokens");
  }
  const includeHeadingPath = options.includeHeadingPath ?? true;

  // Frontmatter belongs to the document, not any single chunk — strip it
  // before splitting so it doesn't eat into every chunk's budget.
  const body = markdown.replace(FRONTMATTER_RE, "");

  const blocks = splitIntoBlocks(body, maxTokens);
  const rawChunks = packBlocks(blocks, maxTokens);

  const overlapped = overlap > 0 ? applyOverlap(rawChunks, overlap) : rawChunks;

  return overlapped.map((chunkBlocks, index) => {
    const headingPath = chunkBlocks[0]?.headingPath ?? [];
    let content = chunkBlocks.map((b) => b.text).join("\n\n");

    if (includeHeadingPath && headingPath.length > 0) {
      const trail = headingPath
        .map((h, i) => `${"#".repeat(i + 1)} ${h}`)
        .join("\n");
      // Only prepend if the chunk doesn't already start with its heading
      // (heading blocks are kept as their own blocks, so the leading block
      // is often the heading itself for the first chunk of a section).
      const firstLine = content.split("\n", 1)[0];
      const startsWithSameHeading =
        HEADING_RE.test(firstLine) &&
        firstLine.replace(HEADING_RE, "$2").trim() ===
          headingPath[headingPath.length - 1];
      if (!startsWithSameHeading) {
        content = `${trail}\n\n${content}`;
      }
    }

    return {
      content,
      estimatedTokens: estimateTokens(content),
      headingPath,
      index,
      total: overlapped.length,
    };
  });
}

/**
 * Split markdown into blank-line-separated blocks. Any block larger than
 * `maxTokens` on its own is recursively broken down at the next reasonable
 * boundary (sentence, then character).
 */
function splitIntoBlocks(body: string, maxTokens: number): Block[] {
  const rawBlocks = body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const headingPath: string[] = [];
  const blocks: Block[] = [];

  for (const raw of rawBlocks) {
    updateHeadingPath(headingPath, raw);
    const tokens = estimateTokens(raw);

    if (tokens <= maxTokens) {
      blocks.push({ text: raw, tokens, headingPath: [...headingPath] });
      continue;
    }

    // Block is too big on its own — split it further. Try sentences first,
    // then fall back to fixed-size character windows.
    for (const piece of splitOversizedBlock(raw, maxTokens)) {
      blocks.push({
        text: piece,
        tokens: estimateTokens(piece),
        headingPath: [...headingPath],
      });
    }
  }

  return blocks;
}

function updateHeadingPath(path: string[], block: string): void {
  const firstLine = block.split("\n", 1)[0];
  const match = firstLine.match(HEADING_RE);
  if (!match) return;
  const level = match[1].length;
  const title = match[2];
  path.length = level - 1; // truncate to parent level
  path.push(title);
}

function splitOversizedBlock(block: string, maxTokens: number): string[] {
  // Sentence-ish split first — keeps prose readable.
  const sentences = block.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  if (sentences.length > 1) {
    const pieces: string[] = [];
    let buffer = "";
    for (const sentence of sentences) {
      const candidate = buffer ? `${buffer} ${sentence}` : sentence;
      if (estimateTokens(candidate) > maxTokens && buffer) {
        pieces.push(buffer);
        buffer = sentence;
      } else {
        buffer = candidate;
      }
    }
    if (buffer) pieces.push(buffer);

    // If every resulting piece now fits, we're done. Otherwise fall through
    // to a character split for the offenders.
    if (pieces.every((p) => estimateTokens(p) <= maxTokens)) {
      return pieces;
    }
  }

  // Last resort — hard character window. Uses maxTokens * 4 since the
  // estimator is chars/4.
  const windowChars = maxTokens * 4;
  const pieces: string[] = [];
  for (let i = 0; i < block.length; i += windowChars) {
    pieces.push(block.slice(i, i + windowChars));
  }
  return pieces;
}

/**
 * Greedy-pack blocks into chunks so each chunk stays under maxTokens, with
 * one structural preference: when a new heading appears, start a fresh chunk
 * (unless the current chunk is heading-only). This keeps each chunk anchored
 * to a single section — what RAG retrieval actually wants.
 */
function packBlocks(blocks: Block[], maxTokens: number): Block[][] {
  const chunks: Block[][] = [];
  let current: Block[] = [];
  let currentTokens = 0;

  for (const block of blocks) {
    // +1 to budget for the "\n\n" we'll insert between blocks; cheap, conservative.
    const wouldExceed = currentTokens + block.tokens + 1 > maxTokens;
    const isHeading = isHeadingBlock(block);
    const currentHasBody =
      current.length > 0 && current.some((b) => !isHeadingBlock(b));

    if (current.length > 0 && (wouldExceed || (isHeading && currentHasBody))) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(block);
    currentTokens += block.tokens + 1;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function isHeadingBlock(block: Block): boolean {
  return HEADING_RE.test(block.text.split("\n", 1)[0]);
}

/**
 * Prepend the tail of each chunk to the next chunk so adjacent chunks share
 * `overlap` tokens. The overlap is taken from the END of the previous chunk
 * — that way the model reading the next chunk has context for what came
 * just before.
 */
function applyOverlap(chunks: Block[][], overlap: number): Block[][] {
  const result: Block[][] = [];
  let carry: Block | null = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const withCarry = carry ? [carry, ...chunk] : chunk;
    result.push(withCarry);

    // Build the carry for the NEXT chunk from the tail of THIS chunk's
    // original text (not the version with prior carry, to avoid runaway
    // accumulation).
    const tailText = takeTailTokens(chunk, overlap);
    carry = tailText
      ? {
          text: tailText,
          tokens: estimateTokens(tailText),
          headingPath: chunk[chunk.length - 1]?.headingPath ?? [],
        }
      : null;
  }

  return result;
}

function takeTailTokens(blocks: Block[], overlap: number): string {
  if (blocks.length === 0) return "";
  const joined = blocks.map((b) => b.text).join("\n\n");
  const tailChars = overlap * 4;
  if (joined.length <= tailChars) return joined;
  return joined.slice(joined.length - tailChars);
}
