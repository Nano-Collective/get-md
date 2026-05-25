---
title: "API Reference"
description: "Full API reference for the get-md library"
sidebar_order: 4
---

# API Reference

Complete reference for the get-md library API.

## In This Section

- [Conversion API](convert-to-markdown.md) — `convertToMarkdown`, `MarkdownOptions`, `MarkdownResult`
- [Batch API](batch.md) — `convertBatch`, `convertBatchAll`, types
- [Sitemap API](sitemap.md) — `parseSitemap`, `convertSitemap`, `parseSitemapXml`
- [Utilities](utilities.md) — `chunkMarkdown`, `estimateTokens`, `hasContent`, config-loader
- [Model Management](model-management.md) — LLM model lifecycle + advanced converter classes

## Overview

### Conversion

| Function | Description |
|----------|-------------|
| [`convertToMarkdown()`](convert-to-markdown.md) | Convert HTML or a URL to clean Markdown |
| [`hasContent()`](utilities.md#hascontent) | Cheap check for whether HTML has substantive text content |

### Batch & sitemap

| Function | Description |
|----------|-------------|
| [`convertBatch()`](batch.md#convertbatch) | Async iterator that converts many URLs with bounded concurrency |
| [`convertBatchAll()`](batch.md#convertbatchall) | Promise-based convenience over `convertBatch` |
| [`parseSitemap()`](sitemap.md#parsesitemap) | Fetch and parse a `sitemap.xml` (handles nested indexes) |
| [`convertSitemap()`](sitemap.md#convertsitemap) | Walk a sitemap and convert every page (async iterator) |
| [`parseSitemapXml()`](sitemap.md#parsesitemapxml) | Pure XML helper for already-fetched sitemap payloads |

### LLM workflow helpers

| Function | Description |
|----------|-------------|
| [`chunkMarkdown()`](utilities.md#chunkmarkdown) | Split Markdown into LLM-friendly chunks at heading boundaries |
| [`estimateTokens()`](utilities.md#estimatetokens) | Quick chars/4 token estimate for context budgeting |

### Model management (local LLM)

| Function | Description |
|----------|-------------|
| [`checkLLMModel()`](model-management.md) | Check if the LLM model is downloaded |
| [`downloadLLMModel()`](model-management.md) | Download the LLM model |
| [`getLLMModelInfo()`](model-management.md) | Get model path and details |
| [`removeLLMModel()`](model-management.md) | Remove the downloaded model |
| [`LLMConverter`](model-management.md#llmconverter-local-llamacpp) | Advanced: load the local model once, convert many pages |
| [`LLMManager`](model-management.md#llmmanager-model-lifecycle) | Advanced: stateful model-lifecycle helper |

### Configuration

| Function | Description |
|----------|-------------|
| [`loadConfig()`](utilities.md#config-loader-exports) | Load `.getmdrc` / `get-md.config.json` from cwd + home |
| [`loadConfigFromFile()`](utilities.md#config-loader-exports) | Load a specific config file path |
| [`findConfigPath()`](utilities.md#config-loader-exports) | Resolve which config file would be loaded |
| [`mergeConfigWithOptions()`](utilities.md#config-loader-exports) | Merge a loaded config into per-call options |
