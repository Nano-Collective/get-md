// src/utils/validators.spec.ts

import test from "ava";
import { hasContent } from "./validators.js";

test("hasContent: returns true for HTML with sufficient text content", (t) => {
  const html = `
    <html>
      <body>
        <article>
          <h1>Article Title</h1>
          <p>This is a paragraph with enough text content to be considered valid content.
          It contains more than 100 characters which is the threshold for content validation.</p>
        </article>
      </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: returns false for HTML with insufficient text content", (t) => {
  const html = `
    <html>
      <body>
        <p>Short text</p>
      </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: returns false for empty HTML", (t) => {
  t.false(hasContent(""));
});

test("hasContent: returns false for non-string input", (t) => {
  t.false(hasContent(null as any));
  t.false(hasContent(undefined as any));
  t.false(hasContent(123 as any));
  t.false(hasContent({} as any));
  t.false(hasContent([] as any));
});

test("hasContent: ignores script tags when counting content", (t) => {
  const html = `
    <html>
      <body>
        <script>
          console.log("This script content should be ignored and not counted toward the 100 character minimum for content validation");
        </script>
        <p>Short</p>
      </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: ignores style tags when counting content", (t) => {
  const html = `
    <html>
      <body>
        <style>
          body { font-family: Arial; }
          .container { max-width: 1200px; }
          This style content is long enough but should be ignored completely.
        </style>
        <p>Short</p>
      </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: ignores nav elements when counting content", (t) => {
  const html = `
    <html>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          This navigation content should be ignored when checking for meaningful content in the document.
        </nav>
        <p>Short content</p>
      </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: ignores header elements when counting content", (t) => {
  const html = `
    <html>
      <body>
        <header>
          <h1>Site Header</h1>
          <p>This header content should be ignored when validating if the page has meaningful extractable content.</p>
        </header>
        <p>Brief text</p>
      </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: ignores footer elements when counting content", (t) => {
  const html = `
    <html>
      <body>
        <p>Short main content</p>
        <footer>
          <p>Copyright 2024. All rights reserved. This footer content should be ignored when checking content.</p>
        </footer>
      </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: counts content from body after removing noise elements", (t) => {
  const html = `
    <html>
      <body>
        <header>Site Header with some text</header>
        <nav>Navigation links here</nav>
        <script>console.log("ignored");</script>
        <style>.ignored { color: red; }</style>
        <main>
          <h1>Main Content</h1>
          <p>This is the actual content of the page that should be counted. It has enough characters to pass the validation threshold of 100 characters.</p>
        </main>
        <footer>Footer text here</footer>
      </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: handles HTML with only whitespace", (t) => {
  const html = `
    <html>
      <body>



      </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: handles malformed HTML gracefully", (t) => {
  const html = "<div><p>Unclosed tags and malformed structure";

  t.false(hasContent(html));
});

test("hasContent: returns false for HTML with only removed elements", (t) => {
  const html = `
    <html>
      <body>
        <script>alert("Only script content here with enough characters to exceed 100 if it were counted");</script>
        <style>body { color: blue; padding: 20px; margin: 0; font-size: 16px; line-height: 1.5; }</style>
      </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: handles HTML with exactly 100 characters", (t) => {
  // Create exactly 100 characters of content
  const content = "a".repeat(100);
  const html = `<html><body><p>${content}</p></body></html>`;

  t.true(hasContent(html));
});

test("hasContent: handles HTML with 99 characters (just below threshold)", (t) => {
  const content = "a".repeat(99);
  const html = `<html><body><p>${content}</p></body></html>`;

  t.false(hasContent(html));
});

test("hasContent: handles HTML with 101 characters (just above threshold)", (t) => {
  const content = "a".repeat(101);
  const html = `<html><body><p>${content}</p></body></html>`;

  t.true(hasContent(html));
});

test("hasContent: handles deeply nested HTML structure", (t) => {
  const html = `
    <html>
      <body>
        <div>
          <div>
            <div>
              <article>
                <section>
                  <p>This is deeply nested content with enough text to be considered valid.
                  The validation should work regardless of nesting depth in the HTML structure.</p>
                </section>
              </article>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: handles HTML parsing errors", (t) => {
  const invalidHtml = "<<<>>>{{{}}}";

  t.false(hasContent(invalidHtml));
});

test("hasContent: trims whitespace before checking length", (t) => {
  const html = `
    <html>
      <body>
        <p>

          Content with lots of whitespace padding that should be trimmed before length check happens here and continues.

        </p>
      </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: handles multiple paragraphs", (t) => {
  const html = `
    <html>
      <body>
        <p>First paragraph with some text.</p>
        <p>Second paragraph with more text.</p>
        <p>Third paragraph to ensure we exceed the 100 character threshold for content validation.</p>
      </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: handles list elements", (t) => {
  const html = `
    <html>
      <body>
        <ul>
          <li>First item with some content</li>
          <li>Second item with more content</li>
          <li>Third item to ensure sufficient length for validation purposes and exceed threshold</li>
        </ul>
      </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: handles HTML entities", (t) => {
  const html = `
    <html>
      <body>
        <p>&lt;This text contains HTML entities&gt; and should be counted properly.
        It has enough content to pass the validation threshold of 100 characters total.</p>
      </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: handles mixed content types", (t) => {
  const html = `
    <html>
      <body>
        <h1>Heading</h1>
        <p>Paragraph text</p>
        <blockquote>Quote text that adds to the total character count</blockquote>
        <div>Division with additional content to ensure we pass validation</div>
      </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: handles empty body tag", (t) => {
  const html = `<html><body></body></html>`;

  t.false(hasContent(html));
});

test("hasContent: handles body with only whitespace and newlines", (t) => {
  const html = `
    <html>
      <body>



      </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: ignores all noise elements combined", (t) => {
  const html = `
    <html>
      <body>
        <header>Header content with text</header>
        <nav>Navigation content</nav>
        <script>console.log("script");</script>
        <style>body { color: red; }</style>
        <footer>Footer content</footer>
        <p>Only this short text should be counted</p>
      </body>
    </html>
  `;

  t.false(hasContent(html));
});
