// src/utils/url-fetcher.spec.ts

import test from "ava";
import { fetchUrl, isValidUrl } from "./url-fetcher.js";

// Add cleanup hook to force exit after tests complete
test.after.always("cleanup", () => {
  // Give a brief moment for cleanup, then force exit
  setTimeout(() => {
    process.exit(0);
  }, 100);
});

// Mock fetch for testing
const createMockFetch = (response: Partial<Response>) => {
  return async () =>
    ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<html><body>Test</body></html>",
      ...response,
    }) as Response;
};

test("fetchUrl: successfully fetches HTML from a URL", async (t) => {
  const mockHtml = "<html><body>Test content</body></html>";
  global.fetch = createMockFetch({
    text: async () => mockHtml,
  });

  const result = await fetchUrl("https://example.com");
  t.is(result, mockHtml);
});

test("fetchUrl: uses custom user agent", async (t) => {
  const customUserAgent = "CustomBot/1.0";
  let capturedHeaders: HeadersInit | undefined;

  global.fetch = (async (_url, init) => {
    capturedHeaders = init?.headers as HeadersInit;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<html><body>Test</body></html>",
    } as Response;
  }) as typeof fetch;

  await fetchUrl("https://example.com", { userAgent: customUserAgent });

  t.truthy(capturedHeaders);
  if (
    capturedHeaders &&
    typeof capturedHeaders === "object" &&
    !Array.isArray(capturedHeaders)
  ) {
    t.is(
      (capturedHeaders as Record<string, string>)["User-Agent"],
      customUserAgent,
    );
  }
});

test("fetchUrl: handles followRedirects option set to false", async (t) => {
  let capturedRedirect: RequestRedirect | undefined;

  global.fetch = (async (_url, init) => {
    capturedRedirect = init?.redirect;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<html><body>Test</body></html>",
    } as Response;
  }) as typeof fetch;

  await fetchUrl("https://example.com", { followRedirects: false });

  t.is(capturedRedirect, "manual");
});

test("fetchUrl: handles followRedirects option set to true", async (t) => {
  let capturedRedirect: RequestRedirect | undefined;

  global.fetch = (async (_url, init) => {
    capturedRedirect = init?.redirect;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<html><body>Test</body></html>",
    } as Response;
  }) as typeof fetch;

  await fetchUrl("https://example.com", { followRedirects: true });

  t.is(capturedRedirect, "follow");
});

test("fetchUrl: merges custom headers", async (t) => {
  const customHeaders = { Authorization: "Bearer token123" };
  let capturedHeaders: HeadersInit | undefined;

  global.fetch = (async (_url, init) => {
    capturedHeaders = init?.headers as HeadersInit;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<html><body>Test</body></html>",
    } as Response;
  }) as typeof fetch;

  await fetchUrl("https://example.com", { headers: customHeaders });

  t.truthy(capturedHeaders);
  if (
    capturedHeaders &&
    typeof capturedHeaders === "object" &&
    !Array.isArray(capturedHeaders)
  ) {
    const headers = capturedHeaders as Record<string, string>;
    t.is(headers.Authorization, "Bearer token123");
    t.truthy(headers["User-Agent"]);
  }
});

test("fetchUrl: throws error on HTTP 404 status", async (t) => {
  global.fetch = createMockFetch({
    ok: false,
    status: 404,
    statusText: "Not Found",
  });

  const error = await t.throwsAsync(fetchUrl("https://example.com"));
  t.regex(error?.message ?? "", /HTTP 404: Not Found/);
});

test("fetchUrl: throws error on HTTP 500 status", async (t) => {
  global.fetch = createMockFetch({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
  });

  const error = await t.throwsAsync(fetchUrl("https://example.com"));
  t.regex(error?.message ?? "", /HTTP 500: Internal Server Error/);
});

test("fetchUrl: handles network errors", async (t) => {
  global.fetch = (async () => {
    throw new Error("Network connection failed");
  }) as typeof fetch;

  const error = await t.throwsAsync(fetchUrl("https://example.com"));
  t.regex(
    error?.message ?? "",
    /Failed to fetch URL: Network connection failed/,
  );
});

test("fetchUrl: handles timeout errors", async (t) => {
  global.fetch = (async () => {
    const error = new Error("Aborted");
    error.name = "AbortError";
    throw error;
  }) as typeof fetch;

  const error = await t.throwsAsync(
    fetchUrl("https://example.com", { timeout: 50 }),
  );
  t.regex(error?.message ?? "", /Request timeout after 50ms/);
});

test("fetchUrl: handles non-Error exceptions", async (t) => {
  global.fetch = (async () => {
    // eslint-disable-next-line no-throw-literal
    throw "String error";
  }) as typeof fetch;

  // Non-Error throws are wrapped in a "Failed to fetch URL: ..." message so
  // callers always see a real Error with a useful .message. The original
  // payload is preserved in the message.
  await t.throwsAsync(
    () => fetchUrl("https://example.com", { retries: 0 }),
    { message: /Failed to fetch URL: String error/ },
  );
});

test("isValidUrl: returns true for valid HTTP URLs", (t) => {
  t.true(isValidUrl("http://example.com"));
  t.true(isValidUrl("http://example.com/path"));
  t.true(isValidUrl("http://example.com:8080"));
  t.true(isValidUrl("http://subdomain.example.com"));
});

test("isValidUrl: returns true for valid HTTPS URLs", (t) => {
  t.true(isValidUrl("https://example.com"));
  t.true(isValidUrl("https://example.com/path/to/page"));
  t.true(isValidUrl("https://subdomain.example.com"));
  t.true(isValidUrl("https://example.com:443"));
});

test("isValidUrl: returns false for invalid protocols", (t) => {
  t.false(isValidUrl("ftp://example.com"));
  t.false(isValidUrl("file:///path/to/file"));
  t.false(isValidUrl("javascript:alert(1)"));
  t.false(isValidUrl("data:text/html,<h1>Test</h1>"));
});

test("isValidUrl: returns false for malformed URLs", (t) => {
  t.false(isValidUrl("not-a-url"));
  t.false(isValidUrl(""));
  t.false(isValidUrl("htp://missing-t"));
  t.false(isValidUrl("://no-protocol"));
});

test("isValidUrl: returns false for relative URLs", (t) => {
  t.false(isValidUrl("/relative/path"));
  t.false(isValidUrl("../relative/path"));
  t.false(isValidUrl("./relative/path"));
  t.false(isValidUrl("relative/path"));
});

test("isValidUrl: handles URLs with query parameters", (t) => {
  t.true(isValidUrl("https://example.com?param=value"));
  t.true(isValidUrl("https://example.com?param1=value1&param2=value2"));
  t.true(isValidUrl("http://example.com/page?search=test&sort=asc"));
});

test("isValidUrl: handles URLs with fragments", (t) => {
  t.true(isValidUrl("https://example.com#section"));
  t.true(isValidUrl("https://example.com/page#anchor"));
  t.true(isValidUrl("http://example.com/docs#intro"));
});

test("isValidUrl: handles URLs with authentication", (t) => {
  t.true(isValidUrl("https://user:pass@example.com"));
  t.true(isValidUrl("http://admin:secret@example.com:8080"));
});

test("isValidUrl: handles complex valid URLs", (t) => {
  t.true(
    isValidUrl(
      "https://user:pass@subdomain.example.com:8080/path/to/resource?query=value#fragment",
    ),
  );
  t.true(isValidUrl("http://localhost:3000/api/users?filter=active"));
});

test("isValidUrl: rejects localhost without protocol", (t) => {
  t.false(isValidUrl("localhost:3000"));
  t.false(isValidUrl("127.0.0.1:8080"));
});

test("isValidUrl: handles IP addresses with protocol", (t) => {
  t.true(isValidUrl("http://127.0.0.1"));
  t.true(isValidUrl("https://192.168.1.1:8080"));
  t.true(isValidUrl("http://[::1]"));
  t.true(isValidUrl("http://[2001:db8::1]"));
});

// ============================================================================
// Retry tests
// ============================================================================

test("fetchUrl: retries on HTTP 503 and succeeds", async (t) => {
  let attempts = 0;
  global.fetch = (async () => {
    attempts++;
    if (attempts < 3) {
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "",
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<html><body>finally</body></html>",
    } as Response;
  }) as typeof fetch;

  const result = await fetchUrl("https://example.com", {
    retries: 3,
    retryDelay: 1, // keep tests fast
  });
  t.is(result, "<html><body>finally</body></html>");
  t.is(attempts, 3);
});

test("fetchUrl: retries on HTTP 429", async (t) => {
  let attempts = 0;
  global.fetch = (async () => {
    attempts++;
    if (attempts === 1) {
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "",
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<html>ok</html>",
    } as Response;
  }) as typeof fetch;

  const result = await fetchUrl("https://example.com", {
    retries: 2,
    retryDelay: 1,
  });
  t.is(result, "<html>ok</html>");
  t.is(attempts, 2);
});

test("fetchUrl: retries on network error", async (t) => {
  let attempts = 0;
  global.fetch = (async () => {
    attempts++;
    if (attempts === 1) throw new Error("ECONNRESET");
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<html>recovered</html>",
    } as Response;
  }) as typeof fetch;

  const result = await fetchUrl("https://example.com", {
    retries: 2,
    retryDelay: 1,
  });
  t.is(result, "<html>recovered</html>");
  t.is(attempts, 2);
});

test("fetchUrl: does NOT retry on HTTP 404", async (t) => {
  let attempts = 0;
  global.fetch = (async () => {
    attempts++;
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    } as Response;
  }) as typeof fetch;

  await t.throwsAsync(
    () => fetchUrl("https://example.com", { retries: 3, retryDelay: 1 }),
    { message: /HTTP 404/ },
  );
  t.is(attempts, 1, "404 is non-retryable; one attempt only");
});

test("fetchUrl: gives up after maxAttempts and surfaces the last error", async (t) => {
  let attempts = 0;
  global.fetch = (async () => {
    attempts++;
    return {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "",
    } as Response;
  }) as typeof fetch;

  await t.throwsAsync(
    () => fetchUrl("https://example.com", { retries: 2, retryDelay: 1 }),
    { message: /HTTP 503/ },
  );
  t.is(attempts, 3, "1 initial attempt + 2 retries");
});

test("fetchUrl: respects Retry-After header on 429", async (t) => {
  const start = Date.now();
  let attempts = 0;
  global.fetch = (async () => {
    attempts++;
    if (attempts === 1) {
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "",
        headers: new Headers({ "retry-after": "1" }), // 1 second
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<html>ok</html>",
    } as Response;
  }) as typeof fetch;

  await fetchUrl("https://example.com", { retries: 2, retryDelay: 1 });
  const elapsed = Date.now() - start;
  t.true(elapsed >= 900, `expected ~1s delay, got ${elapsed}ms`);
});

test("fetchUrl: retries=0 disables retry", async (t) => {
  let attempts = 0;
  global.fetch = (async () => {
    attempts++;
    return {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "",
    } as Response;
  }) as typeof fetch;

  await t.throwsAsync(
    () => fetchUrl("https://example.com", { retries: 0 }),
    { message: /HTTP 503/ },
  );
  t.is(attempts, 1);
});

// ============================================================================
// Cache tests
// ============================================================================

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "get-md-cache-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("fetchUrl: cache miss falls through to network and writes the entry", async (t) => {
  await withTempDir(async (cacheDir) => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "<html>fresh</html>",
      } as Response;
    }) as typeof fetch;

    const result = await fetchUrl("https://example.com/x", { cache: cacheDir });
    t.is(result, "<html>fresh</html>");
    t.is(calls, 1);

    // Cache file should exist now.
    const files = await readdir(cacheDir);
    t.is(files.length, 1);
    t.true(files[0].endsWith(".json"));
  });
});

test("fetchUrl: cache hit avoids the network", async (t) => {
  await withTempDir(async (cacheDir) => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => `<html>call-${calls}</html>`,
      } as Response;
    }) as typeof fetch;

    // First call populates the cache.
    const first = await fetchUrl("https://example.com/x", { cache: cacheDir });
    // Second call should hit the cache and NOT call fetch again.
    const second = await fetchUrl("https://example.com/x", { cache: cacheDir });

    t.is(first, "<html>call-1</html>");
    t.is(second, "<html>call-1</html>"); // same body — not call-2
    t.is(calls, 1, "fetch was called once; cache served the second request");
  });
});

test("fetchUrl: cache TTL expiry forces re-fetch", async (t) => {
  await withTempDir(async (cacheDir) => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => `<html>call-${calls}</html>`,
      } as Response;
    }) as typeof fetch;

    await fetchUrl("https://example.com/x", { cache: cacheDir });
    // Wait past a 50ms TTL.
    await new Promise((r) => setTimeout(r, 80));
    await fetchUrl("https://example.com/x", {
      cache: cacheDir,
      cacheMaxAge: 50,
    });

    t.is(calls, 2, "expired cache should re-fetch");
  });
});

test("fetchUrl: different URLs get independent cache entries", async (t) => {
  await withTempDir(async (cacheDir) => {
    global.fetch = (async (url: string | URL | Request) => {
      const href = typeof url === "string" ? url : url.toString();
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => `<html>${href}</html>`,
      } as Response;
    }) as typeof fetch;

    await fetchUrl("https://example.com/a", { cache: cacheDir });
    await fetchUrl("https://example.com/b", { cache: cacheDir });

    const files = await readdir(cacheDir);
    t.is(files.length, 2);
  });
});
