// src/optimizers/structure-enhancer.spec.ts

import test from "ava";
import { enhanceStructure } from "./structure-enhancer.js";

test("normalizes heading hierarchy - fixes skipped levels", (t) => {
  const html = `
    <div>
      <h1>Title</h1>
      <h5>Should be h2</h5>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h1>Title</h1>"));
  t.true(result.includes("<h2>Should be h2</h2>"));
  t.false(result.includes("<h5>"));
});

test("normalizes heading hierarchy - respects proper sequence", (t) => {
  const html = `
    <div>
      <h1>Level 1</h1>
      <h2>Level 2</h2>
      <h3>Level 3</h3>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h1>Level 1</h1>"));
  t.true(result.includes("<h2>Level 2</h2>"));
  t.true(result.includes("<h3>Level 3</h3>"));
});

test("normalizes heading hierarchy - progressive adjustment", (t) => {
  const html = `
    <div>
      <h1>H1</h1>
      <h3>H3 becomes H2</h3>
      <h6>H6 becomes H3</h6>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h1>H1</h1>"));
  t.true(result.includes("<h2>H3 becomes H2</h2>"));
  t.true(result.includes("<h3>H6 becomes H3</h3>"));
  t.false(result.includes("<h6>"));
});

test("normalizes heading hierarchy - handles multiple sections", (t) => {
  const html = `
    <div>
      <h2>First section</h2>
      <h3>Subsection</h3>
      <h2>Second section</h2>
      <h5>Should be h3</h5>
    </div>
  `;
  const result = enhanceStructure(html);
  // h2 at start becomes h1 (can't skip levels from 0)
  t.true(result.includes("<h1>First section</h1>"));
  // h3 after h1 becomes h2
  t.true(result.includes("<h2>Subsection</h2>"));
  // h2 after h2 stays h2
  t.true(result.includes("<h2>Second section</h2>"));
  // h5 after h2 becomes h3 (can only go up by 1)
  t.true(result.includes("<h3>Should be h3</h3>"));
});

test("unwraps redundant nested divs", (t) => {
  const html = `
    <div>
      <div>
        <div>
          <p>Content</p>
        </div>
      </div>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<p>Content</p>"));
  // Should have fewer nested divs
  const divCount = (result.match(/<div>/g) || []).length;
  t.true(divCount < 3);
});

test("unwraps redundant nested spans", (t) => {
  const html = `
    <span>
      <span>
        Text content
      </span>
    </span>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("Text content"));
  // Should have fewer nested spans
  const spanCount = (result.match(/<span>/g) || []).length;
  t.true(spanCount < 2);
});

test("unwraps paragraphs containing block elements", (t) => {
  const html = `
    <div>
      <p><div>Should be unwrapped</div></p>
      <p><blockquote>Quote</blockquote></p>
      <p><ul><li>List</li></ul></p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.false(result.includes("<p><div>"));
  t.false(result.includes("<p><blockquote>"));
  t.false(result.includes("<p><ul>"));
  t.true(result.includes("Should be unwrapped"));
  t.true(result.includes("Quote"));
  t.true(result.includes("List"));
});

test("preserves paragraphs with inline content", (t) => {
  const html = `
    <div>
      <p>Normal paragraph with <strong>emphasis</strong></p>
      <p><span>With span</span></p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<p>Normal paragraph"));
  t.true(result.includes("<strong>emphasis</strong>"));
});

test("converts title-classed divs to headings", (t) => {
  const html = `
    <div>
      <div class="title">This looks like a title</div>
      <p>Content</p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h3>This looks like a title</h3>"));
  t.false(result.includes('class="title"'));
});

test("converts heading-classed divs to headings", (t) => {
  const html = `
    <div>
      <div class="heading">Section Heading</div>
      <p>Content</p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h3>Section Heading</h3>"));
});

test("converts bold styled divs to headings", (t) => {
  const html = `
    <div>
      <div style="font-weight: bold">Bold Title</div>
      <div style="font-weight:bold">Another Title</div>
      <p>Content</p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h3>Bold Title</h3>"));
  t.true(result.includes("<h3>Another Title</h3>"));
});

test("converts bold styled spans to headings", (t) => {
  const html = `
    <div>
      <span style="font-weight: bold">Span Title</span>
      <p>Content</p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h3>Span Title</h3>"));
});

test("does not convert long text to headings", (t) => {
  const longText = "A".repeat(150);
  const html = `
    <div>
      <div class="title">${longText}</div>
    </div>
  `;
  const result = enhanceStructure(html);
  t.false(result.includes("<h3>"));
  t.true(result.includes(longText));
});

test("does not convert divs with children to headings", (t) => {
  const html = `
    <div>
      <div class="title">
        <span>Nested</span>
        <span>Content</span>
      </div>
    </div>
  `;
  const result = enhanceStructure(html);
  t.false(result.includes("<h3>"));
  t.true(result.includes("<span>Nested</span>"));
});

test("does not convert empty divs to headings", (t) => {
  const html = `
    <div>
      <div class="title"></div>
      <p>Content</p>
    </div>
  `;
  const result = enhanceStructure(html);
  // Count h3 tags - should be 0
  const h3Count = (result.match(/<h3>/g) || []).length;
  t.is(h3Count, 0);
});

test("handles complex nested structure", (t) => {
  const html = `
    <div>
      <h1>Main Title</h1>
      <div>
        <div>
          <h5>Should be h2</h5>
          <div class="title">Pseudo heading</div>
          <p><blockquote>Quote</blockquote></p>
        </div>
      </div>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h1>Main Title</h1>"));
  t.true(result.includes("<h2>Should be h2</h2>"));
  t.true(result.includes("<h3>Pseudo heading</h3>"));
  t.false(result.includes("<p><blockquote>"));
});

test("preserves heading content with HTML entities", (t) => {
  const html = `
    <div>
      <h1>Title &amp; Subtitle</h1>
      <h5>Second &lt;Level&gt;</h5>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("Title &amp; Subtitle"));
  t.true(result.includes("Second &lt;Level&gt;"));
});

test("handles headings with nested elements", (t) => {
  const html = `
    <div>
      <h1>Title <strong>with emphasis</strong></h1>
      <h5>Level <em>five</em></h5>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h1>Title <strong>with emphasis</strong></h1>"));
  t.true(result.includes("<h2>Level <em>five</em></h2>"));
});

test("handles empty input", (t) => {
  const result = enhanceStructure("");
  t.truthy(result);
});

test("handles input with no transformations needed", (t) => {
  const html = `
    <div>
      <h1>Title</h1>
      <h2>Subtitle</h2>
      <p>Content</p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h1>Title</h1>"));
  t.true(result.includes("<h2>Subtitle</h2>"));
  t.true(result.includes("<p>Content</p>"));
});

test("converts multiple pseudo-headings in same document", (t) => {
  const html = `
    <div>
      <div class="title">First Title</div>
      <p>Content 1</p>
      <div class="heading">Second Title</div>
      <p>Content 2</p>
      <span style="font-weight: bold">Third Title</span>
      <p>Content 3</p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h3>First Title</h3>"));
  t.true(result.includes("<h3>Second Title</h3>"));
  t.true(result.includes("<h3>Third Title</h3>"));
});

test("handles case-insensitive class matching", (t) => {
  const html = `
    <div>
      <div class="Title">Mixed Case Title</div>
      <div class="HEADING">Upper Case Heading</div>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<h3>Mixed Case Title</h3>"));
  t.true(result.includes("<h3>Upper Case Heading</h3>"));
});

test("unwraps nested paragraphs with pre elements", (t) => {
  const html = `
    <div>
      <p><pre>Code block</pre></p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.false(result.includes("<p><pre>"));
  t.true(result.includes("<pre>Code block</pre>"));
});

test("unwraps nested paragraphs with table elements", (t) => {
  const html = `
    <div>
      <p><table><tr><td>Cell</td></tr></table></p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.false(result.includes("<p><table>"));
  t.true(result.includes("<table>"));
});

test("preserves paragraph with multiple inline elements", (t) => {
  const html = `
    <div>
      <p><strong>Bold</strong> and <em>italic</em> text</p>
    </div>
  `;
  const result = enhanceStructure(html);
  t.true(result.includes("<p>"));
  t.true(result.includes("<strong>Bold</strong>"));
  t.true(result.includes("<em>italic</em>"));
});

test("handles heading hierarchy reset across sections", (t) => {
  const html = `
    <div>
      <h1>Section 1</h1>
      <h2>Subsection</h2>
    </div>
    <div>
      <h1>Section 2</h1>
      <h2>Subsection</h2>
    </div>
  `;
  const result = enhanceStructure(html);
  const h1Count = (result.match(/<h1>/g) || []).length;
  const h2Count = (result.match(/<h2>/g) || []).length;
  t.is(h1Count, 2);
  t.is(h2Count, 2);
});
