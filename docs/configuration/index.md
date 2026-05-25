---
title: "Configuration"
description: "Configuration file reference for get-md default options"
sidebar_order: 7
---

# Configuration

get-md supports configuration files for setting default options. This lets you avoid repeating the same flags or options across conversions.

## Config File

Create `.getmdrc` or `get-md.config.json` in your project or home directory:

```json
{
  "useLLM": true,
  "llmTemperature": 0.1,
  "llmFallback": true,
  "extractContent": true,
  "includeMeta": true,
  "includeImages": true,
  "includeLinks": true,
  "includeTables": true,
  "aggressiveCleanup": true
}
```

## Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `extractContent` | boolean | `true` | Use Mozilla Readability to extract main content |
| `includeMeta` | boolean | `true` | Include YAML frontmatter metadata |
| `includeImages` | boolean | `true` | Include images in output |
| `includeLinks` | boolean | `true` | Include links in output |
| `includeTables` | boolean | `true` | Include tables in output |
| `aggressiveCleanup` | boolean | `true` | Remove ads, navigation, and noise |
| `maxLength` | number | `1000000` | Maximum output character length |
| `baseUrl` | string | — | Base URL for resolving relative links |
| `useLLM` | boolean | `false` | Use LLM for conversion by default |
| `llmModelPath` | string | — | Custom model file path |
| `llmTemperature` | number | `0.1` | LLM generation temperature |
| `llmMaxTokens` | number | `8192` | LLM context window (input + generation), capped at 32768 on the local llama.cpp path |
| `llmFallback` | boolean | `true` | Fall back to Turndown on LLM error |
| `llm` | object | — | Pluggable LLM backend block — see below |

## Pluggable LLM backend (`llm`)

Since v1.5.0, the `llm` block selects which LLM backend `useLLM: true` routes through. Defaults to local ReaderLM-v2 when omitted, so existing setups keep working.

```json
{
  "useLLM": true,
  "llm": {
    "sdkProvider": "openai-compatible",
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKey": "${OPENROUTER_API_KEY}",
    "model": "anthropic/claude-haiku-4.5"
  }
}
```

String values support `${ENV_VAR}` substitution, with optional defaults via `${VAR:-fallback}`. See [Remote LLM Providers](../guides/remote-llm.md) for per-provider recipes and the full field reference.

## Priority

Options are applied in this order (later overrides earlier):

1. **Built-in defaults** — The defaults listed above
2. **Config file** — Settings from `.getmdrc` or `get-md.config.json`
3. **CLI flags / API options** — Flags passed on the command line or options passed to `convertToMarkdown()`

## Viewing Current Config

```bash
getmd --show-config
```

This displays the merged configuration from all sources.

## Config File Locations

get-md searches for config files in the following order:

1. Current working directory (`.getmdrc` or `get-md.config.json`)
2. Home directory (`~/.getmdrc` or `~/get-md.config.json`)

The first file found is used.

## See Also

- [CLI](../cli/index.md) — Command-line flags that override config
- [API Reference](../api/convert-to-markdown.md) — All available options
- [LLM Conversion](../guides/llm-conversion.md) — LLM-specific configuration
