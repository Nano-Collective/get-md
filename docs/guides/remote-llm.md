---
title: "Remote LLM Providers"
description: "Pluggable LLM backend — point get-md at Ollama, OpenRouter, Anthropic, Google, or any OpenAI-compatible endpoint"
sidebar_order: 2
---

# Remote LLM Providers

Since v1.5.0, get-md's `useLLM` mode can route through any LLM provider supported by the [Vercel AI SDK](https://sdk.vercel.ai), not just the local ReaderLM-v2 model. One config shape covers Ollama, OpenRouter, Together, Groq, LM Studio, OpenAI, Anthropic, and Google.

The local ReaderLM-v2 path is still the default when no provider is configured — nothing changes for existing users.

## Install the SDK you need

The AI SDK packages are **optional peer dependencies**. Install only the ones you actually use:

```bash
# OpenAI-compatible (covers Ollama, OpenRouter, Together, Groq, LM Studio, llama.cpp server, OpenAI, vLLM)
npm install @nanocollective/get-md ai @ai-sdk/openai-compatible

# Anthropic (Claude)
npm install @nanocollective/get-md ai @ai-sdk/anthropic

# Google (Gemini)
npm install @nanocollective/get-md ai @ai-sdk/google
```

If a provider package is missing at runtime, get-md throws a clear error telling you which package to install.

## Configure

The easiest path is a config file: `.getmdrc`, `.getmdrc.json`, `get-md.config.json`, or `getmd.config.json` in your project root (or `~/`). Add an `llm` block.

String values support `${ENV_VAR}` substitution so API keys never need to live in the file.

### OpenRouter (or any OpenAI-compatible endpoint)

```json
{
  "llm": {
    "sdkProvider": "openai-compatible",
    "name": "OpenRouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKey": "${OPENROUTER_API_KEY}",
    "model": "anthropic/claude-haiku-4.5"
  }
}
```

### Ollama (local, no API key)

```json
{
  "llm": {
    "sdkProvider": "openai-compatible",
    "name": "Ollama",
    "baseUrl": "http://localhost:11434/v1",
    "model": "qwen2.5:7b"
  }
}
```

### Anthropic (Claude API)

```json
{
  "llm": {
    "sdkProvider": "anthropic",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "model": "claude-haiku-4-5"
  }
}
```

### Google (Gemini)

```json
{
  "llm": {
    "sdkProvider": "google",
    "apiKey": "${GOOGLE_GENERATIVE_AI_API_KEY}",
    "model": "gemini-2.5-flash"
  }
}
```

### Local ReaderLM (the default — included for completeness)

```json
{
  "llm": {
    "sdkProvider": "local-llama"
  }
}
```

## Use it

Once the config file is in place, every `useLLM: true` call uses your configured provider:

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

const result = await convertToMarkdown("https://example.com", { useLLM: true });
console.log(result.markdown);
```

Or pass the config inline if you don't want a file:

```typescript
const result = await convertToMarkdown("https://example.com", {
  useLLM: true,
  llm: {
    sdkProvider: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    model: "anthropic/claude-haiku-4.5",
  },
});
```

From the CLI, override config-file values with flags:

```bash
getmd https://example.com \
  --use-llm \
  --llm-provider openai-compatible \
  --llm-base-url https://openrouter.ai/api/v1 \
  --llm-model anthropic/claude-haiku-4.5 \
  --llm-api-key "$OPENROUTER_API_KEY"
```

`getmd --show-config` prints the resolved configuration with `apiKey` redacted, so you can confirm what get-md is actually loading.

## Config precedence

When the same option is set in multiple places, later overrides earlier:

1. Built-in defaults (local-llama)
2. `~/.getmdrc` (or other home-directory config)
3. `./.getmdrc` (or other cwd config)
4. CLI flags / `convertToMarkdown` options

## Options reference

| Field | Required | Notes |
|-------|----------|-------|
| `sdkProvider` | yes | `openai-compatible` \| `anthropic` \| `google` \| `local-llama` |
| `model` | yes (remote) | Model identifier passed to the provider |
| `baseUrl` | yes for `openai-compatible` | API root URL |
| `apiKey` | usually | Supports `${ENV_VAR}` in config files |
| `name` | no | Display name shown in errors and `--show-config` |
| `temperature` | no | 0–2, default `0.1` |
| `maxTokens` | no | Default `8192` |
| `modelPath` | no (local-llama only) | Override the GGUF path |

## See Also

- [LLM Conversion](./llm-conversion.md) — Local ReaderLM-v2 path
- [Configuration](../configuration/index.md) — Full config file reference
