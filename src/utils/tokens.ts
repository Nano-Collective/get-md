// src/utils/tokens.ts

/**
 * Average characters per token for OpenAI/Anthropic-family tokenizers on
 * English-leaning text. Code, JSON, and CJK text trend lower; long URLs and
 * punctuation-heavy fragments trend higher. The estimate is intentionally
 * conservative (rounds up) so callers using it to budget context size or
 * decide whether to chunk don't undercount.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Estimate the token count of a string using a chars/4 heuristic.
 *
 * Designed for budgeting context windows and deciding whether to chunk a
 * document — not for precise billing. For an exact count, run the text
 * through the target model's tokenizer (e.g. `tiktoken`, `gpt-tokenizer`).
 *
 * @example
 * ```typescript
 * import { estimateTokens } from '@nanocollective/get-md';
 *
 * const tokens = estimateTokens(result.markdown);
 * if (tokens > 8000) {
 *   // chunk before sending to the model
 * }
 * ```
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
