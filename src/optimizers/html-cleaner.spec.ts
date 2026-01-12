// src/optimizers/html-cleaner.spec.ts

import test from "ava";
import { cleanHTML } from "./html-cleaner.js";

test("removes script tags", (t) => {
  const html = `
    <div>
      <p>Content</p>
      <script>alert('test');</script>
    </div>
  `;
  const result = cleanHTML(html);
  // nosemgrep: javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag
  t.false(result.includes("<script>"));
  t.true(result.includes("Content"));
});

test("removes style tags", (t) => {
  const html = `
    <div>
      <p>Content</p>
      <style>.test { color: red; }</style>
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("<style>"));
  t.true(result.includes("Content"));
});

test("removes noscript tags", (t) => {
  const html = `
    <div>
      <p>Content</p>
      <noscript>No JS support</noscript>
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("<noscript>"));
  t.true(result.includes("Content"));
});

test("removes HTML comments", (t) => {
  const html = `
    <div>
      <p>Content</p>
      <!-- This is a comment -->
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("<!-- This is a comment -->"));
  t.true(result.includes("Content"));
});

test("removes navigation elements by role", (t) => {
  const html = `
    <div>
      <nav role="navigation">Nav content</nav>
      <div role="banner">Banner content</div>
      <div role="complementary">Sidebar</div>
      <footer role="contentinfo">Footer</footer>
      <p>Main content</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("Nav content"));
  t.false(result.includes("Banner content"));
  t.false(result.includes("Sidebar"));
  t.false(result.includes("Footer"));
  t.true(result.includes("Main content"));
});

test("removes navigation elements by tag and class", (t) => {
  const html = `
    <div>
      <nav class="navbar">Nav</nav>
      <div class="navbar">Nav2</div>
      <p>Content</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("Nav"));
  t.false(result.includes("Nav2"));
  t.true(result.includes("Content"));
});

test("removes aside elements", (t) => {
  const html = `
    <div>
      <aside>Sidebar content</aside>
      <p>Main content</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("Sidebar content"));
  t.true(result.includes("Main content"));
});

test("removes ad elements", (t) => {
  const html = `
    <div>
      <div class="ad">Advertisement</div>
      <div class="ads">More ads</div>
      <div class="advertisement">Yet more ads</div>
      <p>Content</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("Advertisement"));
  t.false(result.includes("More ads"));
  t.false(result.includes("Yet more ads"));
  t.true(result.includes("Content"));
});

test("removes social media elements", (t) => {
  const html = `
    <div>
      <div class="social-share">Share this</div>
      <div class="share-buttons">Share buttons</div>
      <p>Content</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("Share this"));
  t.false(result.includes("Share buttons"));
  t.true(result.includes("Content"));
});

test("removes comment sections", (t) => {
  const html = `
    <div>
      <div class="comments">Comments section</div>
      <div id="comments">More comments</div>
      <p>Content</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("Comments section"));
  t.false(result.includes("More comments"));
  t.true(result.includes("Content"));
});

test("removes cookie notices", (t) => {
  const html = `
    <div>
      <div class="cookie-notice">We use cookies</div>
      <p>Content</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes("We use cookies"));
  t.true(result.includes("Content"));
});

test("removes elements with noise text (short content)", (t) => {
  const html = `
    <div>
      <div>Accept cookies now</div>
      <div>Sign up for our newsletter</div>
      <div>Follow us on social media</div>
    </div>
  `;
  const result = cleanHTML(html);
  // These short elements with noise keywords should be removed
  t.false(result.includes("Accept cookies"));
  t.false(result.includes("Sign up for"));
  t.false(result.includes("Follow us"));
});

test("preserves elements with noise keywords if content is long", (t) => {
  const html = `
    <div>
      <p>${"This article discusses cookie policy and how it affects your browsing. ".repeat(10)}</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.true(result.includes("cookie policy"));
});

test("cleans attributes but keeps essential ones", (t) => {
  const html = `
    <div id="test" class="container" data-value="123">
      <a href="https://example.com" target="_blank" rel="noopener">Link</a>
      <img src="image.jpg" alt="Test" class="img-fluid" />
    </div>
  `;
  const result = cleanHTML(html);
  t.false(result.includes('id="test"'));
  t.false(result.includes('class="container"'));
  t.false(result.includes('target="_blank"'));
  t.true(result.includes('href="https://example.com"'));
  t.true(result.includes('src="image.jpg"'));
  t.true(result.includes('alt="Test"'));
});

test("preserves data attributes on code elements", (t) => {
  const html = `
    <div>
      <pre data-language="javascript"><code data-line="1">const x = 1;</code></pre>
    </div>
  `;
  const result = cleanHTML(html);
  t.true(result.includes('data-language="javascript"'));
  t.true(result.includes('data-line="1"'));
});

test("preserves table attributes", (t) => {
  const html = `
    <table>
      <tr>
        <td colspan="2" rowspan="3" align="center">Cell</td>
      </tr>
    </table>
  `;
  const result = cleanHTML(html);
  t.true(result.includes("colspan"));
  t.true(result.includes("rowspan"));
  t.true(result.includes("align"));
});

test("removes empty elements", (t) => {
  const html = `
    <div>
      <p></p>
      <div></div>
      <h1>Title</h1>
      <p>Content</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.true(result.includes("<h1>Title</h1>"));
  t.true(result.includes("<p>Content</p>"));
  // Empty p and div should be removed
  t.false(result.includes("<p></p>"));
});

test("removes elements with only punctuation", (t) => {
  const html = `
    <div>
      <p>| - .</p>
      <p>Real content</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.true(result.includes("Real content"));
  // Punctuation-only paragraph should be removed
  const emptyPTags = (result.match(/<p>[\s|_.:;-]+<\/p>/g) || []).length;
  t.is(emptyPTags, 0);
});

test("preserves images and iframes", (t) => {
  const html = `
    <div>
      <img src="test.jpg" alt="Test" />
      <iframe src="video.html"></iframe>
    </div>
  `;
  const result = cleanHTML(html);
  t.true(result.includes("<img"));
  t.true(result.includes("<iframe"));
});

test("resolves relative URLs when baseUrl is provided", (t) => {
  const html = `
    <div>
      <img src="/images/test.jpg" />
      <a href="/page">Link</a>
    </div>
  `;
  const result = cleanHTML(html, { baseUrl: "https://example.com" });
  t.true(result.includes('src="https://example.com/images/test.jpg"'));
  t.true(result.includes('href="https://example.com/page"'));
});

test("does not resolve absolute URLs", (t) => {
  const html = `
    <div>
      <img src="https://other.com/image.jpg" />
      <a href="https://other.com/page">Link</a>
    </div>
  `;
  const result = cleanHTML(html, { baseUrl: "https://example.com" });
  t.true(result.includes('src="https://other.com/image.jpg"'));
  t.true(result.includes('href="https://other.com/page"'));
});

test("does not resolve data URLs", (t) => {
  const html = `
    <div>
      <img src="data:image/png;base64,ABC123" />
    </div>
  `;
  const result = cleanHTML(html, { baseUrl: "https://example.com" });
  t.true(result.includes('src="data:image/png;base64,ABC123"'));
});

test("does not resolve anchor links", (t) => {
  const html = `
    <div>
      <a href="#section">Jump to section</a>
    </div>
  `;
  const result = cleanHTML(html, { baseUrl: "https://example.com" });
  t.true(result.includes('href="#section"'));
});

test("does not resolve mailto links", (t) => {
  const html = `
    <div>
      <a href="mailto:test@example.com">Email</a>
    </div>
  `;
  const result = cleanHTML(html, { baseUrl: "https://example.com" });
  t.true(result.includes('href="mailto:test@example.com"'));
});

test("skips aggressive cleaning when aggressive is false", (t) => {
  const html = `
    <div>
      <nav role="navigation">Nav content</nav>
      <aside>Sidebar</aside>
      <p>Content</p>
    </div>
  `;
  const result = cleanHTML(html, { aggressive: false });
  t.true(result.includes("Nav content"));
  t.true(result.includes("Sidebar"));
  t.true(result.includes("Content"));
});

test("handles invalid URLs gracefully", (t) => {
  const html = `
    <div>
      <img src="::invalid::" />
      <a href="::invalid::">Link</a>
    </div>
  `;
  t.notThrows(() => {
    cleanHTML(html, { baseUrl: "https://example.com" });
  });
});

test("handles complex nested structures", (t) => {
  const html = `
    <div>
      <header role="banner">
        <nav class="navbar">
          <div class="social-share">Share</div>
        </nav>
      </header>
      <main>
        <article>
          <h1>Title</h1>
          <p>Content</p>
        </article>
        <aside>Sidebar</aside>
      </main>
      <footer role="contentinfo">Footer</footer>
    </div>
  `;
  const result = cleanHTML(html);
  t.true(result.includes("<h1>Title</h1>"));
  t.true(result.includes("<p>Content</p>"));
  t.false(result.includes("Share"));
  t.false(result.includes("Sidebar"));
  t.false(result.includes("Footer"));
});

test("preserves content in pre and code tags", (t) => {
  const html = `
    <div>
      <pre data-lang="js"><code>const x = 1;</code></pre>
      <p>Text</p>
    </div>
  `;
  const result = cleanHTML(html);
  t.true(result.includes("<pre"));
  t.true(result.includes("<code>"));
  t.true(result.includes("const x = 1;"));
});
