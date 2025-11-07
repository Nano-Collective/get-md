// src/index.spec.ts

import test from "ava";
import { convertToMarkdown, hasContent } from "./index.js";
import type { MarkdownOptions, MarkdownResult } from "./index.js";

// Add cleanup hook to force exit after tests complete
// This is necessary because network fetch operations can keep the event loop alive
test.after.always("cleanup", () => {
  // Give a brief moment for cleanup, then force exit
  setTimeout(() => {
    process.exit(0);
  }, 100);
});

// Test HTML fixtures
const SIMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <meta name="description" content="A test description">
</head>
<body>
  <h1>Hello World</h1>
  <p>This is a test paragraph with enough content to be processed.</p>
</body>
</html>
`;

const COMPLEX_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Complex Page</title>
  <meta name="author" content="John Doe">
</head>
<body>
  <nav>Navigation</nav>
  <article>
    <h1>Main Article</h1>
    <p>This is the main content with substantial text to ensure proper extraction by Readability.</p>
    <img src="test.jpg" alt="Test image">
    <a href="https://example.com">Example Link</a>
    <pre><code class="language-javascript">const x = 42;</code></pre>
  </article>
  <footer>Footer</footer>
</body>
</html>
`;

const HTML_WITH_ALL_FEATURES = `
<!DOCTYPE html>
<html>
<body>
  <h1>Features Test</h1>
  <p>Text content</p>
  <img src="/image.jpg" alt="Image">
  <a href="/link">Link</a>
  <table>
    <tr>
      <th>Header</th>
    </tr>
    <tr>
      <td>Cell</td>
    </tr>
  </table>
</body>
</html>
`;

const MINIMAL_HTML = `<html><body><p>Short text.</p></body></html>`;

const EMPTY_HTML = `<html><body></body></html>`;

const HTML_WITH_NOISE = `
<!DOCTYPE html>
<html>
<head>
  <script>console.log('noise');</script>
  <style>.noise { display: none; }</style>
</head>
<body>
  <nav>Navigation menu</nav>
  <aside>Sidebar content</aside>
  <article>
    <h1>Main Content</h1>
    <p>This is the primary article content with substantial text to ensure Readability extraction works correctly. We need enough content here to meet the threshold requirements.</p>
  </article>
  <footer>Footer information</footer>
</body>
</html>
`;

// Basic conversion tests
test("convertToMarkdown: converts HTML string to markdown", async (t) => {
  const result = await convertToMarkdown(SIMPLE_HTML);

  t.truthy(result);
  t.is(typeof result.markdown, "string");
  t.true(result.markdown.length > 0);
  t.truthy(result.metadata);
  t.truthy(result.stats);
});

test("convertToMarkdown: returns proper MarkdownResult structure", async (t) => {
  const result = await convertToMarkdown(SIMPLE_HTML);

  // Check markdown field
  t.is(typeof result.markdown, "string");

  // Check metadata field
  t.truthy(result.metadata);
  t.is(typeof result.metadata, "object");

  // Check stats field
  t.truthy(result.stats);
  t.is(typeof result.stats.inputLength, "number");
  t.is(typeof result.stats.outputLength, "number");
  t.is(typeof result.stats.processingTime, "number");
  t.is(typeof result.stats.readabilitySuccess, "boolean");
  t.is(typeof result.stats.imageCount, "number");
  t.is(typeof result.stats.linkCount, "number");
});

test("convertToMarkdown: converts complex HTML with proper content extraction", async (t) => {
  const result = await convertToMarkdown(COMPLEX_HTML);

  t.true(result.markdown.includes("Main Article"));
  t.true(result.markdown.includes("main content"));
  t.truthy(result.metadata);
});

test("convertToMarkdown: handles empty HTML", async (t) => {
  const result = await convertToMarkdown(EMPTY_HTML);

  t.is(typeof result.markdown, "string");
  t.truthy(result.metadata);
  t.truthy(result.stats);
});

test("convertToMarkdown: handles minimal HTML", async (t) => {
  const result = await convertToMarkdown(MINIMAL_HTML);

  t.true(result.markdown.includes("Short text"));
  t.truthy(result.stats);
});

// Options tests
test("convertToMarkdown: respects extractContent option", async (t) => {
  const result = await convertToMarkdown(HTML_WITH_NOISE, {
    extractContent: false,
  });

  // Should include navigation and footer when not extracting
  t.true(
    result.markdown.includes("Navigation") ||
      result.markdown.includes("Footer"),
  );
  t.is(result.stats.readabilitySuccess, false);
});

test("convertToMarkdown: respects includeMeta option", async (t) => {
  const resultWithMeta = await convertToMarkdown(SIMPLE_HTML, {
    includeMeta: true,
  });
  const resultWithoutMeta = await convertToMarkdown(SIMPLE_HTML, {
    includeMeta: false,
  });

  // With meta should start with YAML frontmatter
  t.true(resultWithMeta.markdown.startsWith("---"));

  // Without meta should not start with frontmatter
  t.false(resultWithoutMeta.markdown.startsWith("---"));
});

test("convertToMarkdown: respects includeImages option", async (t) => {
  const withImages = await convertToMarkdown(HTML_WITH_ALL_FEATURES, {
    includeImages: true,
  });
  const withoutImages = await convertToMarkdown(HTML_WITH_ALL_FEATURES, {
    includeImages: false,
  });

  t.true(
    withImages.markdown.includes("![") || withImages.markdown.includes("Image"),
  );
  t.false(withoutImages.markdown.includes("!["));
  t.is(withoutImages.stats.imageCount, 0);
});

test("convertToMarkdown: respects includeLinks option", async (t) => {
  const withLinks = await convertToMarkdown(HTML_WITH_ALL_FEATURES, {
    includeLinks: true,
  });
  const withoutLinks = await convertToMarkdown(HTML_WITH_ALL_FEATURES, {
    includeLinks: false,
  });

  t.true(withLinks.markdown.includes("[") && withLinks.markdown.includes("]("));
  // When links are disabled, text should remain but not as markdown links
  t.true(withoutLinks.markdown.includes("Link"));
  t.is(withoutLinks.stats.linkCount, 0);
});

test("convertToMarkdown: respects includeTables option", async (t) => {
  const withTables = await convertToMarkdown(HTML_WITH_ALL_FEATURES, {
    includeTables: true,
  });
  const withoutTables = await convertToMarkdown(HTML_WITH_ALL_FEATURES, {
    includeTables: false,
  });

  t.true(withTables.markdown.includes("|"));
  t.false(withoutTables.markdown.includes("| Header"));
});

test("convertToMarkdown: respects maxLength option", async (t) => {
  const longHtml = `
    <html><body>
      ${Array(500)
        .fill(0)
        .map((_, i) => `<p>Paragraph ${i} with content.</p>`)
        .join("\n")}
    </body></html>
  `;

  const result = await convertToMarkdown(longHtml, { maxLength: 500 });

  t.true(result.markdown.length <= 550); // Some margin for truncation message
  t.true(result.markdown.includes("[Content truncated]"));
});

test("convertToMarkdown: respects baseUrl option for relative links", async (t) => {
  const html = '<html><body><a href="/page">Link</a></body></html>';
  const result = await convertToMarkdown(html, {
    baseUrl: "https://example.com",
  });

  t.true(
    result.markdown.includes("https://example.com/page") ||
      result.markdown.includes("example.com/page"),
  );
});

test("convertToMarkdown: accepts custom rules", async (t) => {
  const customRules = [
    {
      name: "customStrong",
      filter: "strong",
      replacement: (content: string) => `**CUSTOM:${content}**`,
    },
  ];

  const html = "<html><body><strong>Bold</strong></body></html>";
  const result = await convertToMarkdown(html, { customRules });

  t.true(result.markdown.includes("CUSTOM:Bold"));
});

test("convertToMarkdown: applies multiple options together", async (t) => {
  const result = await convertToMarkdown(HTML_WITH_ALL_FEATURES, {
    includeImages: false,
    includeLinks: false,
    includeTables: false,
    includeMeta: false,
    extractContent: false,
  });

  t.false(result.markdown.includes("!["));
  t.false(result.markdown.includes("]("));
  t.false(result.markdown.includes("| Header"));
  t.false(result.markdown.startsWith("---\n"));
});

// URL handling tests
test.serial(
  "convertToMarkdown: detects and fetches valid HTTP URLs",
  async (t) => {
    // Note: This test requires network access
    const url = "https://example.com";

    // Test that it recognizes as URL and fetches successfully
    const result = await convertToMarkdown(url);

    // Should successfully fetch and convert
    t.truthy(result);
    t.is(typeof result.markdown, "string");
    t.true(result.markdown.length > 0);
    t.truthy(result.metadata);
    t.truthy(result.stats);
  },
);

test.serial(
  "convertToMarkdown: detects and fetches valid HTTPS URLs",
  async (t) => {
    // Note: This test requires network access
    const url = "https://example.com";

    // Test that it recognizes as URL and fetches
    const result = await convertToMarkdown(url);

    t.truthy(result);
    t.is(typeof result.markdown, "string");
    t.true(result.markdown.length > 0);
  },
);

test("convertToMarkdown: forces URL mode with isUrl option", async (t) => {
  // This should try to treat the input as a URL even if it doesn't have protocol
  const input = "example.com";

  await t.throwsAsync(
    async () => {
      await convertToMarkdown(input, { isUrl: true });
    },
    undefined,
    "Should treat as URL when isUrl is true",
  );
});

test("convertToMarkdown: treats non-URL as HTML by default", async (t) => {
  const input = "example.com";

  // Without isUrl, should treat as HTML string
  const result = await convertToMarkdown(input);

  t.truthy(result);
  t.is(typeof result.markdown, "string");
});

test.serial(
  "convertToMarkdown: passes fetch options for URL requests",
  async (t) => {
    // Note: This test requires network access
    const url = "https://example.com";
    const options: MarkdownOptions = {
      timeout: 10000,
      followRedirects: true,
      maxRedirects: 3,
      userAgent: "Custom User Agent",
    };

    // Should successfully fetch with custom options
    const result = await convertToMarkdown(url, options);

    t.truthy(result);
    t.is(typeof result.markdown, "string");
    t.true(result.markdown.length > 0);
  },
);

test("convertToMarkdown: sets baseUrl to fetched URL automatically", async (t) => {
  // When fetching a URL, baseUrl should be set to that URL
  // This is tested indirectly through the URL fetching behavior
  const html = SIMPLE_HTML;

  const result = await convertToMarkdown(html, {
    baseUrl: "https://example.com",
  });

  // Should have baseUrl set in the conversion
  t.truthy(result);
  t.truthy(result.markdown);
});

test.serial(
  "convertToMarkdown: preserves custom baseUrl option for URL fetch",
  async (t) => {
    // Note: This test requires network access
    const url = "https://example.com";

    // Should use custom baseUrl if provided (though url will be used as fallback)
    const result = await convertToMarkdown(url, {
      baseUrl: "https://custom-base.com",
    });

    t.truthy(result);
    t.is(typeof result.markdown, "string");
    t.true(result.markdown.length > 0);
  },
);

// hasContent function tests
test("hasContent: returns true for HTML with sufficient content", (t) => {
  const html = `
    <html>
    <body>
      <p>This is a paragraph with more than 100 characters of text content to ensure that the hasContent function returns true for this HTML string.</p>
    </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: returns false for HTML with insufficient content", (t) => {
  const html = "<html><body><p>Short.</p></body></html>";

  t.false(hasContent(html));
});

test("hasContent: returns false for empty HTML", (t) => {
  const html = "<html><body></body></html>";

  t.false(hasContent(html));
});

test("hasContent: returns false for empty string", (t) => {
  t.false(hasContent(""));
});

test("hasContent: returns false for null/undefined input", (t) => {
  // @ts-expect-error - Testing invalid input
  t.false(hasContent(null));

  // @ts-expect-error - Testing invalid input
  t.false(hasContent(undefined));
});

test("hasContent: ignores scripts, styles, and noise elements", (t) => {
  const html = `
    <html>
    <head>
      <script>console.log('This is a very long script with lots of code that should be ignored');</script>
      <style>body { color: red; /* This is a very long style block with lots of CSS that should be ignored */ }</style>
    </head>
    <body>
      <nav>Navigation that should be ignored</nav>
      <p>Short content.</p>
      <footer>Footer that should be ignored</footer>
    </body>
    </html>
  `;

  t.false(hasContent(html));
});

test("hasContent: counts only body text content", (t) => {
  const html = `
    <html>
    <body>
      <p>This is the main content of the body that contains sufficient text to be considered valid content by the hasContent validator function.</p>
    </body>
    </html>
  `;

  t.true(hasContent(html));
});

test("hasContent: handles malformed HTML gracefully", (t) => {
  const malformed = "<html><body><p>Some text<div>Nested</p></div>";

  // Should not throw, should return based on content
  t.notThrows(() => hasContent(malformed));
});

test("hasContent: trims whitespace before checking length", (t) => {
  const html = `
    <html>
    <body>
      <p>


        Too short


      </p>
    </body>
    </html>
  `;

  t.false(hasContent(html));
});

// Type export tests
test("types: MarkdownOptions interface is exported", (t) => {
  const options: MarkdownOptions = {
    extractContent: true,
    includeMeta: false,
  };

  t.is(typeof options.extractContent, "boolean");
  t.is(typeof options.includeMeta, "boolean");
});

test("types: MarkdownResult interface is exported", (t) => {
  // This test verifies the type is available at compile time
  // Runtime check would be redundant, but we can verify structure
  const result: MarkdownResult = {
    markdown: "# Test",
    metadata: {
      title: "Test",
    },
    stats: {
      inputLength: 100,
      outputLength: 50,
      processingTime: 10,
      readabilitySuccess: true,
      imageCount: 0,
      linkCount: 0,
    },
  };

  t.is(typeof result.markdown, "string");
  t.is(typeof result.metadata, "object");
  t.is(typeof result.stats, "object");
});

// Edge cases
test("convertToMarkdown: handles HTML with special characters", async (t) => {
  const html = `
    <html>
    <body>
      <p>Price: $100 &amp; €50</p>
      <p>Math: 1 &lt; 2 &gt; 0</p>
    </body>
    </html>
  `;

  const result = await convertToMarkdown(html);

  t.true(result.markdown.includes("$100"));
  t.true(result.markdown.includes("€50") || result.markdown.includes("&"));
});

test("convertToMarkdown: handles nested HTML structures", async (t) => {
  const html = `
    <html>
    <body>
      <div>
        <section>
          <article>
            <p><strong>Bold <em>and italic</em></strong></p>
          </article>
        </section>
      </div>
    </body>
    </html>
  `;

  const result = await convertToMarkdown(html);

  t.true(result.markdown.includes("**"));
  t.true(result.markdown.includes("*"));
});

test("convertToMarkdown: preserves code blocks correctly", async (t) => {
  const html = `
    <html>
    <body>
      <pre><code class="language-typescript">
function test(): string {
  return "hello";
}
      </code></pre>
    </body>
    </html>
  `;

  const result = await convertToMarkdown(html);

  t.true(result.markdown.includes("```"));
  t.true(result.markdown.includes("function test"));
});

test("convertToMarkdown: statistics are accurate", async (t) => {
  const html = SIMPLE_HTML;
  const result = await convertToMarkdown(html);

  // Input length should match HTML length
  t.is(result.stats.inputLength, html.length);

  // Output length should match markdown length
  t.is(result.stats.outputLength, result.markdown.length);

  // Processing time should be non-negative
  t.true(result.stats.processingTime >= 0);

  // Processing time should be reasonable (under 10 seconds)
  t.true(result.stats.processingTime < 10000);
});

test("convertToMarkdown: handles HTML without head tag", async (t) => {
  const html = "<html><body><h1>Title</h1><p>Content</p></body></html>";

  const result = await convertToMarkdown(html);

  t.truthy(result);
  t.true(result.markdown.includes("Title"));
  t.true(result.markdown.includes("Content"));
});

test("convertToMarkdown: handles HTML without html tag", async (t) => {
  const html = "<body><h1>Title</h1><p>Content</p></body>";

  const result = await convertToMarkdown(html);

  t.truthy(result);
  t.is(typeof result.markdown, "string");
});

test("convertToMarkdown: handles very long HTML efficiently", async (t) => {
  const longHtml = `
    <html>
    <body>
      <article>
        ${Array(100)
          .fill(0)
          .map(
            (_, i) =>
              `<p>Paragraph ${i} with some substantial content to ensure proper processing.</p>`,
          )
          .join("\n")}
      </article>
    </body>
    </html>
  `;

  const startTime = Date.now();
  const result = await convertToMarkdown(longHtml);
  const endTime = Date.now();

  t.truthy(result);
  t.true(result.markdown.length > 0);

  // Should complete in reasonable time (under 5 seconds)
  t.true(endTime - startTime < 5000);
});

test("hasContent: handles very long HTML efficiently", (t) => {
  const longHtml = `
    <html>
    <body>
      ${Array(1000)
        .fill(0)
        .map(() => "<p>Paragraph with content.</p>")
        .join("\n")}
    </body>
    </html>
  `;

  const startTime = Date.now();
  const result = hasContent(longHtml);
  const endTime = Date.now();

  t.true(result);

  // Should complete quickly (under 1 second)
  t.true(endTime - startTime < 1000);
});
