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
