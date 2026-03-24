---
title: "Installation"
description: "System requirements and installation methods for get-md"
sidebar_order: 1
---

# Installation

## Requirements

- Node.js 18+

> **Note:** The optional LLM-powered conversion requires ~1GB disk space for the model and 2-4GB RAM during inference. A system with 8GB+ RAM is recommended for LLM usage.

## Install as a Dependency

Add get-md to your project:

```bash
npm install @nanocollective/get-md
```

Then import and use:

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";
```

## Install Globally (CLI)

Install globally for command-line access:

```bash
npm install -g @nanocollective/get-md
```

Then run conversions directly:

```bash
getmd https://example.com
```

## Run with npx

If you prefer not to install globally, use npx to run the CLI directly:

```bash
npx @nanocollective/get-md https://example.com
```

This downloads and runs the latest version each time.

## Verify Installation

Check that get-md is installed and working:

```bash
getmd --help
```

## Next Steps

Once installed, follow the [Quick Start](quick-start.md) guide to convert your first page.
