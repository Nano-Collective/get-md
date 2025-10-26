// examples/basic-usage.ts

import { convertToMarkdown } from "@nanocollective/get-md";

async function main() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sample Article</title>
      </head>
      <body>
        <article>
          <h1>Getting Started with get-md</h1>
          <p>This is a <strong>simple example</strong> of converting HTML to Markdown.</p>

          <h2>Features</h2>
          <ul>
            <li>Fast conversion</li>
            <li>Clean output</li>
            <li>LLM-optimized</li>
          </ul>

          <h2>Code Example</h2>
          <pre><code class="language-typescript">
const result = await convertToMarkdown(html);
console.log(result.markdown);
          </code></pre>
        </article>
      </body>
    </html>
  `;

  const result = await convertToMarkdown(html);

  console.log("=== Markdown Output ===");
  console.log(result.markdown);
  console.log("\n=== Metadata ===");
  console.log(JSON.stringify(result.metadata, null, 2));
  console.log("\n=== Stats ===");
  console.log(JSON.stringify(result.stats, null, 2));
}

main().catch(console.error);
