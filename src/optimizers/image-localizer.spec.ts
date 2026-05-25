// src/optimizers/image-localizer.spec.ts

import test from "ava";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localizeImages } from "./image-localizer.js";

const originalFetch = global.fetch;
test.afterEach(() => {
  global.fetch = originalFetch;
});

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "get-md-img-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function imageResponse(
  body: Buffer,
  contentType = "image/png",
): Response {
  // Cast through unknown — Buffer is a valid Response body at runtime
  // (it's a Uint8Array) but the TS `BodyInit` union is editor-environment
  // dependent (needs lib.dom), so we widen to avoid a spurious diagnostic.
  // biome-ignore lint/suspicious/noExplicitAny: see comment above
  return new Response(body as unknown as any, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

test("localizeImages: returns input unchanged when no images present", async (t) => {
  await withTempDir(async (dir) => {
    const md = "# Title\n\nNo images here.";
    const result = await localizeImages(md, { outDir: dir });
    t.is(result.markdown, md);
    t.is(result.downloaded, 0);
    t.is(result.failed, 0);
  });
});

test("localizeImages: downloads images and rewrites src to local path", async (t) => {
  await withTempDir(async (dir) => {
    global.fetch = (async () =>
      imageResponse(Buffer.from([1, 2, 3]))) as typeof fetch;

    const md = "# Doc\n\n![alt text](https://example.com/img.png)";
    const result = await localizeImages(md, { outDir: dir });

    t.is(result.downloaded, 1);
    t.is(result.failed, 0);
    t.regex(result.markdown, /!\[alt text\]\(\.\/[a-f0-9]+\.png\)/);

    const files = await readdir(dir);
    t.is(files.length, 1);
    t.true(files[0].endsWith(".png"));
  });
});

test("localizeImages: skips data: URLs", async (t) => {
  await withTempDir(async (dir) => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return imageResponse(Buffer.from([1, 2, 3]));
    }) as typeof fetch;

    const md =
      "![inline](data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==)";
    const result = await localizeImages(md, { outDir: dir });

    t.is(calls, 0, "data: URLs should not trigger a fetch");
    t.is(result.markdown, md, "data: URLs should be left untouched");
  });
});

test("localizeImages: deduplicates the same URL referenced twice", async (t) => {
  await withTempDir(async (dir) => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return imageResponse(Buffer.from([1, 2, 3]));
    }) as typeof fetch;

    const md = `![a](https://example.com/x.png)\n\n![b](https://example.com/x.png)`;
    const result = await localizeImages(md, { outDir: dir });

    t.is(calls, 1, "same URL should download once");
    t.is(result.downloaded, 1);
    const files = await readdir(dir);
    t.is(files.length, 1);
  });
});

test("localizeImages: a failed image keeps its original URL and continues the batch", async (t) => {
  await withTempDir(async (dir) => {
    global.fetch = (async (url: string | URL | Request) => {
      const href = typeof url === "string" ? url : url.toString();
      if (href.includes("bad")) {
        return new Response("nope", { status: 404, statusText: "Not Found" });
      }
      return imageResponse(Buffer.from([9, 9, 9]));
    }) as typeof fetch;

    const md = `![ok](https://example.com/good.png)\n\n![bad](https://example.com/bad.png)`;
    const result = await localizeImages(md, { outDir: dir });

    t.is(result.downloaded, 1);
    t.is(result.failed, 1);
    t.true(result.markdown.includes("https://example.com/bad.png"));
    t.regex(result.markdown, /!\[ok\]\(\.\/[a-f0-9]+\.png\)/);
  });
});

test("localizeImages: picks extension from content-type", async (t) => {
  await withTempDir(async (dir) => {
    global.fetch = (async () =>
      imageResponse(Buffer.from([1]), "image/webp")) as typeof fetch;

    const md = `![x](https://example.com/no-extension)`;
    await localizeImages(md, { outDir: dir });
    const files = await readdir(dir);
    t.true(files[0].endsWith(".webp"));
  });
});

test("localizeImages: resolves relative refs using baseUrl", async (t) => {
  await withTempDir(async (dir) => {
    let fetchedUrl = "";
    global.fetch = (async (input: string | URL | Request) => {
      fetchedUrl = typeof input === "string" ? input : input.toString();
      return imageResponse(Buffer.from([1, 2, 3]), "image/svg+xml");
    }) as typeof fetch;

    const md = `![logo](/images/Vector.svg)`;
    const result = await localizeImages(md, {
      outDir: dir,
      baseUrl: "https://mindscape.io/some/page",
    });

    t.is(result.downloaded, 1);
    // Fetched against the baseUrl host
    t.is(fetchedUrl, "https://mindscape.io/images/Vector.svg");
    // Rewrite uses the ORIGINAL src as the key — finds `/images/Vector.svg`
    // in the markdown and swaps it for the local path.
    t.regex(result.markdown, /!\[logo\]\(\.\/[a-f0-9]+\.svg\)/);
  });
});

test("localizeImages: resolves protocol-relative URLs against baseUrl", async (t) => {
  await withTempDir(async (dir) => {
    let fetchedUrl = "";
    global.fetch = (async (input: string | URL | Request) => {
      fetchedUrl = typeof input === "string" ? input : input.toString();
      return imageResponse(Buffer.from([1]), "image/png");
    }) as typeof fetch;

    const md = `![pic](//cdn.example.com/img.png)`;
    const result = await localizeImages(md, {
      outDir: dir,
      baseUrl: "https://staging.example.com/page",
    });

    // URL constructor adopts the base's scheme for protocol-relative refs.
    t.is(fetchedUrl, "https://cdn.example.com/img.png");
    t.is(result.downloaded, 1);
  });
});

test("localizeImages: relative refs without baseUrl don't blow up but are skipped", async (t) => {
  await withTempDir(async (dir) => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return imageResponse(Buffer.from([1]));
    }) as typeof fetch;

    const md = `![a](//cdn.example.com/img.png)\n![b](/relative/path.png)\n![c](relative.png)`;
    const result = await localizeImages(md, { outDir: dir });

    t.is(calls, 0, "all three refs are relative; without baseUrl, none fetched");
    t.is(result.downloaded, 0);
    t.is(result.markdown, md);
  });
});

test("localizeImages: skips non-http(s) schemes", async (t) => {
  await withTempDir(async (dir) => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return imageResponse(Buffer.from([1]));
    }) as typeof fetch;

    const md = `
![j](javascript:alert(1))
![m](mailto:img@example.com)
![f](ftp://example.com/img.png)
![h](#fragment)
`.trim();
    const result = await localizeImages(md, {
      outDir: dir,
      baseUrl: "https://example.com/",
    });

    t.is(calls, 0);
    t.is(result.downloaded, 0);
    // None of these should have been touched.
    t.true(result.markdown.includes("javascript:alert(1)"));
    t.true(result.markdown.includes("mailto:img@example.com"));
    t.true(result.markdown.includes("ftp://example.com/img.png"));
    t.true(result.markdown.includes("#fragment"));
  });
});

test("localizeImages: absolute http URLs work without baseUrl", async (t) => {
  await withTempDir(async (dir) => {
    let fetchedUrl = "";
    global.fetch = (async (input: string | URL | Request) => {
      fetchedUrl = typeof input === "string" ? input : input.toString();
      return imageResponse(Buffer.from([1]), "image/png");
    }) as typeof fetch;

    const md = `![pic](https://cdn.example.com/img.png)`;
    const result = await localizeImages(md, { outDir: dir });

    t.is(fetchedUrl, "https://cdn.example.com/img.png");
    t.is(result.downloaded, 1);
  });
});

test("localizeImages: still skips relative refs when no baseUrl is given", async (t) => {
  await withTempDir(async (dir) => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return imageResponse(Buffer.from([1]));
    }) as typeof fetch;

    const md = `![logo](/images/Vector.svg)`;
    const result = await localizeImages(md, { outDir: dir });

    t.is(calls, 0);
    t.is(result.downloaded, 0);
    t.is(result.markdown, md);
  });
});

test("localizeImages: rewriteSrc hook can rewrite to absolute path", async (t) => {
  await withTempDir(async (dir) => {
    global.fetch = (async () =>
      imageResponse(Buffer.from([1]))) as typeof fetch;

    const md = `![x](https://example.com/img.png)`;
    const result = await localizeImages(md, {
      outDir: dir,
      rewriteSrc: (local) => `/assets/${local.split("/").pop()}`,
    });
    t.regex(result.markdown, /!\[x\]\(\/assets\/[a-f0-9]+\.png\)/);
  });
});

test("localizeImages: outputPath produces correct relative path when images live in a subdir", async (t) => {
  await withTempDir(async (parent) => {
    const assetsDir = join(parent, "assets");
    global.fetch = (async () =>
      imageResponse(Buffer.from([1]))) as typeof fetch;

    const md = `![x](https://example.com/img.png)`;
    const result = await localizeImages(md, {
      outDir: assetsDir,
      // markdown will live at parent/page.md; images at parent/assets/xxx.png
      // so the correct rewrite is ./assets/xxx.png
      outputPath: join(parent, "page.md"),
    });
    t.regex(
      result.markdown,
      /!\[x\]\(\.\/assets\/[a-f0-9]+\.png\)/,
      `expected ./assets/... but got: ${result.markdown}`,
    );
  });
});

test("localizeImages: outputPath produces basename when markdown and images are siblings", async (t) => {
  await withTempDir(async (dir) => {
    global.fetch = (async () =>
      imageResponse(Buffer.from([1]))) as typeof fetch;

    const md = `![x](https://example.com/img.png)`;
    const result = await localizeImages(md, {
      outDir: dir,
      outputPath: join(dir, "page.md"),
    });
    // No subdir between markdown and image — just the filename.
    t.regex(
      result.markdown,
      /!\[x\]\(\.\/[a-f0-9]+\.png\)/,
      `expected ./... but got: ${result.markdown}`,
    );
  });
});
