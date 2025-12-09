// src/converters/llm-converter.ts

import {
  getLlama,
  LlamaModel,
  LlamaContext,
  LlamaCompletion,
  type Llama,
} from "node-llama-cpp";
import type { LLMEventCallback } from "../types.js";

// Default conversion parameters
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 512000;

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
      // Initialize llama.cpp
      this.llama = await getLlama();

      // Load the model
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
   * Convert HTML to Markdown using the LLM
   *
   * ReaderLM-v2 uses a specific prompt format:
   * <|html|>{html_content}<|md|>
   *
   * The model then generates the markdown output.
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
      // Create the prompt using ReaderLM-v2's format
      const prompt = `<|html|>${html}<|md|>`;

      // Create completion instance
      const completion = new LlamaCompletion({
        contextSequence: this.context.getSequence(),
      });

      let tokensProcessed = 0;

      // Generate the markdown
      const result = await completion.generateCompletion(prompt, {
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
