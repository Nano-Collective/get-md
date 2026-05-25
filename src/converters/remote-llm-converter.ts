// src/converters/remote-llm-converter.ts

// Remote (AI SDK) HTML→Markdown converter. Routes any non-local-llama
// sdkProvider through the Vercel AI SDK so one config shape covers Ollama,
// OpenRouter, Together, Groq, LM Studio, OpenAI, Anthropic, and Google.

import type { LLMEventCallback, RemoteLlmConfig } from "../types.js";
import { loadAiCore, loadProvider } from "./load-ai-sdk.js";

const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 8192;

const SYSTEM_PROMPT =
  "You are an expert at converting HTML into clean, well-structured Markdown for downstream LLM consumption. " +
  "Preserve the document's headings, lists, tables, code blocks, links, and images. " +
  "Strip navigation, ads, scripts, cookie banners, and other non-content chrome. " +
  "Output ONLY the Markdown — no preamble, no commentary, no surrounding code fences.";

function buildUserPrompt(html: string): string {
  return `Convert the following HTML to clean Markdown.\n\nHTML:\n\`\`\`html\n${html}\n\`\`\``;
}

/**
 * Strip a wrapping markdown code fence if the model returns one. Cheap
 * defence — even with a clear system prompt some models still wrap.
 */
function stripFenceWrapper(output: string): string {
  const trimmed = output.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/);
  return match ? match[1].trim() : trimmed;
}

/**
 * Convert HTML to Markdown via any remote LLM provider supported by the AI
 * SDK. Mirrors the event surface of `LLMConverter` (the local llama.cpp
 * path) so the CLI progress UX stays consistent across providers.
 */
export class RemoteLlmConverter {
  private config: RemoteLlmConfig;
  private eventCallback?: LLMEventCallback;

  constructor(options: {
    config: RemoteLlmConfig;
    onEvent?: LLMEventCallback;
  }) {
    this.config = options.config;
    this.eventCallback = options.onEvent;
  }

  private async emit(event: Parameters<LLMEventCallback>[0]): Promise<void> {
    if (this.eventCallback) await this.eventCallback(event);
  }

  /** No persistent state — kept for parity with LLMConverter's lifecycle */
  isLoaded(): boolean {
    return true;
  }

  /** No persistent state to free — kept for parity with LLMConverter */
  async unload(): Promise<void> {
    // intentional no-op
  }

  /**
   * Convert HTML to Markdown by calling the configured remote provider.
   */
  async convert(html: string): Promise<string> {
    const startTime = Date.now();

    await this.emit({ type: "model-loading", modelName: this.config.model });
    await this.emit({ type: "model-file-loading", path: this.config.model });

    const provider = await this.buildProvider();
    const aiCore = await loadAiCore();

    await this.emit({
      type: "model-loaded",
      loadTime: Date.now() - startTime,
    });

    await this.emit({ type: "conversion-start", inputSize: html.length });

    try {
      const result = await aiCore.generateText({
        model: provider(this.config.model),
        system: SYSTEM_PROMPT,
        prompt: buildUserPrompt(html),
        temperature: this.config.temperature ?? DEFAULT_TEMPERATURE,
        maxOutputTokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
      });

      const markdown = stripFenceWrapper(result.text);

      await this.emit({
        type: "conversion-complete",
        outputSize: markdown.length,
        duration: Date.now() - startTime,
      });

      return markdown;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.emit({ type: "conversion-error", error: err });
      throw err;
    }
  }

  /**
   * Build the AI SDK model provider matching this config's sdkProvider.
   * Lazy-loaded so consumers who never use a given provider don't pay its
   * cost.
   */
  private async buildProvider(): Promise<
    (
      modelId: string,
    ) => Parameters<typeof import("ai").generateText>[0]["model"]
  > {
    const { module } = await loadProvider(this.config);

    if (this.config.sdkProvider === "openai-compatible") {
      if (!this.config.baseUrl) {
        throw new Error(
          'RemoteLlmConverter: "openai-compatible" requires a baseUrl',
        );
      }
      const openai = module as typeof import("@ai-sdk/openai-compatible");
      const factory = openai.createOpenAICompatible({
        name: this.config.name ?? "openai-compatible",
        baseURL: this.config.baseUrl,
        apiKey: this.config.apiKey ?? "dummy-key",
      });
      return (modelId) => factory(modelId);
    }

    if (this.config.sdkProvider === "anthropic") {
      const anthropic = module as typeof import("@ai-sdk/anthropic");
      const factory = anthropic.createAnthropic({
        apiKey: this.config.apiKey ?? "",
      });
      return (modelId) => factory(modelId);
    }

    // google
    const google = module as typeof import("@ai-sdk/google");
    const factory = google.createGoogleGenerativeAI({
      apiKey: this.config.apiKey ?? "",
    });
    return (modelId) => factory(modelId);
  }
}

/**
 * Convenience factory matching the shape of `createLLMConverter`.
 */
export function createRemoteLlmConverter(options: {
  config: RemoteLlmConfig;
  onEvent?: LLMEventCallback;
}): RemoteLlmConverter {
  return new RemoteLlmConverter(options);
}
