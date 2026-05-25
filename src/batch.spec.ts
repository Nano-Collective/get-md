// src/batch.spec.ts

import test from "ava";
import { convertBatch, convertBatchAll } from "./batch.js";
import type { BatchResult } from "./types.js";

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

/**
 * Mock a successful HTML response so we exercise the batch orchestration
 * without depending on the network.
 */
function mockHtmlForUrl(latencyMs = 5): typeof fetch {
  return (async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url.toString();
    await new Promise((r) => setTimeout(r, latencyMs));
    const html = `<!doctype html><html><body><h1>${href}</h1><p>Content here, long enough to extract.</p></body></html>`;
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as typeof fetch;
}

test("convertBatchAll: returns one result per URL", async (t) => {
  global.fetch = mockHtmlForUrl();
  const urls = [
    "https://a.test/one",
    "https://b.test/two",
    "https://c.test/three",
  ];
  const results = await convertBatchAll(urls, { extractContent: false });
  t.is(results.length, 3);
  t.true(results.every((r) => r.status === "ok"));
});

test("convertBatchAll: records errors as results when continueOnError", async (t) => {
  // First URL fails (404), others succeed.
  global.fetch = (async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url.toString();
    if (href.includes("fails")) {
      return new Response("nope", { status: 404, statusText: "Not Found" });
    }
    return new Response(
      "<!doctype html><html><body><h1>ok</h1><p>content content content content content content content content content content</p></body></html>",
      { status: 200, headers: { "content-type": "text/html" } },
    );
  }) as typeof fetch;

  const results = await convertBatchAll(
    ["https://a.test/ok", "https://b.test/fails", "https://c.test/ok"],
    { extractContent: false },
  );

  t.is(results.length, 3);
  const failed = results.find((r) => r.status === "error");
  t.truthy(failed);
  if (failed?.status === "error") {
    t.true(/HTTP 404|Failed/.test(failed.error.message));
  }
});

test("convertBatchAll: stops on first error when continueOnError=false", async (t) => {
  global.fetch = (async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url.toString();
    if (href.includes("fails")) {
      return new Response("nope", { status: 500, statusText: "ISE" });
    }
    return new Response(
      "<!doctype html><html><body><h1>ok</h1><p>content content content content content content content content content content</p></body></html>",
      { status: 200, headers: { "content-type": "text/html" } },
    );
  }) as typeof fetch;

  await t.throwsAsync(
    convertBatchAll(
      ["https://a.test/fails", "https://b.test/ok"],
      { extractContent: false, continueOnError: false },
    ),
  );
});

test("convertBatch: respects concurrency cap", async (t) => {
  // Track in-flight count by intercepting fetch.
  let inFlight = 0;
  let peak = 0;
  global.fetch = (async (url: string | URL | Request) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 30));
    inFlight--;
    const href = typeof url === "string" ? url : url.toString();
    return new Response(
      `<!doctype html><html><body><h1>${href}</h1><p>content content content content content content content content content content</p></body></html>`,
      { status: 200, headers: { "content-type": "text/html" } },
    );
  }) as typeof fetch;

  const urls = Array.from(
    { length: 10 },
    (_, i) => `https://example.test/p${i}`,
  );
  await convertBatchAll(urls, { extractContent: false, concurrency: 3 });

  t.true(peak <= 3, `peak in-flight was ${peak}, expected <= 3`);
});

test("convertBatch: fires onProgress per completion", async (t) => {
  global.fetch = mockHtmlForUrl();
  const progress: { completed: number; total: number; status: string }[] = [];
  await convertBatchAll(
    ["https://a.test/x", "https://b.test/y"],
    {
      extractContent: false,
      concurrency: 2,
      onProgress: (p) => {
        progress.push({
          completed: p.completed,
          total: p.total,
          status: p.status,
        });
      },
    },
  );
  t.is(progress.length, 2);
  t.is(progress[1].completed, 2);
  t.is(progress[1].total, 2);
});

test("convertBatch: empty input yields nothing", async (t) => {
  const results: BatchResult[] = [];
  for await (const r of convertBatch([])) {
    results.push(r);
  }
  t.is(results.length, 0);
});

test("convertBatch: yields results in completion order, not input order", async (t) => {
  // Slow first URL, fast subsequent — fast ones should arrive first.
  global.fetch = (async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url.toString();
    const delay = href.includes("slow") ? 80 : 5;
    await new Promise((r) => setTimeout(r, delay));
    return new Response(
      `<!doctype html><html><body><h1>${href}</h1><p>content content content content content content content content content content</p></body></html>`,
      { status: 200, headers: { "content-type": "text/html" } },
    );
  }) as typeof fetch;

  const order: string[] = [];
  for await (const r of convertBatch(
    ["https://a.test/slow", "https://b.test/fast", "https://c.test/fast"],
    { extractContent: false, concurrency: 3 },
  )) {
    order.push(r.url);
  }
  // Slow one should not be first.
  t.not(order[0], "https://a.test/slow");
});
