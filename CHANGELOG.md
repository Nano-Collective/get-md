# 1.6.0

## New features

- **PDF Support** — added support for PDF file processing and extraction using `pdf-parse`.
- **DOCX Support** — added DOCX to Markdown conversion support with accurate heading and structure preservation.
- **Markdown Support** — added automatic input type detection to allow direct ingestion of `.md` files without intermediate HTML conversion.
- **Unified Content Ingestion** — introduced `ContentSource` abstraction to support structured input with metadata across multiple input types.

## Documentation

- **Docs / Marketing** — updated repository descriptions and docs to highlight the new PDF, DOCX, and Markdown support.

## Bug fixes

- **LLM Noise Reduction** — improved noise reduction and metadata extraction for LLM consumption.
- **DOCX Processing** — removed double HTML escaping in paragraph processing and resolved CI pipeline issues for DOCX files.

## Repository configuration

- **Added CODEOWNERS** — added a `CODEOWNERS` file to define default reviewers.

# 1.5.0

Big release. Adds a pluggable LLM backend, batch + sitemap crawling, image localization, an HTTP cache with retry/backoff, and the helper functions that make get-md useful as a RAG ingestion building block. Plus a sweep of bug fixes from a top-to-bottom review of the 1.4.x surface.

## New features

### Pluggable LLM backend

`useLLM: true` is no longer hard-wired to local ReaderLM-v2 — it now routes through whichever provider you configure. Mirrors the same `sdkProvider` shape used by [nanotune](https://github.com/Nano-Collective/nanotune) and [nano-coder](https://github.com/Nano-Collective/nano-coder), so one config covers the Nano Collective stack.

- **Providers:** `openai-compatible` (covers Ollama, OpenRouter, Together, Groq, LM Studio, OpenAI, vLLM), `anthropic`, `google`, `local-llama`. Defaults to `local-llama` when `useLLM: true` and no `llm` block is set, so existing setups keep working unchanged.
- **Optional peer deps:** `ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/anthropic`, `@ai-sdk/google` — install only the provider you actually use. Missing peer deps surface a clear "install this" error, not `ERR_MODULE_NOT_FOUND`.
- **`${ENV_VAR}` substitution** in config files (recursive, including `${VAR:-default}` form), so `apiKey` never has to live in committed JSON.
- **CLI flags:** `--llm-provider`, `--llm-base-url`, `--llm-model`, `--llm-api-key`. `--show-config` redacts `apiKey` when printing.
- See the new [Remote LLM Providers guide](docs/guides/remote-llm.md).

### Batch mode

- **`convertBatch(urls, options)`** — async iterator that yields per-URL results as they complete, with bounded concurrency.
- **`convertBatchAll(urls, options)`** — Promise convenience that buffers into an array.
- **CLI:** `--batch <file>` reads URLs (one per line, `#` comments and blanks stripped), `-o <dir>` writes one `.md` per URL, `--concurrency` (default 5), `--stop-on-error` (default: continue), `--name-pattern` (default `{host}-{slug}.md` with `{host}/{path}/{slug}/{index}` placeholders), `--manifest <file>` for a JSON summary.
- `--json` in batch mode emits **JSONL** (one result per line) for streaming into `jq` or other tools.

### Sitemap crawling

- **`parseSitemap(source, options)`** — fetch a sitemap URL (or parse raw XML), recursively follow `<sitemapindex>` files, return a flat URL list.
- **`convertSitemap(sitemapUrl, options)`** — async iterator that yields `BatchResult` per page; composes `parseSitemap` + `convertBatch`.
- **CLI:** `--sitemap <url>`, `--include <glob>` and `--exclude <glob>` (both repeatable; `*` matches no slashes, `**` matches any chars), `--max-depth` (default 3), `--max-urls` (default 10000).
- See the new [Sitemap Crawling guide](docs/guides/sitemap.md).

### LLM workflow helpers

- **`chunkMarkdown(md, { maxTokens, overlap?, includeHeadingPath? })`** — split markdown at heading boundaries for RAG ingestion. Tracks `headingPath` per chunk, prepends the trail to continuation chunks, supports overlap.
- **`estimateTokens(text)`** — chars/4 heuristic for quick context budgeting. Available as a standalone export and surfaced automatically on `ConversionStats.estimatedTokens` for every conversion.
- **`--json` CLI flag** emits `{ markdown, metadata, stats }` for the single-URL path too.

### Image localization

- **`downloadImages: '<dir>'`** option on `convertToMarkdown` (CLI: `--download-images <dir>`) downloads referenced images in parallel and rewrites the markdown `src` to point at the local copies. Per-image failures log a warning but never fail the conversion. Deduplicates URLs referenced multiple times. Filenames are deterministic (`<sha256-prefix>.<ext>`) so re-runs overwrite cleanly.
- **Smart path rewriting** — when given an `outputPath`, the rewrite produces a path relative to the markdown file's directory. Markdown at `./out/page.md` with images at `./out/assets/foo.png` correctly gets `./assets/foo.png` refs.
- **CLI auto-baseUrl** — when the positional input is a URL, the CLI now sets that as the implicit `baseUrl` so relative image refs (`/images/logo.svg`) resolve correctly without having to pass `--base-url` manually.
- **Lazy-load support** — HTML cleaner preserves `data-src`, `data-original`, `data-lazy-src`, and `srcset` on `<img>` tags (and resolves them against the base URL). Wikipedia, Medium, Substack, and most modern blog platforms use these for lazy loading; without preservation, only 1×1 placeholders survive.

### HTTP cache + retry

- **Retries on transient failures** — network errors, 5xx, 429. Exponential backoff with ≤25% jitter. Honors `Retry-After` header on 429 (parses both seconds and HTTP-date forms). New options: `retries` (default 2), `retryDelay` (default 500ms). CLI: `--retries`, `--retry-delay`.
- **File-system cache** — opt-in via `cache: true` (uses `~/.get-md/cache`) or `cache: '<path>'`. Cache hits skip the network entirely (and the retry loop). New options: `cache`, `cacheMaxAge` (default 1 hour). CLI: `--cache`, `--cache-dir`, `--cache-max-age <seconds>`. Best-effort: cache failures fall back to a live fetch, never throw.

## Bug fixes

- **`getmd --version`** was hardcoded to `"1.0.0"`. Now reads from `package.json` at runtime.
- **Model size copy fixed** — text said "986MB" (the legacy model) but the actual shipped Q4_K_M is 1.12GB. Updated everywhere.
- **`llmMaxTokens` default lowered to 8192** (was 512000, which was always capped at 8192 by the converter — the documented number was a lie). Internal `LLMConverter` defaults reconciled to match the public ones (`0.1` / `8192`).
- **Stale `dist/parsers/json-parser.*`** removed (leftover from a deleted feature). `ajv` dependency dropped — it was unused in `src/`. Build script now does `rm -rf dist` before `tsc` so this can't recur. CLI description no longer claims "extract structured JSON".
- **Custom-rule state leak fixed** — `MarkdownParser` was reusing a single `TurndownService` across calls, causing user-supplied `customRules` to accumulate between conversions. Now constructs a fresh instance per `convert()`.
- **`Required<MarkdownOptions>` cast** in `normalizeOptions` replaced with a proper `NormalizedMarkdownOptions` type so optional fields stay optional. No more type holes.
- **`fetchUrl` size cap** — new `maxBytes` option (default 10MB). Aborts the fetch if `Content-Length` declares more, and stream-aborts mid-flight if a server lies about / omits it. Prevents a hostile or misbehaving URL from forcing unbounded buffering.
- **`-o ./nested/file.md`** now auto-creates the parent directory instead of crashing with `ENOENT`. Affects single-URL output, `--compare`'s pair of outputs, and `--manifest`.

## Documentation

- New API reference pages: `docs/api/batch.md`, `docs/api/sitemap.md`, `docs/api/utilities.md`. Plus a restructured `docs/api/index.md` with every public export linked. The old `convertToMarkdown()` page is now "Conversion API" (URL slug unchanged so deep links don't break).
- New guides: `docs/guides/remote-llm.md`, `docs/guides/batch.md`, `docs/guides/sitemap.md`.
- Per-feature crib sheets in the repo root (`SMOKE_TESTS.md`, `CRAWL_SITEMAP.md`, `TEST_IMAGES.md`) for manual verification.

## Tests

528 passing (up from 405 at 1.4.1). Adds coverage for: retry on 5xx/429/network errors and `Retry-After` honoring, HTTP cache hit/miss/TTL, image localization with relative refs and `baseUrl`, protocol-relative URLs, non-http(s) scheme skipping, CLI auto-baseUrl end-to-end, sitemap parsing (flat and nested), batch concurrency caps, chunking heading boundaries, env-var substitution, JSON output (single + JSONL), and more.

If there are any problems, feedback or thoughts please drop an issue or message us through Discord! Thank you for using get-md.

# 1.4.1

## Toolchain

- **Bumped to pnpm 11 and Node.js 22** — `packageManager` field pinned in `package.json` so CI and contributors stay in sync.
- **Regenerated `pnpm-lock.yaml`** under pnpm 11 to fix `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` on frozen installs.
- **Raised `engines.node` to `>=22`** and updated CONTRIBUTING and installation docs to match.

# 1.4.0

- **BREAKING for LLM API consumers**: `node-llama-cpp` moved from `dependencies` to an **optional peer dependency**. Consumers who only use the standard HTML→Markdown path (`convertToMarkdown`, `hasContent`, etc.) no longer install ~500 MB of platform-specific native binaries (CUDA, Vulkan, Metal, ARM variants — all fetched by pnpm/npm regardless of host). To use `LLMConverter`, `LLMManager`, `createLLMConverter`, or `getmd --download-model`, install it alongside get-md: `npm install @nanocollective/get-md node-llama-cpp`. Calling any LLM API without the peer installed throws a clear, actionable error via the new `loadNodeLlamaCpp` helper instead of a generic `ERR_MODULE_NOT_FOUND`.

# 1.3.1

- Documentation updates to reflect brand guidelines

# 1.3.0

- Lazy-loaded `node-llama-cpp` so it's only imported when an LLM operation is actually invoked (`downloadModel`, `LLMConverter.loadModel`, `LLMConverter.convert`). Consumers using only the HTML→Markdown path (`convertToMarkdown`, `checkLLMModel`, `removeLLMModel`, `getLLMModelInfo`) no longer pay the ~600-module cost of loading the native llama.cpp binding at import time. The public API is unchanged.

# 1.2.0

- Refactored docs so that it works with Nano Collective docs site.

# 1.1.1

- Updated docs

# 1.1.0

- Added optional LLM-powered HTML to Markdown conversion using ReaderLM-v2
    - New `useLLM` option for SDK and `--use-llm` flag for CLI
    - Local inference via GGUF model (~986MB download)
    - Supports up to 512,000 tokens with 29 languages
    - Automatic fallback to Turndown on errors

- Added LLM model management
    - `checkLLMModel()` - Check if model is downloaded
    - `downloadLLMModel()` - Download with progress tracking
    - `removeLLMModel()` - Remove the downloaded model
    - `getLLMModelInfo()` - Get model information and variants

- Added CLI model management commands
    - `--model-info` - Show model status and information
    - `--download-model` - Pre-download the model
    - `--remove-model` - Remove downloaded model
    - `--model-path` - Show default model directory

- Added configuration file support
    - Support for `.getmdrc` or `get-md.config.json`
    - `--show-config` to display current configuration
    - CLI flags override config file settings

- Added comparison mode
    - `--compare` flag to run both Turndown and LLM side-by-side
    - Shows timing and output size statistics

- Added event callbacks for LLM operations
    - `onLLMEvent` callback for all LLM events
    - Progress tracking for downloads and conversions

- Updated release workflow to support beta/alpha/rc versions
    - Beta versions publish to npm with `beta` tag
    - GitHub releases marked as prerelease for beta versions

If there are any problems, feedback or thoughts please drop an issue or message us through Discord! Thank you for using get-md.

# 1.1.0-beta.1

- Added optional LLM-powered HTML to Markdown conversion using ReaderLM-v2
    - New `useLLM` option for SDK and `--use-llm` flag for CLI
    - Local inference via GGUF model (~986MB download)
    - Supports up to 512,000 tokens with 29 languages
    - Automatic fallback to Turndown on errors

- Added LLM model management
    - `checkLLMModel()` - Check if model is downloaded
    - `downloadLLMModel()` - Download with progress tracking
    - `removeLLMModel()` - Remove the downloaded model
    - `getLLMModelInfo()` - Get model information and variants

- Added CLI model management commands
    - `--model-info` - Show model status and information
    - `--download-model` - Pre-download the model
    - `--remove-model` - Remove downloaded model
    - `--model-path` - Show default model directory

- Added configuration file support
    - Support for `.getmdrc` or `get-md.config.json`
    - `--show-config` to display current configuration
    - CLI flags override config file settings

- Added comparison mode
    - `--compare` flag to run both Turndown and LLM side-by-side
    - Shows timing and output size statistics

- Added event callbacks for LLM operations
    - `onLLMEvent` callback for all LLM events
    - Progress tracking for downloads and conversions

- Updated release workflow to support beta/alpha/rc versions
    - Beta versions publish to npm with `beta` tag
    - GitHub releases marked as prerelease for beta versions

If there are any problems, feedback or thoughts please drop an issue or message us through Discord! Thank you for using get-md.

# 1.0.3

- Added React Native support
    - Replaced `JSDOM` with `happy-dom-without-node` for universal DOM implementation.
    - Switched to cheerio/slim for better React Native compatibility.

- Switched to Biome for formatting and linting, replacing Prettier and ESLint for faster, more consistent code quality tooling.

If there are any problems, feedback or thoughts please drop an issue or message us through Discord! Thank you for using get-md.

# 1.0.2

- Removed warning notice from README.

If there are any problems, feedback or thoughts please drop an issue or message us through Discord! Thank you for using get-md.

# 1.0.1

- Fix: Issue #1 where codeblocks were not being brought in.

If there are any problems, feedback or thoughts please drop an issue or message us through Discord! Thank you for using get-md.

# 1.0.0

- Initial release of get-md - a fast, lightweight HTML to Markdown converter optimized for LLM consumption
- Lightning-fast conversion: converts HTML to Markdown in <100ms
- Intelligent content extraction using Mozilla Readability to extract main content and remove noise
- CLI tool (`getmd`) for command-line usage with support for stdin, files, and URLs
- Library API with `convertToMarkdown()` function for programmatic use
- Automatic URL detection and fetching with configurable timeout, headers, and redirect handling
- YAML frontmatter metadata extraction (title, author, reading time, etc.)
- Configurable content filtering: toggle images, links, tables, and aggressive cleanup
- Base URL support for resolving relative links
- Full TypeScript support with complete type definitions
- Zero external model dependencies - works instantly with no downloads
- Lightweight package size (~10MB)

If there are any problems, feedback or thoughts please drop an issue or message us through Discord! Thank you for using get-md.
