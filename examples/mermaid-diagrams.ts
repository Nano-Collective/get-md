// examples/mermaid-diagrams.ts
//
// Demonstrates how get-md handles Mermaid diagrams:
//   1. Preserving a ```mermaid fence that is already in the HTML
//   2. Preserving a ```mermaid fence in Markdown input
//   3. Recovering the source from a diagram a browser already rendered to <svg>
//   4. Flagging Mermaid that does not parse (needs the optional `mermaid` package)
//
// Everything here runs offline. PDF diagram reconstruction needs a remote
// vision model and is shown at the bottom as a commented-out snippet.
//
// See docs/guides/mermaid.md for the full picture.

import { convertToMarkdown } from "@nanocollective/get-md";

function section(title: string, markdown: string) {
  console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
  console.log(markdown.trim());
}

async function main() {
  // ---------------------------------------------------------------------
  // 1. A tagged code block in HTML survives conversion untouched.
  //    `mermaid` is a recognised language tag, so no options are needed.
  // ---------------------------------------------------------------------
  const htmlWithFence = `
    <article>
      <h1>Deploy pipeline</h1>
      <p>Every commit walks through the release flow shown below before it reaches production.</p>
      <pre><code class="language-mermaid">graph TD
  A[Commit] --&gt; B{CI passes?}
  B --&gt;|yes| C[Deploy]
  B --&gt;|no| D[Notify]</code></pre>
    </article>
  `;

  const fromHtml = await convertToMarkdown(htmlWithFence, {
    includeMeta: false,
  });
  section("1. HTML fence preserved", fromHtml.markdown);

  // ---------------------------------------------------------------------
  // 2. Markdown input. A *string* is treated as HTML unless you say
  //    otherwise — without `inputType: "markdown"` the fence gets escaped.
  //    (The CLI detects .md files by extension, so `getmd notes.md` is enough.)
  // ---------------------------------------------------------------------
  const markdownSource = [
    "# Release notes",
    "",
    "The rollout order is fixed:",
    "",
    "```mermaid",
    "graph LR",
    "  api --> workers",
    "  workers --> web",
    "```",
    "",
  ].join("\n");

  const fromMarkdown = await convertToMarkdown(markdownSource, {
    inputType: "markdown",
    includeMeta: false,
  });
  section("2. Markdown fence preserved", fromMarkdown.markdown);

  // ---------------------------------------------------------------------
  // 3. Docs sites (GitHub, MkDocs, Docusaurus) run mermaid.js in the
  //    browser, so the served HTML holds the rendered <svg> rather than the
  //    source. get-md finds the source elsewhere in the DOM and rebuilds the
  //    fence — here from a sibling <script type="text/mermaid">.
  // ---------------------------------------------------------------------
  const htmlWithRenderedSvg = `
    <article>
      <h1>Request lifecycle</h1>
      <p>The diagram below was rendered client-side, so the served HTML contains an SVG element.</p>
      <div class="mermaid" data-processed="true">
        <svg id="mermaid-1" aria-label="Created with Mermaid"><g></g></svg>
      </div>
      <script type="text/mermaid">sequenceDiagram
  Alice->>Bob: Deploy request
  Bob-->>Alice: Ack</script>
    </article>
  `;

  const recovered = await convertToMarkdown(htmlWithRenderedSvg, {
    includeMeta: false,
  });
  section("3. Source recovered from rendered SVG", recovered.markdown);

  // ---------------------------------------------------------------------
  // 4. Validation. Invalid diagrams are kept and annotated with a warning
  //    callout rather than dropped. Requires `npm install mermaid` — without
  //    it, get-md warns once and returns the Markdown unchanged.
  // ---------------------------------------------------------------------
  const markdownWithBrokenDiagram = [
    "# Mixed bag",
    "",
    "This one parses:",
    "",
    "```mermaid",
    "graph TD",
    "  A --> B",
    "```",
    "",
    "This one does not:",
    "",
    "```mermaid",
    "graph TD",
    "  A -->",
    "```",
    "",
  ].join("\n");

  const validated = await convertToMarkdown(markdownWithBrokenDiagram, {
    inputType: "markdown",
    includeMeta: false,
    validateMermaid: true,
  });
  section("4. Invalid Mermaid flagged", validated.markdown);

  // ---------------------------------------------------------------------
  // 5. PDF diagram reconstruction (not run here — needs network + API key).
  //
  //    Install the optional renderer dependencies first:
  //      npm install pdfjs-dist @napi-rs/canvas
  //
  //    import { readFileSync } from "node:fs";
  //
  //    const fromPdf = await convertToMarkdown(readFileSync("handbook.pdf"), {
  //      useLLM: true,
  //      llm: {
  //        sdkProvider: "google",
  //        model: "gemini-2.5-flash",
  //        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  //      },
  //      validateMermaid: true,
  //    });
  //
  //    Vision reconstruction is remote-only, capped at the first 10 pages,
  //    and falls back to text-only conversion if rendering or the request
  //    fails. See docs/guides/mermaid.md for the caveats.
  // ---------------------------------------------------------------------
  console.log(
    "\n(5. PDF diagram reconstruction needs a remote vision model — see the commented snippet above.)",
  );
}

main().catch(console.error);
