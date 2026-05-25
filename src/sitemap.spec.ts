// src/sitemap.spec.ts

import test from "ava";
import { parseSitemap, parseSitemapXml } from "./sitemap.js";

const originalFetch = global.fetch;
test.afterEach(() => {
  global.fetch = originalFetch;
});

const FLAT_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/a</loc></url>
  <url><loc>https://example.com/b</loc></url>
  <url><loc>https://example.com/blog/post-1</loc></url>
</urlset>`;

const SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-a.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-b.xml</loc></sitemap>
</sitemapindex>`;

test("parseSitemapXml: detects flat urlset", (t) => {
  const parsed = parseSitemapXml(FLAT_SITEMAP);
  t.is(parsed.type, "urlset");
  t.deepEqual(parsed.entries, [
    "https://example.com/a",
    "https://example.com/b",
    "https://example.com/blog/post-1",
  ]);
});

test("parseSitemapXml: detects sitemap index", (t) => {
  const parsed = parseSitemapXml(SITEMAP_INDEX);
  t.is(parsed.type, "index");
  t.deepEqual(parsed.entries, [
    "https://example.com/sitemap-a.xml",
    "https://example.com/sitemap-b.xml",
  ]);
});

test("parseSitemapXml: returns empty urlset for malformed XML", (t) => {
  const parsed = parseSitemapXml("<not><a-sitemap/></not>");
  t.is(parsed.type, "urlset");
  t.deepEqual(parsed.entries, []);
});

test("parseSitemap: returns flat URL list from raw XML input", async (t) => {
  const urls = await parseSitemap(FLAT_SITEMAP);
  t.is(urls.length, 3);
  t.true(urls.includes("https://example.com/blog/post-1"));
});

test("parseSitemap: recursively follows sitemap index", async (t) => {
  // Mock fetch so the nested sitemap URLs resolve to flat sitemaps.
  global.fetch = (async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url.toString();
    if (href.endsWith("sitemap-a.xml")) {
      return new Response(
        `<?xml version="1.0"?><urlset><url><loc>https://example.com/a1</loc></url><url><loc>https://example.com/a2</loc></url></urlset>`,
        { status: 200, headers: { "content-type": "application/xml" } },
      );
    }
    if (href.endsWith("sitemap-b.xml")) {
      return new Response(
        `<?xml version="1.0"?><urlset><url><loc>https://example.com/b1</loc></url></urlset>`,
        { status: 200, headers: { "content-type": "application/xml" } },
      );
    }
    return new Response("not found", { status: 404, statusText: "Not Found" });
  }) as typeof fetch;

  const urls = await parseSitemap(SITEMAP_INDEX);
  t.deepEqual(urls.sort(), [
    "https://example.com/a1",
    "https://example.com/a2",
    "https://example.com/b1",
  ]);
});

test("parseSitemap: respects maxDepth (does not recurse past it)", async (t) => {
  // Depth 0: an index; depth 1: another index. With maxDepth=0 we should
  // never fetch anything.
  let fetched = 0;
  global.fetch = (async () => {
    fetched++;
    return new Response("<urlset></urlset>", {
      status: 200,
      headers: { "content-type": "application/xml" },
    });
  }) as typeof fetch;

  await parseSitemap(SITEMAP_INDEX, { maxDepth: 0 });
  t.is(fetched, 0, "no nested fetches should fire at depth 0");
});

test("parseSitemap: respects maxUrls cap", async (t) => {
  const bigSitemap = `<urlset>${Array.from(
    { length: 50 },
    (_, i) => `<url><loc>https://example.com/p${i}</loc></url>`,
  ).join("")}</urlset>`;
  const urls = await parseSitemap(bigSitemap, { maxUrls: 10 });
  t.is(urls.length, 10);
});

test("parseSitemap: include filter keeps only matching URLs", async (t) => {
  const urls = await parseSitemap(FLAT_SITEMAP, {
    include: ["**/blog/**"],
  });
  t.deepEqual(urls, ["https://example.com/blog/post-1"]);
});

test("parseSitemap: exclude filter drops matching URLs", async (t) => {
  const urls = await parseSitemap(FLAT_SITEMAP, {
    exclude: ["**/blog/**"],
  });
  t.deepEqual(urls, ["https://example.com/a", "https://example.com/b"]);
});

test("parseSitemap: include + exclude compose (exclude wins)", async (t) => {
  const xml = `<urlset>
    <url><loc>https://example.com/blog/post-1</loc></url>
    <url><loc>https://example.com/blog/draft-1</loc></url>
  </urlset>`;
  const urls = await parseSitemap(xml, {
    include: ["**/blog/**"],
    exclude: ["**draft**"],
  });
  t.deepEqual(urls, ["https://example.com/blog/post-1"]);
});

test("parseSitemap: skips nested sitemaps that fail to fetch but keeps going", async (t) => {
  global.fetch = (async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url.toString();
    if (href.endsWith("sitemap-a.xml")) {
      throw new Error("network down");
    }
    if (href.endsWith("sitemap-b.xml")) {
      return new Response(
        `<urlset><url><loc>https://example.com/survivor</loc></url></urlset>`,
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const urls = await parseSitemap(SITEMAP_INDEX);
  t.deepEqual(urls, ["https://example.com/survivor"]);
});
