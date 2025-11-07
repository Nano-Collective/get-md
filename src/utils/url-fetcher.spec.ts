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

  // For non-Error exceptions, the promise will still reject
  // We just need to verify it throws something
  try {
    await fetchUrl("https://example.com");
    t.fail("Should have thrown an error");
  } catch (error) {
    t.is(error, "String error");
  }
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
