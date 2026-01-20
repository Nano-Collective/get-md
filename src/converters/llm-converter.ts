// src/converters/llm-converter.ts

import {
  getLlama,
  type Llama,
  LlamaChatSession,
  type LlamaContext,
  type LlamaModel,
} from "node-llama-cpp";
import type { LLMEventCallback } from "../types.js";

// Default conversion parameters
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_MAX_TOKENS = 4096;

/**
 * LLM Converter - handles HTML to Markdown conversion using a local LLM
 *
 * Uses ReaderLM-v2 which is specifically trained for HTML to Markdown conversion.
 * The model uses a special prompt format with <|html|> and <|md|> tags.
 */
export class LLMConverter {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private modelPath: string;
  private eventCallback?: LLMEventCallback;
  private temperature: number;
  private maxTokens: number;

  constructor(options: {
    modelPath: string;
    onEvent?: LLMEventCallback;
    temperature?: number;
    maxTokens?: number;
  }) {
    this.modelPath = options.modelPath;
    this.eventCallback = options.onEvent;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  /**
   * Emit an event to the callback if registered
   */
  private async emit(event: Parameters<LLMEventCallback>[0]): Promise<void> {
    if (this.eventCallback) {
      await this.eventCallback(event);
    }
  }

  /**
   * Load the model into memory
   */
  async loadModel(): Promise<void> {
    const startTime = Date.now();

    await this.emit({
      type: "model-loading",
      modelName: "ReaderLM-v2",
    });

    try {
      // Initialize llama.cpp (may compile binaries on first run - can take minutes)
      await this.emit({
        type: "llama-init-start",
      });
      this.llama = await getLlama();
      await this.emit({
        type: "llama-init-complete",
      });

      // Load the model into memory
      await this.emit({
        type: "model-file-loading",
        path: this.modelPath,
      });
      this.model = await this.llama.loadModel({
        modelPath: this.modelPath,
      });

      // Create context with generous token limit for long documents
      this.context = await this.model.createContext({
        contextSize: Math.min(this.maxTokens, 8192), // Balance between capability and memory
      });

      const loadTime = Date.now() - startTime;

      await this.emit({
        type: "model-loaded",
        loadTime,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Failed to load LLM model: ${err.message}`);
    }
  }

  /**
   * Check if the model is loaded
   */
  isLoaded(): boolean {
    return this.model !== null && this.context !== null;
  }

  /**
   * Unload the model to free memory
   */
  async unload(): Promise<void> {
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    if (this.llama) {
      await this.llama.dispose();
      this.llama = null;
    }
  }

  /**
   * Clean up the LLM output by removing markdown code block wrappers
   */
  private cleanupOutput(output: string): string {
    let cleaned = output.trim();

    // Remove markdown code block wrapper if present
    // Matches ```markdown, ```md, or just ```
    const codeBlockMatch = cleaned.match(
      /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/,
    );
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1];
    }

    return cleaned.trim();
  }

  /**
   * Convert HTML to Markdown using the LLM
   *
   * ReaderLM-v2 is built on Qwen2.5-1.5B-Instruction and uses a chat format.
   * The prompt follows the format from the official examples.
   */
  async convert(html: string): Promise<string> {
    if (!this.model || !this.context) {
      throw new Error("Model not loaded. Call loadModel() first.");
    }

    const startTime = Date.now();

    await this.emit({
      type: "conversion-start",
      inputSize: html.length,
    });

    try {
      // Create chat session for proper Qwen2.5 chat template handling
      const session = new LlamaChatSession({
        contextSequence: this.context.getSequence(),
      });

      // Create the prompt using ReaderLM-v2's format
      // Based on the official example: instruction + html in code block
      const prompt = `Extract the main content from the given HTML and convert it to Markdown format.
\`\`\`html
${html}
\`\`\``;

      let tokensProcessed = 0;

      // Generate the markdown using chat
      const rawResult = await session.prompt(prompt, {
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        onTextChunk: () => {
          tokensProcessed++;
          // Emit progress periodically (every 100 tokens)
          if (tokensProcessed % 100 === 0) {
            void this.emit({
              type: "conversion-progress",
              tokensProcessed,
            });
          }
        },
      });

      // Clean up the result - remove markdown code block wrapper if present
      const result = this.cleanupOutput(rawResult);

      const duration = Date.now() - startTime;

      await this.emit({
        type: "conversion-complete",
        outputSize: result.length,
        duration,
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      await this.emit({
        type: "conversion-error",
        error: err,
      });

      throw err;
    }
  }
}

/**
 * Create an LLM converter instance
 *
 * @example
 * ```typescript
 * const converter = createLLMConverter({
 *   modelPath: '/path/to/model.gguf',
 *   onEvent: (event) => console.log(event),
 * });
 *
 * await converter.loadModel();
 * const markdown = await converter.convert('<h1>Hello</h1>');
 * await converter.unload();
 * ```
 */
export function createLLMConverter(options: {
  modelPath: string;
  onEvent?: LLMEventCallback;
  temperature?: number;
  maxTokens?: number;
}): LLMConverter {
  return new LLMConverter(options);
}
