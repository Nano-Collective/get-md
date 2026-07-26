# get-md

A fast, lightweight HTML, PDF, DOCX, and Markdown to Markdown converter optimized for LLM consumption — built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community. Everything we build is open, transparent, and driven by the people who use it.

Lightning-fast (<100ms) with optional AI-powered conversion using a local LLM model. Pass in HTML, PDF, DOCX, Markdown files, or a URL and get clean, structured Markdown back — as a library or from the command line.

---
![Build Status](https://github.com/Nano-Collective/get-md/raw/main/badges/build.svg)
![Coverage](https://github.com/Nano-Collective/get-md/raw/main/badges/coverage.svg)
![Version](https://github.com/Nano-Collective/get-md/raw/main/badges/npm-version.svg)
![NPM Downloads](https://github.com/Nano-Collective/get-md/raw/main/badges/npm-downloads-monthly.svg)
![NPM License](https://github.com/Nano-Collective/get-md/raw/main/badges/npm-license.svg)
![Repo Size](https://github.com/Nano-Collective/get-md/raw/main/badges/repo-size.svg)
![Stars](https://github.com/Nano-Collective/get-md/raw/main/badges/stars.svg)
![Forks](https://github.com/Nano-Collective/get-md/raw/main/badges/forks.svg)

## Quick Start

```bash
npm install @nanocollective/get-md
```

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

const result = await convertToMarkdown("https://example.com");
console.log(result.markdown);
```

Or use the CLI:

```bash
npx @nanocollective/get-md https://example.com -o output.md
npx @nanocollective/get-md handbook.pdf -o output.md
npx @nanocollective/get-md document.docx -o output.md
```

## Mermaid Diagrams

Diagrams are usually the first casualty of an HTML-to-Markdown conversion. get-md handles them four ways — the [Diagrams & Mermaid guide](docs/guides/mermaid.md) covers each in full:

- **Preserved** — a ```` ```mermaid ```` fence already in your HTML or Markdown comes out unchanged. On by default, no extra dependencies.
- **Recovered** — when a docs site has already rendered a diagram to `<svg>`, get-md pulls the original source back out of the DOM. On by default.
- **Reconstructed** — diagrams drawn into a PDF can be rebuilt by a remote vision model. Opt-in, best-effort; needs `pdfjs-dist` and `@napi-rs/canvas`.
- **Validated** — `validateMermaid: true` parses every Mermaid block and annotates the ones that fail, keeping the original so you can repair it. Opt-in; needs `mermaid`.

```bash
npm install mermaid
```

```typescript
const result = await convertToMarkdown(source, {
  inputType: "markdown",
  validateMermaid: true,
});
```

Run [`examples/mermaid-diagrams.ts`](examples/mermaid-diagrams.ts) to see all of it working offline.

## Documentation

Full documentation is available online at **[docs.nanocollective.org](https://docs.nanocollective.org/get-md/docs)** or in the [docs/](docs/) folder:

- **[Getting Started](docs/getting-started/index.md)** — Installation, requirements, and your first conversion
- **[API Reference](docs/api/index.md)** — Full reference for the library API
- **[CLI](docs/cli/index.md)** — Command-line interface usage and options
- **[Guides](docs/guides/index.md)** — LLM-powered conversion, Mermaid diagrams, React Native, and configuration tips
- **[Configuration](docs/configuration/index.md)** — Config files and options reference
- **[Community](docs/community.md)** — Contributing, Discord, and how to help

## Community

The Nano Collective is a community collective building AI tooling for the community, not for profit. We'd love your help.

- **Contribute**: See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.
- **The collective**: [nanocollective.org](https://nanocollective.org) · [docs](https://docs.nanocollective.org) · [GitHub](https://github.com/Nano-Collective) · [Discord](https://discord.gg/ktPDV6rekE)
- **Support the work**: The [Support page](https://docs.nanocollective.org/collective/organisation/support) covers donations and sponsorship.
- **Paid contribution**: The [Economics Charter](https://docs.nanocollective.org/collective/organisation/economics-charter) sets out how scoped paid bounties work.
