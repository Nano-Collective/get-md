// src/optimizers/image-localizer.ts

// Download images referenced in the converted Markdown to a local directory
// and rewrite their src to point at the local copy. Useful for offline
// archives, PDF export, and RAG pipelines where you want to retain images
// alongside the markdown text.
//
// Best-effort per image: a single download failure logs a warning and leaves
// that image's original URL in place — it doesn't fail the conversion.

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CONCURRENCY = 4;

/** Inline match for ![alt](src "optional title") — captures alt and src. */
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

interface LocalizeOptions {
  /** Target directory — created if missing. */
  outDir: string;
  /** Max concurrent image downloads. Default: 4. */
  concurrency?: number;
  /** Per-image fetch timeout in ms. Default: 15s. */
  timeout?: number;
  /** Custom user agent for image requests. */
  userAgent?: string;
  /**
   * Where the markdown file itself will live. When set, the default
   * `rewriteSrc` computes a path relative to `dirname(outputPath)` — so
   * markdown at `./out/page.md` with images at `./out/assets/foo.png` gets
   * a correct `./assets/foo.png` reference. Only the dirname matters; any
   * placeholder filename works.
   */
  outputPath?: string;
  /**
   * Base URL for resolving relative image refs (e.g. `/images/foo.png`).
   * Without this, relative refs are silently skipped — they can't be
   * fetched on their own. Pass the URL that produced the markdown.
   */
  baseUrl?: string;
  /**
   * Override the default URL-rewrite. Takes precedence over `outputPath`.
   */
  rewriteSrc?: (localFile: string, originalSrc: string) => string;
}

export interface LocalizeResult {
  /** Markdown with image src values rewritten to local paths */
  markdown: string;
  /** Number of images downloaded successfully */
  downloaded: number;
  /** Number of images that failed to download (kept their original URL) */
  failed: number;
}

/**
 * Walk the markdown for image references, download each to `outDir`, and
 * rewrite `![alt](src)` to point at the local copy. Skips data: URLs and
 * non-HTTP(S) schemes.
 */
export async function localizeImages(
  markdown: string,
  options: LocalizeOptions,
): Promise<LocalizeResult> {
  const outDir = options.outDir;
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const rewriteSrc =
    options.rewriteSrc ?? buildDefaultRewriteSrc(options.outputPath);

  // Collect every image ref the markdown contains. For each one, resolve
  // it (possibly against baseUrl) to an absolute http(s) URL we can fetch.
  // Track BOTH the original markdown src (used as the rewrite key) AND the
  // resolved URL (used for the network request); a relative src like
  // `/images/x.png` gets fetched as `https://site.com/images/x.png` but the
  // rewrite still needs to find `/images/x.png` in the markdown.
  const resolved = new Map<string, string>(); // originalSrc -> absoluteUrl
  for (const match of markdown.matchAll(IMAGE_RE)) {
    const src = match[2];
    if (!src || resolved.has(src)) continue;
    const absolute = resolveImageUrl(src, options.baseUrl);
    if (!absolute) continue;
    resolved.set(src, absolute);
  }

  if (resolved.size === 0) {
    return { markdown, downloaded: 0, failed: 0 };
  }

  await mkdir(outDir, { recursive: true });

  // originalSrc -> local path. Populated by the download workers; consulted
  // during the rewrite pass below.
  const localPaths = new Map<string, string>();
  let failed = 0;

  const tasks = Array.from(resolved.entries());
  await runWithConcurrency(
    tasks,
    concurrency,
    async ([originalSrc, absUrl]) => {
      try {
        const localPath = await downloadOne(absUrl, outDir, options);
        localPaths.set(originalSrc, localPath);
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `get-md image localizer: ${absUrl} (from ${originalSrc}): ${message}`,
        );
      }
    },
  );

  // Rewrite ![alt](src) for every src we successfully downloaded.
  const rewritten = markdown.replace(
    IMAGE_RE,
    (full, alt: string, src: string) => {
      const localFile = localPaths.get(src);
      if (!localFile) return full;
      return `![${alt}](${rewriteSrc(localFile, src)})`;
    },
  );

  return {
    markdown: rewritten,
    downloaded: localPaths.size,
    failed,
  };
}

/**
 * Build the default URL-rewriter. If we know where the markdown will be
 * saved, we can produce a correct relative path; otherwise fall back to
 * a bare basename and hope the markdown ends up next to the assets dir.
 */
function buildDefaultRewriteSrc(
  outputPath: string | undefined,
): (localFile: string) => string {
  if (!outputPath) {
    return (localFile: string) => `./${path.basename(localFile)}`;
  }
  const markdownDir = path.dirname(path.resolve(outputPath));
  return (localFile: string) => {
    const rel = path.relative(markdownDir, path.resolve(localFile));
    // Forward slashes for portability; explicit `./` prefix so markdown
    // renderers treat it as a relative path (not a URL).
    const normalised = rel.split(path.sep).join("/");
    return normalised.startsWith(".") ? normalised : `./${normalised}`;
  };
}

/**
 * Resolve a markdown image src to an absolute http(s) URL. Accepts both
 * absolute and relative refs — relative refs need a `baseUrl` to resolve
 * against. Returns null for non-fetchable inputs (data: URLs, fragments,
 * mailto:, or a relative ref with no baseUrl).
 */
function resolveImageUrl(
  src: string,
  baseUrl: string | undefined,
): string | null {
  if (!src || src.startsWith("data:") || src.startsWith("#")) return null;
  try {
    // URL constructor handles both absolute and (with base) relative.
    const u = new URL(src, baseUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Fetch a single image and write it under `outDir`. Filename is derived from
 * a hash of the URL plus the response's content-type extension (jpg, png,
 * etc.). Same URL → same hash → deterministic filename across runs.
 */
async function downloadOne(
  url: string,
  outDir: string,
  options: LocalizeOptions,
): Promise<string> {
  const timeout = options.timeout ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: options.userAgent ? { "User-Agent": options.userAgent } : {},
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const ext = extensionFromResponse(response, url);
    const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
    const filename = `${hash}${ext}`;
    const target = path.join(outDir, filename);

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(target, buffer);
    return target;
  } finally {
    clearTimeout(timer);
  }
}

function extensionFromResponse(response: Response, url: string): string {
  const contentType = response.headers?.get("content-type") ?? "";
  const fromCt = extensionFromContentType(contentType);
  if (fromCt) return fromCt;

  // Fall back to the URL's existing extension if it looks reasonable.
  try {
    const u = new URL(url);
    const ext = path.extname(u.pathname).toLowerCase();
    if (
      ext &&
      [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"].includes(ext)
    ) {
      return ext;
    }
  } catch {
    // ignore
  }
  return ".img";
}

function extensionFromContentType(contentType: string): string | null {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  switch (ct) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "image/avif":
      return ".avif";
    case "image/bmp":
      return ".bmp";
    case "image/tiff":
      return ".tiff";
    default:
      return null;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = index++;
        if (i >= items.length) return;
        await worker(items[i]);
      }
    },
  );
  await Promise.all(runners);
}
