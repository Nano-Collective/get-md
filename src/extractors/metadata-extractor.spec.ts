// src/extractors/metadata-extractor.spec.ts

import test from "ava";
import { extractMetadata } from "./metadata-extractor.js";

test("extracts title from Open Graph meta tag", (t) => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="OG Title" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.title, "OG Title");
});

test("extracts title from Twitter meta tag", (t) => {
  const html = `
    <html>
      <head>
        <meta name="twitter:title" content="Twitter Title" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.title, "Twitter Title");
});

test("extracts title from title tag", (t) => {
  const html = `
    <html>
      <head>
        <title>Page Title</title>
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.title, "Page Title");
});

test("extracts title from h1 tag as fallback", (t) => {
  const html = `
    <html>
      <body>
        <h1>Main Heading</h1>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.title, "Main Heading");
});

test("prioritizes Open Graph title over other sources", (t) => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="OG Title" />
        <meta name="twitter:title" content="Twitter Title" />
        <title>Page Title</title>
      </head>
      <body>
        <h1>H1 Title</h1>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.title, "OG Title");
});

test("returns undefined for title when none found", (t) => {
  const html = "<html><body><p>No title</p></body></html>";
  const metadata = extractMetadata(html);
  t.is(metadata.title, undefined);
});

test("extracts author from meta tag", (t) => {
  const html = `
    <html>
      <head>
        <meta name="author" content="John Doe" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.author, "John Doe");
});

test("extracts author from article:author meta tag", (t) => {
  const html = `
    <html>
      <head>
        <meta property="article:author" content="Jane Smith" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.author, "Jane Smith");
});

test("extracts author from rel=author link", (t) => {
  const html = `
    <html>
      <body>
        <a rel="author" href="/author">Bob Johnson</a>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.author, "Bob Johnson");
});

test("extracts author from common class names", (t) => {
  const html = `
    <html>
      <body>
        <div class="author">Alice Williams</div>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.author, "Alice Williams");
});

test("extracts author from byline class", (t) => {
  const html = `
    <html>
      <body>
        <div class="byline">By Tom Brown</div>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.author, "By Tom Brown");
});

test("returns undefined for author when none found", (t) => {
  const html = "<html><body><p>No author</p></body></html>";
  const metadata = extractMetadata(html);
  t.is(metadata.author, undefined);
});

test("extracts excerpt from Open Graph description", (t) => {
  const html = `
    <html>
      <head>
        <meta property="og:description" content="OG description text" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.excerpt, "OG description text");
});

test("extracts excerpt from meta description", (t) => {
  const html = `
    <html>
      <head>
        <meta name="description" content="Meta description text" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.excerpt, "Meta description text");
});

test("extracts excerpt from Twitter description", (t) => {
  const html = `
    <html>
      <head>
        <meta name="twitter:description" content="Twitter description" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.excerpt, "Twitter description");
});

test("prioritizes Open Graph description over others", (t) => {
  const html = `
    <html>
      <head>
        <meta property="og:description" content="OG description" />
        <meta name="description" content="Meta description" />
        <meta name="twitter:description" content="Twitter description" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.excerpt, "OG description");
});

test("returns undefined for excerpt when none found", (t) => {
  const html = "<html><body><p>No description</p></body></html>";
  const metadata = extractMetadata(html);
  t.is(metadata.excerpt, undefined);
});

test("extracts site name from Open Graph", (t) => {
  const html = `
    <html>
      <head>
        <meta property="og:site_name" content="Example Site" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.siteName, "Example Site");
});

test("extracts site name from application-name meta tag", (t) => {
  const html = `
    <html>
      <head>
        <meta name="application-name" content="My App" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.siteName, "My App");
});

test("prioritizes Open Graph site name over application-name", (t) => {
  const html = `
    <html>
      <head>
        <meta property="og:site_name" content="OG Site" />
        <meta name="application-name" content="App Name" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.siteName, "OG Site");
});

test("returns undefined for site name when none found", (t) => {
  const html = "<html><body><p>No site name</p></body></html>";
  const metadata = extractMetadata(html);
  t.is(metadata.siteName, undefined);
});

test("extracts published time from article meta tag", (t) => {
  const html = `
    <html>
      <head>
        <meta property="article:published_time" content="2025-01-15T10:30:00Z" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.publishedTime, "2025-01-15T10:30:00Z");
});

test("extracts published time from time element", (t) => {
  const html = `
    <html>
      <body>
        <time datetime="2025-01-15T10:30:00Z">January 15, 2025</time>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.publishedTime, "2025-01-15T10:30:00Z");
});

test("extracts published time from itemprop datePublished", (t) => {
  const html = `
    <html>
      <body>
        <meta itemprop="datePublished" content="2025-01-15T10:30:00Z" />
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.publishedTime, "2025-01-15T10:30:00Z");
});

test("prioritizes article:published_time over other sources", (t) => {
  const html = `
    <html>
      <head>
        <meta property="article:published_time" content="2025-01-15T10:30:00Z" />
      </head>
      <body>
        <time datetime="2025-01-14T10:30:00Z">January 14, 2025</time>
        <meta itemprop="datePublished" content="2025-01-13T10:30:00Z" />
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.publishedTime, "2025-01-15T10:30:00Z");
});

test("returns undefined for published time when none found", (t) => {
  const html = "<html><body><p>No date</p></body></html>";
  const metadata = extractMetadata(html);
  t.is(metadata.publishedTime, undefined);
});

test("extracts language from html lang attribute", (t) => {
  const html = '<html lang="en-US"><body></body></html>';
  const metadata = extractMetadata(html);
  t.is(metadata.language, "en-US");
});

test("extracts language from meta content-language", (t) => {
  const html = `
    <html>
      <head>
        <meta http-equiv="content-language" content="fr-FR" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.language, "fr-FR");
});

test("prioritizes html lang over meta content-language", (t) => {
  const html = `
    <html lang="en-US">
      <head>
        <meta http-equiv="content-language" content="fr-FR" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.language, "en-US");
});

test("returns undefined for language when none found", (t) => {
  const html = "<html><body><p>No language</p></body></html>";
  const metadata = extractMetadata(html);
  t.is(metadata.language, undefined);
});

test("extracts canonical URL from link rel=canonical", (t) => {
  const html = `
    <html>
      <head>
        <link rel="canonical" href="https://example.com/page" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.canonicalUrl, "https://example.com/page");
});

test("extracts canonical URL from Open Graph URL", (t) => {
  const html = `
    <html>
      <head>
        <meta property="og:url" content="https://example.com/og-page" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.canonicalUrl, "https://example.com/og-page");
});

test("prioritizes link rel=canonical over Open Graph URL", (t) => {
  const html = `
    <html>
      <head>
        <link rel="canonical" href="https://example.com/canonical" />
        <meta property="og:url" content="https://example.com/og" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.canonicalUrl, "https://example.com/canonical");
});

test("resolves relative canonical URL with baseUrl", (t) => {
  const html = `
    <html>
      <head>
        <link rel="canonical" href="/page" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html, "https://example.com");
  t.is(metadata.canonicalUrl, "https://example.com/page");
});

test("does not resolve absolute canonical URL", (t) => {
  const html = `
    <html>
      <head>
        <link rel="canonical" href="https://other.com/page" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html, "https://example.com");
  t.is(metadata.canonicalUrl, "https://other.com/page");
});

test("uses baseUrl as fallback for canonical URL", (t) => {
  const html = "<html><body><p>No canonical</p></body></html>";
  const metadata = extractMetadata(html, "https://example.com");
  t.is(metadata.canonicalUrl, "https://example.com");
});

test("returns undefined for canonical URL when none found and no baseUrl", (t) => {
  const html = "<html><body><p>No canonical</p></body></html>";
  const metadata = extractMetadata(html);
  t.is(metadata.canonicalUrl, undefined);
});

test("handles invalid relative URL gracefully", (t) => {
  const html = `
    <html>
      <head>
        <link rel="canonical" href="::invalid::" />
      </head>
    </html>
  `;
  t.notThrows(() => {
    const metadata = extractMetadata(html, "https://example.com");
    // The URL constructor will attempt to resolve it, even if invalid
    // The important thing is it doesn't throw
    t.truthy(metadata.canonicalUrl);
  });
});

test("extracts all metadata fields together", (t) => {
  const html = `
    <html lang="en">
      <head>
        <meta property="og:title" content="Test Article" />
        <meta property="og:description" content="Test description" />
        <meta property="og:site_name" content="Test Site" />
        <meta property="article:published_time" content="2025-01-15T10:30:00Z" />
        <meta property="article:author" content="Test Author" />
        <link rel="canonical" href="https://example.com/article" />
      </head>
    </html>
  `;
  const metadata = extractMetadata(html, "https://example.com");

  t.is(metadata.title, "Test Article");
  t.is(metadata.author, "Test Author");
  t.is(metadata.excerpt, "Test description");
  t.is(metadata.siteName, "Test Site");
  t.is(metadata.publishedTime, "2025-01-15T10:30:00Z");
  t.is(metadata.language, "en");
  t.is(metadata.canonicalUrl, "https://example.com/article");
});

test("handles empty HTML", (t) => {
  const metadata = extractMetadata("");
  t.is(metadata.title, undefined);
  t.is(metadata.author, undefined);
  t.is(metadata.excerpt, undefined);
  t.is(metadata.siteName, undefined);
  t.is(metadata.publishedTime, undefined);
  t.is(metadata.language, undefined);
  t.is(metadata.canonicalUrl, undefined);
});

test("trims whitespace from title", (t) => {
  const html = `
    <html>
      <head>
        <title>  Spaced Title  </title>
      </head>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.title, "Spaced Title");
});

test("trims whitespace from h1 title", (t) => {
  const html = `
    <html>
      <body>
        <h1>  Spaced H1  </h1>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.title, "Spaced H1");
});

test("extracts author from author-name class", (t) => {
  const html = `
    <html>
      <body>
        <div class="author-name">Full Name</div>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.author, "Full Name");
});

test("uses first h1 when multiple exist", (t) => {
  const html = `
    <html>
      <body>
        <h1>First Title</h1>
        <h1>Second Title</h1>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.title, "First Title");
});

test("uses first time element when multiple exist", (t) => {
  const html = `
    <html>
      <body>
        <time datetime="2025-01-15T10:30:00Z">First</time>
        <time datetime="2025-01-16T10:30:00Z">Second</time>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.publishedTime, "2025-01-15T10:30:00Z");
});

test("uses first author-related element when multiple exist", (t) => {
  const html = `
    <html>
      <body>
        <div class="author">First Author</div>
        <div class="author">Second Author</div>
      </body>
    </html>
  `;
  const metadata = extractMetadata(html);
  t.is(metadata.author, "First Author");
});
