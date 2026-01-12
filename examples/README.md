# Examples

This directory contains example scripts demonstrating get-md features.

## Prerequisites

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build
```

## Running Examples

All examples can be run with `tsx` (TypeScript executor):

```bash
# Run from project root
npx tsx examples/<example-name>.ts
```

## Available Examples

### 1. Basic Usage (`basic-usage.ts`)

Demonstrates basic HTML to Markdown conversion with Turndown.

```bash
npx tsx examples/basic-usage.ts
```

**Features shown:**
- Simple HTML string conversion
- Accessing markdown output
- Viewing metadata and stats

---

### 2. LLM Model Management (`llm-model-management.ts`)

Demonstrates how to manage the LLM model (check, download, remove).

```bash
npx tsx examples/llm-model-management.ts
```

**Features shown:**
- `getLLMModelInfo()` - Get model information
- `checkLLMModel()` - Check if model is downloaded
- `downloadLLMModel()` - Download with progress tracking
- `removeLLMModel()` - Remove the model

**Note:** First run will download ~986MB model file.

---

### 3. LLM Conversion (`llm-conversion.ts`)

Demonstrates LLM-powered conversion and compares it with Turndown.

```bash
npx tsx examples/llm-conversion.ts
```

**Features shown:**
- Converting with `useLLM: true`
- Event callbacks for progress tracking
- Comparing Turndown vs LLM output
- Side-by-side quality comparison

**Note:** Requires the LLM model to be downloaded first.

---

### 4. Configuration Usage (`config-usage.ts`)

Demonstrates configuration file loading and option merging.

```bash
npx tsx examples/config-usage.ts
```

**Features shown:**
- `findConfigPath()` - Find config files
- `loadConfig()` - Load configuration
- `mergeConfigWithOptions()` - Merge file config with CLI options

---

## CLI Testing

You can also test features via the CLI:

### Model Management

```bash
# Show model information
./bin/get-md.js --model-info

# Download model
./bin/get-md.js --download-model

# Show default model path
./bin/get-md.js --model-path

# Remove model
./bin/get-md.js --remove-model
```

### Conversion

```bash
# Basic conversion
echo '<h1>Hello</h1><p>World</p>' | ./bin/get-md.js

# Convert URL
./bin/get-md.js https://example.com

# Convert with LLM
./bin/get-md.js https://example.com --use-llm

# Compare Turndown vs LLM
./bin/get-md.js https://example.com --compare

# Save output
./bin/get-md.js https://example.com --use-llm -o output.md
```

### Configuration

```bash
# Show current configuration
./bin/get-md.js --show-config

# Use custom config file
./bin/get-md.js --config ./my-config.json https://example.com
```

---

## Sample Configuration File

Copy `.getmdrc.example` to `.getmdrc` in your project root or home directory:

```bash
cp examples/.getmdrc.example ~/.getmdrc
```

Then all conversions will use those settings by default. CLI flags override config file settings.

---

## Testing Checklist

Use this checklist to verify all features work:

### Core Conversion
- [ ] `npx tsx examples/basic-usage.ts` - Shows markdown output
- [ ] `echo '<h1>Test</h1>' | ./bin/get-md.js` - CLI stdin works
- [ ] `./bin/get-md.js https://example.com` - URL fetching works

### LLM Features
- [ ] `./bin/get-md.js --model-info` - Shows model information
- [ ] `./bin/get-md.js --model-path` - Shows default path
- [ ] `./bin/get-md.js --download-model` - Downloads model (first time)
- [ ] `npx tsx examples/llm-model-management.ts` - Model management works
- [ ] `npx tsx examples/llm-conversion.ts` - LLM conversion works
- [ ] `./bin/get-md.js https://example.com --use-llm` - CLI LLM works
- [ ] `./bin/get-md.js https://example.com --compare` - Comparison works

### Configuration
- [ ] `./bin/get-md.js --show-config` - Shows config (or "none found")
- [ ] `npx tsx examples/config-usage.ts` - Config loading works
- [ ] Create `.getmdrc` and verify `--show-config` finds it

### Verbose/Debug
- [ ] `./bin/get-md.js https://example.com --use-llm -v` - Shows detailed progress
