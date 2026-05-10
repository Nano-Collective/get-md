// `node-llama-cpp` is declared as an optional peer dependency in package.json
// because it carries hundreds of MB of platform-specific native binaries that
// consumers of the non-LLM APIs (`convertToMarkdown` etc.) don't need. This
// helper centralises the dynamic import so missing-peer failures surface a
// clear, actionable error instead of a generic ERR_MODULE_NOT_FOUND.

let cached: Promise<typeof import("node-llama-cpp")> | null = null;

export function loadNodeLlamaCpp(): Promise<typeof import("node-llama-cpp")> {
  if (!cached) {
    cached = import("node-llama-cpp").catch((err: unknown) => {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      const message = (err as Error | undefined)?.message ?? "";
      if (
        code === "ERR_MODULE_NOT_FOUND" ||
        code === "MODULE_NOT_FOUND" ||
        message.includes("node-llama-cpp")
      ) {
        throw new Error(
          'get-md: LLM-based conversion requires the optional peer dependency "node-llama-cpp". ' +
            "Install it alongside get-md (e.g. `pnpm add node-llama-cpp`) to enable LLMConverter, " +
            "LLMManager, and `getmd --download-model`. The HTML→Markdown path (convertToMarkdown) " +
            "works without it.",
        );
      }
      throw err;
    });
  }
  return cached;
}
