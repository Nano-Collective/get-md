# 1.7.0

Diagrams survive the trip. Where 1.6.0 taught get-md to read PDF, DOCX, and Markdown, this release is about not throwing away the one thing a Markdown converter usually destroys: **Mermaid diagrams**. get-md now preserves fences it finds, recovers source from diagrams a browser has already rendered to `<svg>`, optionally reconstructs diagrams drawn into a PDF using a vision model, and optionally checks that whatever comes out actually parses.

## New features

### Mermaid fences survive conversion

`mermaid` is now a recognised language identifier, alongside `dot`, `graphviz`, and `plantuml`. Previously a Mermaid block survived only by accident, via a loose lowercase-word fallback with no test coverage behind it.

- A ` ```mermaid ` block in HTML (`<pre><code class="language-mermaid">`) or in a Markdown file comes out the other side unchanged, fence and language tag intact.
- Works from the library and the CLI, for HTML, URL, and `.md` input.

### Mermaid source recovered from rendered diagrams

GitHub, MkDocs, and Docusaurus run mermaid.js client-side, so the HTML you fetch holds the *rendered* `<svg>`, not the diagram. The source is usually still in the DOM somewhere, and get-md now goes looking for it before Readability and the HTML cleaner can strip it.

- Detects `.mermaid`, `pre.mermaid`, `[data-processed="true"]`, `svg[id^="mermaid-"]`, and `svg.mermaid` containers.
- Takes the first source it can find, in order: a `<script type="text/mermaid">` (inside or sibling); a `data-code`/`data-mermaid`/`data-src`/`data-original`/`data-source` attribute; the container's own text when it is a `<pre>` holding no `<svg>`; a hidden `pre[hidden]`/`<template>`/`textarea[hidden]`; and finally the SVG's `<desc>`, `<title>`, or `aria-label`.
- That last fallback is deliberately strict. mermaid.js writes accessibility strings such as `Created with Mermaid` into those nodes, and emitting one as a diagram would be worse than dropping it — text qualifies only if it is multi-line, contains `;`, or opens with a diagram keyword *and* carries an arrow, a colon, or real length.
- Recovered diagrams are re-emitted as ` ```mermaid ` fences. Where no source is recoverable, behaviour is unchanged: the SVG's text labels fall through as loose text.

### Diagrams in PDFs reconstructed by a vision model (opt-in)

A diagram in a PDF is vector drawing or raster image — there is no text to recover, so this is a vision problem. With `useLLM` and a remote vision-capable model, get-md renders PDF pages to images and asks the model to emit Mermaid inline where the diagram appeared.

- New `src/extractors/pdf-renderer.ts` renders pages to JPEG at 2× scale via `pdfjs-dist` and `@napi-rs/canvas`, both **optional** peer dependencies — install them only if you want this. Standard fonts resolve dynamically from the installed `pdfjs-dist`.
- `RemoteLlmConverter.convert()` accepts images and switches to a vision system prompt that asks for diagram reconstruction; images ride along as multimodal message parts.
- **Remote providers only.** The local ReaderLM-v2 path is text-only, and so is `useLLM` with no `llm` config, since that defaults to local-llama. Neither renders pages nor calls a vision model.
- **Capped at the first 10 pages**, to keep long PDFs from overflowing the model's context. Longer documents log a warning naming the cap; text extraction still covers the whole file.
- Fails soft in both directions: missing render dependencies or a render error warns and continues text-only, and a failed vision request retries the same conversion without images.
- Accuracy varies with the model and the diagram. This is a best-effort assist, not guaranteed fidelity.

### Mermaid validation (opt-in)

`validateMermaid: true` runs every ` ```mermaid ` fence in the finished Markdown through mermaid's own parser and annotates the ones that fail, so a model that emits plausible-but-broken Mermaid does not do so silently.

- Invalid blocks are **kept**, with a GitHub-style `> [!WARNING]` callout inserted above them — you repair the diagram rather than losing it.
- Applies to all Mermaid in the output — preserved, recovered, and model-generated alike — and runs last, after conversion and image localization.
- Available as the `validateMermaid` library option, the `--validate-mermaid` CLI flag, and a `validateMermaid` config-file key, across every conversion path: HTML, URL, Markdown, PDF, DOCX, batch, and sitemap.
- Requires the **optional** `mermaid` peer dependency. Without it, get-md logs a warning and returns the Markdown untouched, so enabling the option can never break a conversion.
- Only non-indented triple-backtick fences are matched; indented fences may pass through unvalidated.

## Bug fixes & hardening

- **Mermaid validation no longer rejects valid diagrams.** `mermaid.parse` sanitizes label text through DOMPurify, which needs a DOM. Under plain Node there wasn't one, so any diagram carrying node labels — `A[Start]`, `B{Choice}`, `-->|yes|`, and every class/state/ER/gantt/mindmap diagram — threw `DOMPurify.addHook is not a function`, and the validator treated any throw as a syntax error. In practice almost every real diagram was annotated as invalid, including correct output from the PDF vision path this option exists to check. Validation now installs a headless DOM before importing mermaid (the point DOMPurify binds to the global scope) and restores the global scope afterwards — including `process`, which constructing a happy-dom `Window` replaces. Only a genuine parse complaint now annotates the document; anything environmental logs one diagnostic and leaves the diagram alone. Two diagram types (`pie`, `gitGraph`) still take that path, failing inside a lazily loaded mermaid parser chunk.
- **`--config <path>` is no longer ignored.** The flag was accepted, and `--show-config` even printed the path, but every conversion still loaded configuration through cwd/home auto-discovery. An explicitly named config file had no effect on output and its validation errors never surfaced, so a typo'd config failed silently. All five conversion paths and `--show-config` now resolve config through one helper that honors the flag.
- **Duplicate validation warnings prevented.** Re-running validation over already-annotated Markdown no longer stacks a second warning onto the same block; the fence-matching regex was also tightened for stability.
- **PDF rendering is loaded dynamically**, so the optional `pdfjs-dist`/`@napi-rs/canvas` dependencies are never touched unless vision reconstruction is actually in play.

## Behaviour changes

- **Code-block language tags now survive Readability extraction.** The Mermaid recovery work sets `keepClasses: true`, so `<pre><code class="language-x">` keeps its class through extraction. Fenced output is now tagged — ` ```python `, ` ```go `, ` ```rust ` — where it previously came out bare. This is a general fix for syntax-highlighted pages, not a Mermaid-only one, and it is the most visible change in this release for anyone converting documentation sites. Two consequences worth knowing: unrecognised class names can surface as tags via the lowercase-word fallback, and because element classes now survive into the cleanup pass, class-based noise rules match more often — a `cookie-notice` block is correctly dropped, but so is genuine prose carrying an `advertisement` or `popup` class.

## Known limitations

- A PDF with no extractable text — a pure scan, or a page that is nothing but a diagram — still returns an empty result before page rendering is attempted, so vision reconstruction never runs on exactly the PDFs that would benefit most. Unchanged from 1.6.0, but worth stating now that the vision path exists.
- `pie` and `gitGraph` diagrams are skipped by the validator rather than checked, for the reason described above.

## Dependencies

- New optional peer dependencies, none of them installed by default: `pdfjs-dist` (^5) and `@napi-rs/canvas` (^0.1) for PDF page rendering, and `mermaid` (^11) for validation. The default install footprint is unchanged.

## Documentation

- New **[Diagrams & Mermaid guide](docs/guides/mermaid.md)** — a support matrix of what is preserved, recovered, reconstructed, and validated per input type; the recovery precedence order; setup and limits for the opt-in PDF path; and a troubleshooting table.
- New runnable **`examples/mermaid-diagrams.ts`**, covering preservation, recovery, and validation entirely offline, with the PDF vision path as a commented snippet.
- Remote LLM guide documents PDF diagram recovery and its dependencies; CLI and configuration references document `--validate-mermaid` and the `validateMermaid` key; README gains a Mermaid section.
- Corrected the README's `validateMermaid` snippet, which passed a bare Markdown string — that is parsed as HTML unless `inputType: "markdown"` is set, so the fence came back escaped.
- Corrected the `validateMermaid` option description: it validates every Mermaid block in the output, not just model-generated ones.

## Tests

634 passing (up from 592 at 1.6.0). New coverage for: Mermaid fence preservation from HTML and Markdown, and the other diagram languages; source recovery across every container shape and source strategy, including the accessibility-text guard; PDF page rendering and the 10-page cap; vision prompting, multimodal message assembly, and text-only fallback; validation across nine diagram shapes that were previously false-positived, plus global-scope and `process` restoration; and the `--validate-mermaid` flag and `--config` resolution end-to-end through the CLI.

If there are any problems, feedback or thoughts please drop an issue or message us through Discord! Thank you for using get-md.

# 1.6.0

get-md is no longer HTML-only. This release adds **PDF, DOCX, and Markdown** ingestion alongside HTML and URLs — pass a file, a `Buffer`, or a URL and get-md routes it to the right extractor automatically — plus a launch-hardening pass over the whole multi-format surface.

## New features

### Multi-format input (PDF, DOCX, Markdown)

`convertToMarkdown` now accepts more than HTML strings and URLs — pass a `Buffer` or `ContentSource` and get-md routes it to the right extractor automatically. The CLI detects the format from the file extension (or, for stdin, the PDF magic bytes).

- **PDF** — pass a PDF `Buffer` (auto-detected via the `%PDF` magic bytes) or point the CLI at a `.pdf` file or URL. Text is reconstructed into real structure: wrapped lines reflow into paragraphs, ALL-CAPS lines become headings, `•`/numbered lines become lists (folding wrapped continuations), and repeated running headers/footers are dropped. Title, author, and creation date are pulled from the PDF info dictionary into the frontmatter. Readability is disabled for PDFs so body text is never dropped, and `-- N of M --` page markers are stripped. Scanned/text-less PDFs return an empty result with a non-zero `inputLength` (a signal OCR is needed). Powered by `pdf-parse`.
- **DOCX** — pass a DOCX `Buffer` (auto-detected via the ZIP/`PK` magic bytes) or point the CLI at a `.docx` file or URL. New exports `convertDocxToMarkdown(buffer, options)` and `convertDocxToHtml(buffer)`. Supports headings, bold/italic/underline/strikethrough, tables, and ordered/unordered lists — list type is resolved from `word/numbering.xml` (not guessed). Decompression is capped at 100 MB and corrupt/encrypted/`document.xml`-less archives raise clear errors. Powered by `node-stream-zip`.
- **Markdown input** — `.md`/`.markdown` files (or `inputType: "markdown"` / a `ContentSource` with `type: "markdown"`) skip HTML parsing and run only the optimization passes: metadata, frontmatter, and structure normalization. Existing frontmatter is preserved (your `title`/`author` are kept; only computed `wordCount`/`readingTime` are appended — no stacked second block), and `--no-links`/`--no-images`/`--no-tables` are honored.
- **CLI** — the tool now advertises all four formats; input type is auto-detected from the extension (or the `%PDF` magic bytes on stdin).

## Bug fixes & hardening

A top-to-bottom review of the new multi-format surface before launch:

- **PDF no longer loses body text** — Readability was running on PDF-derived HTML and could strip content it scored as boilerplate; it's now disabled for PDF input, matching DOCX.
- **PDF page-marker noise removed** — `pdf-parse`'s `-- N of M --` page separators no longer leak into the output.
- **PDF metadata & structure** — title/author/date now flow into the frontmatter, and extracted text is reconstructed into headings/paragraphs/lists instead of one flat blob.
- **DOCX list types are correct** — ordered vs. unordered is resolved from `word/numbering.xml` instead of a `numId`-parity guess that flipped lists at random.
- **DOCX tables** — nested tables no longer corrupt the outer table (direct-children traversal); decompression is bounded and archive errors are clear.
- **DOCX buffers via `convertToMarkdown`** — a DOCX `Buffer` now converts through `convertToMarkdown` (PK-zip detection), matching the PDF buffer path instead of throwing.
- **Markdown input** — feeding a `.md` file that already had frontmatter no longer produces a doubled block or clobbers the real title; `--no-links`/`--no-images`/`--no-tables` are now honored for Markdown input.
- **Build before test** — `scripts/test.sh` and the badges workflow now build first, since the CLI end-to-end tests spawn the compiled `bin/get-md.js` (stale `dist/` would skew results).

## Documentation

- Multi-format documentation across the site: the Conversion API page now covers PDF/DOCX buffers, binary auto-detection, `inputType`, the `convertDocx*` exports, and Markdown input; the CLI reference documents format detection and the DOCX/`.md` input paths; Getting Started and Quick Start show PDF/DOCX/Markdown examples.

## Tests

592 passing (up from 528 at 1.5.0). Adds coverage for: PDF extraction, page-marker stripping, info-dict metadata, and structure reconstruction; DOCX buffer routing, `numbering.xml` list resolution, and corrupt-archive errors; Markdown-input frontmatter preservation and content filtering; and real DOCX/PDF CLI end-to-end.

If there are any problems, feedback or thoughts please drop an issue or message us through Discord! Thank you for using get-md.

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
