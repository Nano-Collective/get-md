// examples/llm-conversion.ts
// Demonstrates LLM-powered HTML to Markdown conversion

import {
  checkLLMModel,
  convertToMarkdown,
  downloadLLMModel,
} from "@nanocollective/get-md";

const sampleHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Understanding Neural Networks</title>
    <meta name="author" content="AI Research Team">
  </head>
  <body>
    <article>
      <h1>Understanding Neural Networks</h1>
      <p class="intro">Neural networks are computing systems inspired by biological neural networks in animal brains.</p>

      <h2>Key Components</h2>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Description</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Input Layer</td>
            <td>Receives raw data</td>
            <td>Data entry point</td>
          </tr>
          <tr>
            <td>Hidden Layers</td>
            <td>Process information</td>
            <td>Feature extraction</td>
          </tr>
          <tr>
            <td>Output Layer</td>
            <td>Produces results</td>
            <td>Final prediction</td>
          </tr>
        </tbody>
      </table>

      <h2>Code Example</h2>
      <pre><code class="language-python">
import torch.nn as nn

class SimpleNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(784, 128),
            nn.ReLU(),
            nn.Linear(128, 10)
        )

    def forward(self, x):
        return self.layers(x)
      </code></pre>

      <h2>Benefits</h2>
      <ul>
        <li><strong>Pattern Recognition</strong>: Excellent at finding patterns in data</li>
        <li><strong>Adaptability</strong>: Can learn from new data</li>
        <li><strong>Scalability</strong>: Works with large datasets</li>
      </ul>

      <blockquote>
        "Neural networks are the foundation of modern AI systems."
        - Deep Learning Textbook
      </blockquote>
    </article>
  </body>
</html>
`;

async function main() {
  console.log("=== LLM Conversion Example ===\n");

  // 1. Check if model is available
  const status = await checkLLMModel();
  if (!status.available) {
    console.log("Model not found. Downloading...\n");
    await downloadLLMModel({
      onProgress: (_, __, percentage) => {
        process.stdout.write(`\rDownloading: ${percentage.toFixed(1)}%`);
      },
    });
    console.log("\n");
  }

  // 2. Convert with Turndown (default)
  console.log("1. Converting with Turndown (fast)...");
  const turndownStart = Date.now();
  const turndownResult = await convertToMarkdown(sampleHtml, {
    useLLM: false,
  });
  const turndownTime = Date.now() - turndownStart;
  console.log(`   Done in ${turndownTime}ms`);
  console.log(`   Output size: ${turndownResult.stats.outputLength} chars\n`);

  // 3. Convert with LLM
  console.log("2. Converting with LLM (higher quality)...");
  const llmStart = Date.now();
  const llmResult = await convertToMarkdown(sampleHtml, {
    useLLM: true,
    onLLMEvent: (event) => {
      switch (event.type) {
        case "model-loading":
          console.log(`   Loading model...`);
          break;
        case "model-loaded":
          console.log(`   Model loaded in ${event.loadTime}ms`);
          break;
        case "conversion-start":
          console.log(`   Converting ${event.inputSize} chars of HTML...`);
          break;
        case "conversion-complete":
          console.log(`   Conversion done in ${event.duration}ms`);
          break;
      }
    },
  });
  const llmTime = Date.now() - llmStart;
  console.log(`   Total time: ${llmTime}ms`);
  console.log(`   Output size: ${llmResult.stats.outputLength} chars\n`);

  // 4. Compare outputs
  console.log("=== Comparison ===");
  console.log(`Method     | Time      | Output Size`);
  console.log(`-----------|-----------|------------`);
  console.log(
    `Turndown   | ${String(turndownTime).padStart(7)}ms | ${turndownResult.stats.outputLength} chars`,
  );
  console.log(
    `LLM        | ${String(llmTime).padStart(7)}ms | ${llmResult.stats.outputLength} chars`,
  );

  // 5. Show Turndown output
  console.log("\n=== Turndown Output ===");
  console.log(turndownResult.markdown);

  // 6. Show LLM output
  console.log("\n=== LLM Output ===");
  console.log(llmResult.markdown);
}

main().catch(console.error);
