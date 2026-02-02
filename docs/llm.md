# LLM-Powered Conversion

For higher quality markdown output, get-md supports optional AI-powered conversion using a local LLM model. This uses [ReaderLM-v2](https://huggingface.co/jinaai/ReaderLM-v2), a model specifically trained for HTML-to-Markdown conversion.

## When to Use LLM vs Turndown

| Use Case | Recommended Method |
|----------|-------------------|
| High-quality single conversions | LLM (better structure) |
| Complex documentation sites | LLM (semantic understanding) |
| Batch processing (1000+ pages) | Turndown (speed) |
| CI/CD pipelines | Turndown (fast, deterministic) |
| Real-time conversion | Turndown (sub-second) |

## Quick Start

```typescript
import { convertToMarkdown, checkLLMModel, downloadLLMModel } from '@nanocollective/get-md';

// 1. Check if model is available
const status = await checkLLMModel();

if (!status.available) {
  // 2. Download model (one-time, ~986MB)
  await downloadLLMModel({
    onProgress: (downloaded, total, percentage) => {
      console.log(`Downloading: ${percentage.toFixed(1)}%`);
    }
  });
}

// 3. Convert with LLM
const result = await convertToMarkdown('https://example.com', {
  useLLM: true,
  onLLMEvent: (event) => {
    if (event.type === 'conversion-complete') {
      console.log(`Done in ${event.duration}ms`);
    }
  }
});
```

## LLM Options

```typescript
{
  useLLM?: boolean;              // Use LLM for conversion (default: false)
  llmModelPath?: string;         // Custom model path (optional)
  llmTemperature?: number;       // Generation temperature (default: 0.1)
  llmMaxTokens?: number;         // Max tokens (default: 512000)
  llmFallback?: boolean;         // Fallback to Turndown on error (default: true)

  // Event callbacks
  onLLMEvent?: (event: LLMEvent) => void;
  onDownloadProgress?: (downloaded, total, percentage) => void;
  onModelStatus?: (status) => void;
  onConversionProgress?: (progress) => void;
}
```

## Model Management

### Check Model Status

```typescript
import { checkLLMModel } from '@nanocollective/get-md';

const status = await checkLLMModel();
console.log(status.available);      // true/false
console.log(status.sizeFormatted);  // "986MB"
```

### Download Model

```typescript
import { downloadLLMModel } from '@nanocollective/get-md';

await downloadLLMModel({
  onProgress: (downloaded, total, percentage) => {
    console.log(`Downloading: ${percentage.toFixed(1)}%`);
  }
});
```

### Get Model Information

```typescript
import { getLLMModelInfo } from '@nanocollective/get-md';

const info = getLLMModelInfo();
console.log(info.defaultPath);      // ~/.get-md/models/ReaderLM-v2-Q4_K_M.gguf
console.log(info.recommendedModel); // "ReaderLM-v2-Q4_K_M"
```

### Remove Model

```typescript
import { removeLLMModel } from '@nanocollective/get-md';

await removeLLMModel();
```

## CLI Usage

```bash
# Check model status
getmd --model-info

# Download model (one-time)
getmd --download-model

# Convert with LLM
getmd https://example.com --use-llm

# Compare Turndown vs LLM
getmd https://example.com --compare -o comparison.md

# Show default model path
getmd --model-path

# Remove model
getmd --remove-model
```

## Configuration File

You can set default options in a config file. Create `.getmdrc` or `get-md.config.json` in your project or home directory:

```json
{
  "useLLM": true,
  "llmTemperature": 0.1,
  "llmFallback": true,
  "extractContent": true,
  "includeMeta": true
}
```

CLI flags override config file settings. Use `getmd --show-config` to see current configuration.

## System Requirements

- **Disk Space**: ~1GB for the model file
- **RAM**: 2-4GB during inference (8GB+ system recommended)
- **Speed**: 5-10 seconds per typical webpage (vs <100ms for Turndown)
