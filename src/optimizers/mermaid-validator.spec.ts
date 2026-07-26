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

test("validateMermaid: is idempotent (prevents duplicate warnings)", async (t) => {
  const markdown = "Here is an invalid graph:\n\n```mermaid\ngraph TD\n    A --> \n```\nEnd of graph.";
  const firstPass = await validateMermaid(markdown);
  t.not(firstPass, markdown);
  t.regex(firstPass, /> \[!WARNING\]/);
  
  // Run it again on the already-flagged output
  const secondPass = await validateMermaid(firstPass);
  t.is(secondPass, firstPass, "Second pass should not mutate the string further");
  
  // Ensure we didn't add a second warning
  const warningCount = (secondPass.match(/> \[!WARNING\]/g) || []).length;
  t.is(warningCount, 1, "There should be exactly one warning block");
});

// ============================================================================
// Regression: diagrams carrying node labels
//
// mermaid sanitizes label text through DOMPurify, which needs a DOM. Without
// one, `mermaid.parse` throws on any diagram using `A[Start]`, `B{Choice}` or
// `-->|edge|` — i.e. most real diagrams — and every one of them was being
// annotated as a syntax error.
// ============================================================================

const LABELLED_DIAGRAMS: [string, string][] = [
  ["square node labels", "graph TD\n  A[Start] --> B[End]"],
  ["decision node", "graph TD\n  A --> B{Choice}"],
  ["labelled edge", "graph TD\n  A -->|yes| B"],
  [
    "flowchart with all three",
    "flowchart TD\n  A[Apply] --> B{Screen}\n  B -->|pass| C[Offer]",
  ],
  ["sequenceDiagram", "sequenceDiagram\n  Alice->>Bob: Hi"],
  ["classDiagram", "classDiagram\n  Animal <|-- Duck"],
  ["stateDiagram", "stateDiagram-v2\n  [*] --> Still"],
  ["erDiagram", "erDiagram\n  CUSTOMER ||--o{ ORDER : places"],
  ["mindmap", "mindmap\n  root((x))"],
];

for (const [name, diagram] of LABELLED_DIAGRAMS) {
  test(`validateMermaid: does not flag a valid diagram — ${name}`, async (t) => {
    const markdown = `Intro\n\n\`\`\`mermaid\n${diagram}\n\`\`\`\n`;
    const result = await validateMermaid(markdown);
    t.is(result, markdown);
    t.notRegex(result, /Invalid Mermaid syntax/);
  });
}

test("validateMermaid: restores the global scope it borrowed", async (t) => {
  const scope = globalThis as unknown as Record<string, unknown>;
  const hadWindow = "window" in scope;
  const hadDocument = "document" in scope;

  await validateMermaid("```mermaid\ngraph TD\n  A[Start] --> B{Go}\n```\n");

  t.is("window" in scope, hadWindow, "window global leaked");
  t.is("document" in scope, hadDocument, "document global leaked");
});

test("validateMermaid: leaves process intact (happy-dom replaces it)", async (t) => {
  const before = process;
  await validateMermaid("```mermaid\ngraph TD\n  A[Start] --> B{Go}\n```\n");
  t.is(globalThis.process, before);
  t.is(typeof globalThis.process.exit, "function");
});

test("validateMermaid: still flags a genuinely broken labelled diagram", async (t) => {
  const markdown = "```mermaid\ngraph TD\n  A[Start] -->\n```\n";
  const result = await validateMermaid(markdown);
  t.regex(result, /> Invalid Mermaid syntax: Parse error/);
});
