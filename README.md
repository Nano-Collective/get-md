# get-md

A fast, lightweight HTML to Markdown converter optimized for LLM consumption.

## Features

- **Lightning-fast** (<100ms) with optional AI-powered conversion
- **Intelligent extraction** using Mozilla Readability
- **CLI included** for command-line usage
- **TypeScript** with full type definitions
- **React Native compatible**

## Installation

```bash
npm install @nanocollective/get-md
```

## Quick Start

### Library

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

const result = await convertToMarkdown("https://example.com");
console.log(result.markdown);
```

### CLI

```bash
getmd https://example.com -o output.md
```

## Documentation

For full documentation, see [docs/index.md](docs/index.md):

- [API Reference](docs/api.md)
- [CLI Usage](docs/cli.md)
- [LLM-Powered Conversion](docs/llm.md)
- [React Native Support](docs/react-native.md)

## Community

We're a small community-led team building local and privacy-first AI solutions under the [Nano Collective](https://nanocollective.org).

- [Contributing Guide](CONTRIBUTING.md)
- [Discord Server](https://discord.gg/ktPDV6rekE)
- [GitHub Issues](https://github.com/nanocollective/get-md/issues)
