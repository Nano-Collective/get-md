import test from "ava";
import { recoverMermaid } from "./mermaid-recovery.js";

test("recoverMermaid: recovers from embedded <script type='text/mermaid'>", (t) => {
  const html = `
    <div class="mermaid">
      <svg id="mermaid-123"><g></g></svg>
      <script type="text/mermaid">graph TD; A-->B;</script>
    </div>
  `;
  const result = recoverMermaid(html);
  t.true(result.includes('<pre><code class="language-mermaid">graph TD; A--&gt;B;</code></pre>'));
  t.false(result.includes("<svg"));
});

test("recoverMermaid: recovers from sibling <script type='text/mermaid'>", (t) => {
  const html = `
    <div>
      <div class="mermaid" data-processed="true">
        <svg id="mermaid-123"><g></g></svg>
      </div>
      <script type="text/mermaid">sequenceDiagram; A->>B: hi</script>
    </div>
  `;
  const result = recoverMermaid(html);
  t.true(result.includes('<pre><code class="language-mermaid">sequenceDiagram; A-&gt;&gt;B: hi</code></pre>'));
  t.false(result.includes("<svg"));
});

test("recoverMermaid: recovers from data-* attributes", (t) => {
  const html = `
    <div class="mermaid" data-mermaid="gantt title Project">
      <svg><g></g></svg>
    </div>
  `;
  const result = recoverMermaid(html);
  t.true(result.includes('<pre><code class="language-mermaid">gantt title Project</code></pre>'));
  t.false(result.includes("<svg"));
});

test("recoverMermaid: recovers from hidden original <pre> sibling", (t) => {
  const html = `
    <div class="mermaid-container">
      <svg class="mermaid"><g></g></svg>
      <pre hidden="">graph LR; X-->Y;</pre>
    </div>
  `;
  const result = recoverMermaid(html);
  t.true(result.includes('<pre><code class="language-mermaid">graph LR; X--&gt;Y;</code></pre>'));
  t.false(result.includes("<svg"));
});

test("recoverMermaid: recovers from SVG <desc> as fallback", (t) => {
  const html = `
    <div class="mermaid">
      <svg>
        <desc>classDiagram class A { }</desc>
        <g></g>
      </svg>
    </div>
  `;
  const result = recoverMermaid(html);
  t.true(result.includes('<pre><code class="language-mermaid">classDiagram class A { }</code></pre>'));
  t.false(result.includes("<svg"));
});

test("recoverMermaid: ignores non-source SVG <desc>", (t) => {
  const html = `
    <div class="mermaid">
      <svg>
        <desc>Created with Mermaid</desc>
        <g></g>
      </svg>
    </div>
  `;
  const result = recoverMermaid(html);
  // It shouldn't recover anything and should leave the HTML untouched.
  t.true(result.includes("<svg>"));
  t.true(result.includes("<desc>Created with Mermaid</desc>"));
  t.false(result.includes('<code class="language-mermaid"'));
});

test("recoverMermaid: leaves pure pre>code alone, or adds class if missing", (t) => {
  const html = `
    <pre class="mermaid">graph TD; A-->B;</pre>
  `;
  const result = recoverMermaid(html);
  t.true(result.includes('<pre><code class="language-mermaid">graph TD; A--&gt;B;</code></pre>'));
});

test("recoverMermaid: SVG with NO recoverable source -> remains unchanged", (t) => {
  const html = `
    <div class="mermaid">
      <svg id="mermaid-999">
        <g><path d="M10 10"/></g>
      </svg>
    </div>
  `;
  const result = recoverMermaid(html);
  t.true(result.includes('<svg id="mermaid-999">'));
  t.false(result.includes('<pre><code'));
});
