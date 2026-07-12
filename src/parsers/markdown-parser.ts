// src/parsers/markdown-parser.ts

import * as cheerio from "cheerio/slim";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { LLMConverter } from "../converters/llm-converter.js";
import { checkLLMModel } from "../converters/llm-manager.js";
import { RemoteLlmConverter } from "../converters/remote-llm-converter.js";
import { extractMetadata } from "../extractors/metadata-extractor.js";
import { cleanHTML } from "../optimizers/html-cleaner.js";
import { formatForLLM } from "../optimizers/llm-formatter.js";
import { enhanceStructure } from "../optimizers/structure-enhancer.js";
import type {
  ContentMetadata,
  ContentSource,
  LLMEventCallback,
  LlmConfig,
  LocalLlamaConfig,
  MarkdownOptions,
  MarkdownResult,
  TurndownNode,
  TurndownRule,
} from "../types.js";
import { estimateTokens } from "../utils/tokens.js";

// Known language identifiers for code block detection validation.
// This set covers common languages that appear in highlight.js / Prism /
// GitHub Linguist class names. It is intentionally conservative — when in
// doubt we omit the language tag rather than guess wrong.
const KNOWN_LANGUAGES = new Set([
  // Web
  "javascript",
  "js",
  "jsx",
  "typescript",
  "ts",
  "tsx",
  "html",
  "htm",
  "xhtml",
  "css",
  "scss",
  "sass",
  "less",
  "json",
  "json5",
  "jsonld",
  "xml",
  "svg",
  "yaml",
  "yml",
  "wasm",
  "webassembly",
  // Systems
  "c",
  "cpp",
  "c++",
  "cc",
  "cxx",
  "h",
  "hpp",
  "rust",
  "rs",
  "go",
  "golang",
  "swift",
  "kotlin",
  "kt",
  "scala",
  "java",
  "groovy",
  "clojure",
  "clj",
  "python",
  "py",
  "python3",
  "rb",
  "ruby",
  "php",
  "perl",
  "pl",
  "lua",
  "r",
  "matlab",
  "zig",
  "nim",
  "crystal",
  "dart",
  "elixir",
  "ex",
  "erlang",
  "erl",
  "haskell",
  "hs",
  "ocaml",
  "ml",
  "fsharp",
  "fs",
  "fortran",
  "f90",
  // Shell / ops
  "bash",
  "sh",
  "shell",
  "zsh",
  "fish",
  "powershell",
  "ps",
  "ps1",
  "batch",
  "cmd",
  "dockerfile",
  "docker",
  "makefile",
  "make",
  "nginx",
  "apache",
  "toml",
  "ini",
  "cfg",
  "vim",
  "viml",
  "emacs",
  "elisp",
  // Data / query
  "sql",
  "mysql",
  "postgresql",
  "postgres",
  "sqlite",
  "graphql",
  "gql",
  "regex",
  "csv",
  "tsv",
  "markdown",
  "md",
  // Diagramming / documentation-as-code
  "mermaid",
  "dot",
  "graphviz",
  "plantuml",
  // Other
  "diff",
  "patch",
  "http",
  "wasm",
  "assembly",
  "asm",
  "llvm",
  "solidity",
  "vyper",
  "julia",
  "jl",
  "octave",
  "lisp",
  "scheme",
  "racket",
  "prolog",
  "ada",
  "cobol",
  "pascal",
  "delphi",
  "d",
  "objc",
  "objective-c",
  "v",
  "verilog",
  "vhdl",
  "glsl",
  "hlsl",
  "wgsl",
  "cmake",
  "bazel",
  "ninja",
  "terraform",
  "hcl",
  "puppet",
  "ansible",
  "proto",
  "protobuf",
  "thrift",
  // Plain text fallbacks
  "text",
  "txt",
  "plain",
  "none",
  "no-highlight",
]);

// Generic CSS class names that are NOT language identifiers.
// These commonly appear on <code> elements for styling purposes.
const GENERIC_CLASSES = new Set([
  "active",
  "highlight",
  "selected",
  "current",
  "focus",
  "disabled",
  "enabled",
  "visible",
  "hidden",
  "collapsed",
  "expanded",
  "open",
  "closed",
  "first",
  "last",
  "odd",
  "even",
  "primary",
  "secondary",
  "tertiary",
  "default",
  "success",
  "error",
  "warning",
  "info",
  "small",
  "medium",
  "large",
  "xlarge",
  "tiny",
  "left",
  "right",
  "center",
  "top",
  "bottom",
  "inline",
  "block",
  "flex",
  "grid",
  "light",
  "dark",
  "auto",
  "true",
  "false",
  "null",
  "undefined",
  "top-level",
  "nested",
  "leaf",
  "root",
]);

// Keys that `normalizeOptions` always populates with a concrete default.
// Everything else stays optional — see NormalizedMarkdownOptions below.
type DefaultedOptionKeys =
  | "extractContent"
  | "includeMeta"
  | "customRules"
  | "preserveElements"
  | "maxLength"
  | "includeImages"
  | "includeLinks"
  | "includeTables"
  | "aggressiveCleanup"
  | "timeout"
  | "followRedirects"
  | "maxRedirects"
  | "useLLM"
  | "llmTemperature"
  | "llmMaxTokens"
  | "llmFallback";

type NormalizedMarkdownOptions = Required<
  Pick<MarkdownOptions, DefaultedOptionKeys>
> &
  Omit<MarkdownOptions, DefaultedOptionKeys>;

/**
 * Pick the LLM backend to use for this conversion. Precedence:
 *
 * 1. `opts.llm` (the new pluggable config block) — used as-is.
 * 2. Legacy `llmModelPath` / `llmTemperature` / `llmMaxTokens` shorthand —
 *    folded into a `local-llama` config so the zero-API-key ReaderLM path
 *    keeps working unchanged for existing users.
 */
function resolveLlmConfig(opts: NormalizedMarkdownOptions): LlmConfig {
  if (opts.llm) return opts.llm;
  const fallback: LocalLlamaConfig = { sdkProvider: "local-llama" };
  if (opts.llmModelPath) fallback.modelPath = opts.llmModelPath;
  if (opts.llmTemperature !== undefined) {
    fallback.temperature = opts.llmTemperature;
  }
  if (opts.llmMaxTokens !== undefined) fallback.maxTokens = opts.llmMaxTokens;
  return fallback;
}

export class MarkdownParser {
  // Build a fresh Turndown instance per conversion. Turndown holds rule state
  // on the instance, so reusing a single instance across calls causes
  // user-supplied `customRules` to accumulate and leak between conversions.
  private createTurndown(): TurndownService {
    const turndown = new TurndownService({
      headingStyle: "atx", // Use # style headings
      hr: "---", // Horizontal rule style
      bulletListMarker: "-", // Use - for lists
      codeBlockStyle: "fenced", // Use  for code blocks
      fence: "", // Fence marker
      emDelimiter: "*", // Emphasis delimiter
      strongDelimiter: "**", // Strong delimiter
      linkStyle: "inlined", // Inline links
      linkReferenceStyle: "full", // Full reference links
    });

    // Add GitHub Flavored Markdown support (tables, strikethrough, etc.)
    turndown.use(gfm);

    // Set up custom rules optimized for LLMs
    this.setupLLMRules(turndown);

    return turndown;
  }

  /**
   * Convert HTM