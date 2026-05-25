---
title: "API Reference"
description: "Full API reference for the get-md library"
sidebar_order: 4
---

# API Reference

Complete reference for the get-md library API.

## In This Section

- [convertToMarkdown](convert-to-markdown.md) — The main conversion function
- [Model Management](model-management.md) — LLM model management functions

## Overview

| Function | Description |
|----------|-------------|
| [`convertToMarkdown()`](convert-to-markdown.md) | Convert HTML or a URL to clean Markdown |
| `convertBatch()` | Async iterator that converts many URLs with bounded concurrency — see [Batch Mode](../guides/batch.md) |
| `convertBatchAll()` | Promise-based convenience over `convertBatch` |
| `parseSitemap()` | Fetch and parse a sitemap.xml (handles nested sitemap indexes) — see [Sitemap Crawling](../guides/sitemap.md) |
| `convertSitemap()` | Walk a sitemap and convert every page (async iterator) |
| `chunkMarkdown()` | Split Markdown into LLM-friendly chunks at heading boundaries |
| `estimateTokens()` | Quick chars/4 token estimate for context budgeting |
| [`checkLLMModel()`](model-management.md) | Check if the LLM model is downloaded |
| [`downloadLLMModel()`](model-management.md) | Download the LLM model |
| [`getLLMModelInfo()`](model-management.md) | Get model path and details |
| [`removeLLMModel()`](model-management.md) | Remove the downloaded model |
