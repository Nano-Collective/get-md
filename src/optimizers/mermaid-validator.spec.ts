import test from "ava";
import { validateMermaid } from "./mermaid-validator.js";

test("validateMermaid: leaves markdown without mermaid intact", async (t) => {
  const markdown = "Hello World\n```javascript\nconsole.log(1);\n```";
  const result = await validateMermaid(markdown);
  t.is(result, markdown);
});

test("validateMermaid: leaves valid mermaid intact", async (t) => {
  const markdown = "Here is a graph:\n\n```mermaid\ngraph TD\n    A-->B;\n```\nEnd of graph.";
  const result = await validateMermaid(markdown);
  t.is(result, markdown);
});

test("validateMermaid: flags invalid mermaid syntax", async (t) => {
  const markdown = "Here is an invalid graph:\n\n```mermaid\ngraph TD\n    A --> \n```\nEnd of graph.";
  const result = await validateMermaid(markdown);
  t.not(result, markdown);
  t.regex(result, /> \[!WARNING\]/);
  t.regex(result, /> Invalid Mermaid syntax:/);
  t.regex(result, /```mermaid\ngraph TD\n    A --> \n```/);
});

test("validateMermaid: processes multiple mermaid blocks correctly", async (t) => {
  const markdown = `
Block 1:
\`\`\`mermaid
graph TD
    A-->B;
\`\`\`

Block 2:
\`\`\`mermaid
invalid code
\`\`\`

Block 3:
\`\`\`mermaid
graph TD
    B-->C;
\`\`\`
  `;
  const result = await validateMermaid(markdown);
  // Valid blocks stay intact
  t.regex(result, /Block 1:\n```mermaid\ngraph TD\n    A-->B;\n```/);
  t.regex(result, /Block 3:\n```mermaid\ngraph TD\n    B-->C;\n```/);
  // Invalid block is flagged
  t.regex(result, /Block 2:\n\n> \[!WARNING\]/);
});
