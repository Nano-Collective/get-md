# CLI Usage

get-md includes a command-line interface for quick conversions from your terminal.

## Basic Syntax

```bash
getmd [input] [options]
```

## Input Sources

The CLI accepts input from multiple sources:

```bash
# From stdin
echo '<h1>Hello</h1>' | getmd

# From file
getmd input.html

# From URL
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
| `-v, --verbose` | Verbose output |
| `-h, --help` | Display help |

### LLM Options

| Option | Description |
|--------|-------------|
| `--use-llm` | Use LLM for conversion |
| `--model-info` | Check model status |
| `--download-model` | Download the LLM model |
| `--remove-model` | Remove the LLM model |
| `--model-path` | Show default model path |
| `--compare` | Compare Turndown vs LLM output |
| `--show-config` | Show current configuration |

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
