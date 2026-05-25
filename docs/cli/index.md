---
title: "CLI"
description: "Command-line interface reference for get-md"
sidebar_order: 5
---

# CLI

get-md includes a command-line interface for quick conversions from your terminal.

## Usage

```bash
getmd [input] [options]
```

## Input Sources

The CLI accepts input from multiple sources:

```bash
# From stdin
echo '<h1>Hello</h1>' | getmd

# From a file
getmd input.html

# From a URL
getmd https://example.com
```

## Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output file (default: stdout) |
| `--no-extract` | Disable Readability content extraction |
| `--no-frontmatter` | Exclude metadata from YAML frontmatter |
| `--no-images` | Remove images from output |
| `--no-links` | Remove links from output |
| `--no-tables` | Remove tables from output |
| `--max-length <n>` | Maximum output length (default: 1000000) |
| `--base-url <url>` | Base URL for resolving relative links |
| `--download-images <dir>` | Download referenced images to `<dir>` and rewrite the markdown `src` to point at the local copies |
| `-v, --verbose` | Verbose output |
| `-h, --help` | Display help |

### Network Options

| Option | Description |
|--------|-------------|
| `--retries <n>` | Retry attempts on transient HTTP failures: 5xx, 429, network errors (default: 2) |
| `--retry-delay <ms>` | Initial backoff between retries in ms (default: 500). Exponential + jitter. Respects `Retry-After` header on 429. |
| `--cache` | Cache successful responses on disk (default dir: `~/.get-md/cache`) |
| `--cache-dir <path>` | Custom directory for the HTTP cache. Implies `--cache`. |
| `--cache-max-age <seconds>` | Max age of a cached entry in seconds (default: 3600 = 1 hour) |

### LLM Options

| Option | Description |
|--------|-------------|
| `--use-llm` | Use LLM for conversion |
| `--llm-provider <name>` | `openai-compatible` \| `anthropic` \| `google` \| `local-llama` (default: local-llama) |
| `--llm-base-url <url>` | Base URL for the LLM provider (required for openai-compatible) |
| `--llm-model <id>` | Model identifier for the LLM provider |
| `--llm-api-key <key>` | API key (prefer env vars + config file) |
| `--model-info` | Check model status |
| `--download-model` | Download the LLM model |
| `--remove-model` | Remove the LLM model |
| `--model-path` | Show default model path |
| `--compare` | Compare Turndown vs LLM output |
| `--show-config` | Show current configuration |

### Batch Mode

See [Batch Mode](../guides/batch.md) for a full walkthrough.

| Option | Description |
|--------|-------------|
| `--batch <file>` | Read URLs from `<file>` (one per line, `#` comments allowed) |
| `--concurrency <n>` | Max parallel conversions (default: 5) |
| `--name-pattern <pattern>` | Filename pattern for batch output (default: `{host}-{slug}.md`). Placeholders: `{host}`, `{path}`, `{slug}`, `{index}` |
| `--manifest <file>` | Write a JSON summary of the batch to `<file>` |
| `--stop-on-error` | Abort on first failure (default: continue and record errors) |
| `--json` | Emit `{ markdown, metadata, stats }` as JSON. In batch mode, emits JSONL (one result per line). |

### Sitemap Mode

See [Sitemap Crawling](../guides/sitemap.md) for a full walkthrough. Composes with every batch flag above.

| Option | Description |
|--------|-------------|
| `--sitemap <url>` | Walk a `sitemap.xml` (or sitemap index) and convert every URL |
| `--include <pattern>` | Only convert URLs matching this glob (repeatable). Supports `*` and `**` |
| `--exclude <pattern>` | Skip URLs matching this glob (repeatable). Applied after `--include` |
| `--max-depth <n>` | Max recursion into nested sitemap-index files (default: 3) |
| `--max-urls <n>` | Hard cap on URLs taken from a sitemap (default: 10000) |

## Examples

### Basic Conversions

```bash
# Convert HTML file (frontmatter included by default)
getmd article.html -o article.md

# Fetch from URL
getmd https://blog.example.com/post -o post.md

# Convert from stdin
cat page.html | getmd > page.md
```

### Content Filtering

```bash
# Remove images and links
getmd article.html --no-images --no-links -o clean.md

# Exclude frontmatter metadata
getmd article.html --no-frontmatter -o clean.md

# Disable content extraction (keep full HTML structure)
getmd article.html --no-extract -o full.md
```

### LLM-Powered Conversion

```bash
# Check model status
getmd --model-info

# Download model (one-time, ~1GB)
getmd --download-model

# Convert with LLM
getmd https://example.com --use-llm

# Compare Turndown vs LLM output
getmd https://example.com --compare -o comparison.md
```

### Configuration

```bash
# Show current configuration
getmd --show-config

# Show model path
getmd --model-path
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid input, network failure, etc.) |

## See Also

- [API Reference](../api/index.md) — Use get-md as a library
- [LLM Conversion](../guides/llm-conversion.md) — When and how to use LLM conversion
- [Configuration](../configuration/index.md) — Config files for default options
