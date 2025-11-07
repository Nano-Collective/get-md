// src/optimizers/llm-formatter.spec.ts

import test from "ava";
import { formatForLLM } from "./llm-formatter.js";

test("normalizes heading levels - prevents skipping levels", (t) => {
  const markdown = `
# Level 1
##### Level 5 (should become Level 2)
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("# Level 1"));
  t.true(result.includes("## Level 5"));
  t.false(result.includes("#####"));
});

test("normalizes heading levels - respects proper hierarchy", (t) => {
  const markdown = `
# Level 1
## Level 2
### Level 3
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("# Level 1"));
  t.true(result.includes("## Level 2"));
  t.true(result.includes("### Level 3"));
});

test("normalizes heading levels - resets on blank sections", (t) => {
  const markdown = `
# First Section
## Subsection

# New Section
##### Should become Level 2
  `.trim();

  const result = formatForLLM(markdown);
  const lines = result.split("\n");
  const newSectionIndex = lines.findIndex((l) => l.includes("New Section"));
  const nextHeadingIndex = lines.findIndex(
    (l, i) => i > newSectionIndex && l.includes("Should become"),
  );

  t.true(lines[nextHeadingIndex].startsWith("##"));
});

test("normalizes list markers - converts * to -", (t) => {
  const markdown = `
* Item 1
* Item 2
+ Item 3
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("- Item 1"));
  t.true(result.includes("- Item 2"));
  t.true(result.includes("- Item 3"));
  t.false(result.includes("* Item"));
  t.false(result.includes("+ Item"));
});

test("normalizes list indentation - uses 2 spaces", (t) => {
  const markdown = `
- Item 1
  - Nested 1
    - Nested 2
      - Nested 3
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("- Item 1"));
  t.true(result.includes("  - Nested 1"));
  t.true(result.includes("    - Nested 2"));
  t.true(result.includes("      - Nested 3"));
});

test("normalizes list indentation - fixes inconsistent spacing", (t) => {
  const markdown = `
- Item 1
   - Nested (3 spaces)
     - Deep nested (5 spaces)
  `.trim();

  const result = formatForLLM(markdown);
  const lines = result.split("\n");

  // Should normalize to proper 2-space indentation
  t.true(lines.some((l) => l.match(/^  - Nested/)));
  t.true(lines.some((l) => l.match(/^    - Deep nested/)));
});

test("cleans inline formatting - reduces excessive emphasis", (t) => {
  const markdown = "This is ***very important*** text";
  const result = formatForLLM(markdown);
  t.true(result.includes("**very important**"));
  t.false(result.includes("***"));
});

test("cleans inline formatting - removes spaces inside emphasis", (t) => {
  const markdown = "This is ** spaced ** and * also spaced * text";
  const result = formatForLLM(markdown);
  t.true(result.includes("**spaced**"));
  t.true(result.includes("*also spaced*"));
});

test("cleans inline formatting - handles multiple emphasis patterns", (t) => {
  const markdown = "** bold ** and **** extra bold ****";
  const result = formatForLLM(markdown);
  t.true(result.includes("**bold**"));
  t.true(result.includes("**extra bold**"));
});

test("enhances code blocks - adds line breaks before", (t) => {
  const markdown = "Some text\`\`\`javascript\ncode\n\`\`\`";
  const result = formatForLLM(markdown);
  t.true(result.includes("Some text\n\n\`\`\`"));
});

test("enhances code blocks - adds line breaks after opening", (t) => {
  const markdown = "\`\`\`javascriptcode here\`\`\`";
  const result = formatForLLM(markdown);
  t.true(result.includes("\`\`\`\njavascript"));
});

test("enhances code blocks - properly spaces full code block", (t) => {
  const markdown = "Text\`\`\`js\nconst x = 1;\n\`\`\`More text";
  const result = formatForLLM(markdown);
  t.true(result.includes("Text\n\n\`\`\`"));
  t.true(result.includes("\`\`\`\njs"));
});

test("optimizes link formatting - converts reference to inline", (t) => {
  const markdown = `
This is a [link][ref] to something.

[ref]: https://example.com
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("[link](https://example.com)"));
  t.false(result.includes("[ref]:"));
});

test("optimizes link formatting - handles implicit references", (t) => {
  const markdown = `
This is a [link][] to something.

[link]: https://example.com
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("[link](https://example.com)"));
});

test("optimizes link formatting - handles multiple references", (t) => {
  const markdown = `
[Link 1][ref1] and [Link 2][ref2].

[ref1]: https://example.com
[ref2]: https://other.com
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("[Link 1](https://example.com)"));
  t.true(result.includes("[Link 2](https://other.com)"));
  t.false(result.includes("[ref1]:"));
  t.false(result.includes("[ref2]:"));
});

test("optimizes link formatting - case insensitive references", (t) => {
  const markdown = `
[Link][REF]

[ref]: https://example.com
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("[Link](https://example.com)"));
});

test("optimizes link formatting - preserves unmatched references", (t) => {
  const markdown = "[Link][missing]";
  const result = formatForLLM(markdown);
  t.true(result.includes("[Link][missing]"));
});

test("handles complex markdown with all transformations", (t) => {
  const markdown = `
# Title
#### Should be h2

- Item 1
  - Nested

This is ***bold*** and **emphasized**.

[Link][ref]

[ref]: https://example.com

Some text\`\`\`js
code
\`\`\`
  `.trim();

  const result = formatForLLM(markdown);

  // Check heading normalization
  t.true(result.includes("# Title"));
  t.true(result.includes("## Should be h2"));

  // Check list normalization
  t.true(result.includes("- Item 1"));
  t.true(result.includes("  - Nested"));

  // Check inline formatting
  t.true(result.includes("**bold**"));
  t.true(result.includes("**emphasized**"));

  // Check link optimization
  t.true(result.includes("[Link](https://example.com)"));

  // Check code block enhancement
  t.true(result.includes("\n\n\`\`\`"));
});

test("preserves inline code", (t) => {
  const markdown = "Use `const x = 1;` for variables";
  const result = formatForLLM(markdown);
  t.true(result.includes("`const x = 1;`"));
});

test("handles empty input", (t) => {
  const result = formatForLLM("");
  t.is(result, "");
});

test("handles markdown with no transformations needed", (t) => {
  const markdown = `
# Title
## Subtitle

- Item 1
- Item 2

This is normal text with **bold**.
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("# Title"));
  t.true(result.includes("## Subtitle"));
  t.true(result.includes("- Item 1"));
  t.true(result.includes("**bold**"));
});

test("normalizes mixed list styles in same list", (t) => {
  const markdown = `
* Item 1
+ Item 2
- Item 3
  `.trim();

  const result = formatForLLM(markdown);
  const lines = result.split("\n");
  t.true(lines.every((l) => !l.trim() || l.trim().startsWith("- ")));
});

test("handles nested lists with mixed markers", (t) => {
  const markdown = `
- Item 1
  - Nested 1
    - Deep nested
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("- Item 1"));
  t.true(result.includes("  - Nested 1"));
  t.true(result.includes("    - Deep nested"));
});

test("preserves ordered lists", (t) => {
  const markdown = `
1. First
2. Second
3. Third
  `.trim();

  const result = formatForLLM(markdown);
  t.true(result.includes("1. First"));
  t.true(result.includes("2. Second"));
  t.true(result.includes("3. Third"));
});

test("handles code blocks with language identifiers", (t) => {
  const markdown = "\`\`\`typescript\nconst x: number = 1;\n\`\`\`";
  const result = formatForLLM(markdown);
  t.true(result.includes("\`\`\`"));
  t.true(result.includes("typescript"));
});

test("handles multiple consecutive emphasis correctly", (t) => {
  const markdown = "**bold** and **more bold** text";
  const result = formatForLLM(markdown);
  t.true(result.includes("**bold**"));
  t.true(result.includes("**more bold**"));
});

test("normalizes heading levels progressively", (t) => {
  const markdown = `
# H1
### H3 (stays H3, max jump is 2)
##### H5 (stays H5, max jump is 2)
  `.trim();

  const result = formatForLLM(markdown);
  const lines = result.split("\n");

  t.true(lines[0].startsWith("#"));
  t.is(lines[0].match(/^#+/)?.[0].length, 1);

  // H3 is allowed because it's currentLevel (1) + 2 = 3
  t.true(lines[1].startsWith("###"));
  t.is(lines[1].match(/^#+/)?.[0].length, 3);

  // H5 is allowed because it's currentLevel (3) + 2 = 5
  t.true(lines[2].startsWith("#####"));
  t.is(lines[2].match(/^#+/)?.[0].length, 5);
});
