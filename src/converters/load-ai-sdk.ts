// src/converters/load-ai-sdk.ts

// The AI SDK packages (`ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/anthropic`,
// `@ai-sdk/google`) are declared as OPTIONAL peer dependencies. Consumers who
// only use the Turndown path or the local-llama path shouldn't pay the install
// cost. This helper centralises the dynamic import and surfaces a clear,
// actionable error when a provider's package is missing.

import type { RemoteLlmConfig } from "../types.js";

type AiCore = typeof import("ai");
type OpenAiCompatible = typeof import("@ai-sdk/openai-compatible");
type Anthropic = typeof import("@ai-sdk/anthropic");
type Google = typeof import("@ai-sdk/google");

let aiCached: Promise<AiCore> | null = null;
let openaiCompatibleCached: Promise<OpenAiCompatible> | null = null;
let anthropicCached: Promise<Anthropic> | null = null;
let googleCached: Promise<Google> | null = null;

function isMissingModuleError(err: unknown, moduleName: string): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  const message = (err as Error | undefined)?.message ?? "";
  return (
    code === "ERR_MODULE_NOT_FOUND" ||
    code === "MODULE_NOT_FOUND" ||
    message.includes(moduleName)
  );
}

function missingPeerError(packageName: string, providerLabel: string): Error {
  return new Error(
    `get-md: ${providerLabel} requires the optional peer dependency "${packageName}". ` +
      `Install it alongside get-md (e.g. \`pnpm add ${packageName} ai\`) to enable remote LLM conversion. ` +
      `The HTML→Markdown path and the local-llama path work without it.`,
  );
}

/** Lazy-load the `ai` package (shared by every remote provider) */
export function loadAiCore(): Promise<AiCore> {
  if (!aiCached) {
    aiCached = import("ai").catch((err: unknown) => {
      if (isMissingModuleError(err, "ai")) {
        throw missingPeerError("ai", "Remote LLM conversion");
      }
      throw err;
    });
  }
  return aiCached;
}

/** Lazy-load the provider package matching the given config's sdkProvider */
export async function loadProvider(config: RemoteLlmConfig): Promise<{
  // Returned as `unknown` because the three providers have different shapes;
  // the converter casts to the right type after dispatching on sdkProvider.
  module: OpenAiCompatible | Anthropic | Google;
}> {
  switch (config.sdkProvider) {
    case "openai-compatible": {
      if (!openaiCompatibleCached) {
        openaiCompatibleCached = import("@ai-sdk/openai-compatible").catch(
          (err: unknown) => {
            if (isMissingModuleError(err, "@ai-sdk/openai-compatible")) {
              throw missingPeerError(
                "@ai-sdk/openai-compatible",
                "OpenAI-compatible provider",
              );
            }
            throw err;
          },
        );
      }
      return { module: await openaiCompatibleCached };
    }
    case "anthropic": {
      if (!anthropicCached) {
        anthropicCached = import("@ai-sdk/anthropic").catch((err: unknown) => {
          if (isMissingModuleError(err, "@ai-sdk/anthropic")) {
            throw missingPeerError("@ai-sdk/anthropic", "Anthropic provider");
          }
          throw err;
        });
      }
      return { module: await anthropicCached };
    }
    case "google": {
      if (!googleCached) {
        googleCached = import("@ai-sdk/google").catch((err: unknown) => {
          if (isMissingModuleError(err, "@ai-sdk/google")) {
            throw missingPeerError("@ai-sdk/google", "Google provider");
          }
          throw err;
        });
      }
      return { module: await googleCached };
    }
  }
}
