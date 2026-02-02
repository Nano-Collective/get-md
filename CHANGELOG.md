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
