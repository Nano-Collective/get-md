// src/utils/filename.ts

/**
 * Helpers for turning a URL into a safe output filename in batch mode.
 *
 * The default pattern is `{host}-{slug}.md`. Users can override via the
 * `--name-pattern` CLI flag (or `BatchOptions.namePattern` if we surface
 * it later) with these placeholders:
 *
 * - `{host}`   — `example.com`
 * - `{path}`   — full URL path, slugified
 * - `{slug}`   — last meaningful path segment, slugified
 * - `{index}`  — 1-based position in the batch (always 4 digits, zero-padded)
 *
 * If a filename collides with one already used in the same batch, we append
 * `-2`, `-3`, etc. so nothing silently overwrites.
 */

export const DEFAULT_NAME_PATTERN = "{host}-{slug}.md";

// biome-ignore lint/suspicious/noControlCharactersInRegex: 0x00-0x1f are deliberately matched — they're illegal in filenames on Windows and we strip them defensively before writing to disk.
const UNSAFE_FS_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const MULTIPLE_DASHES = /-+/g;
const LEADING_TRAILING_DASHES = /^-+|-+$/g;

/** Lowercase, ascii-only, dash-separated. Empty-safe. */
export function slugify(input: string): string {
  if (!input) return "";
  return (
    input
      .toLowerCase()
      // Normalise accents to plain letters where possible.
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      // Replace anything that's not a-z0-9 with a dash.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(MULTIPLE_DASHES, "-")
      .replace(LEADING_TRAILING_DASHES, "")
  );
}

/**
 * Build a filename for a URL using a pattern with `{host}` / `{path}` /
 * `{slug}` / `{index}` placeholders. Pads the index to 4 digits so a sorted
 * `ls` stays in batch order.
 */
export function filenameForUrl(
  url: string,
  pattern: string = DEFAULT_NAME_PATTERN,
  index: number = 0,
): string {
  let host = "";
  let pathSlug = "";
  let slug = "";

  try {
    const parsed = new URL(url);
    host = slugify(parsed.host) || "no-host";
    const trimmedPath = parsed.pathname.replace(/^\/+|\/+$/g, "");
    pathSlug = slugify(trimmedPath);

    // {slug} = last meaningful path segment, or the host if the path is empty.
    const segments = trimmedPath.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? "";
    slug = slugify(lastSegment) || host;
  } catch {
    // Not a parseable URL — fall back to slugifying the whole string.
    const fallback = slugify(url) || "url";
    host = fallback;
    pathSlug = fallback;
    slug = fallback;
  }

  const indexPadded = String(index + 1).padStart(4, "0");

  const candidate = pattern
    .replace(/\{host\}/g, host)
    .replace(/\{path\}/g, pathSlug || "index")
    .replace(/\{slug\}/g, slug || "index")
    .replace(/\{index\}/g, indexPadded);

  // Final safety pass — strip anything the platform would refuse.
  const safe = candidate.replace(UNSAFE_FS_CHARS, "-").replace(/\s+/g, "-");
  return safe || `url-${indexPadded}.md`;
}

/**
 * Resolve filename collisions inside a single batch. Pass a `Set<string>` of
 * names already taken; the helper mutates it. Returns a guaranteed-unique
 * filename for the URL.
 */
export function uniqueFilenameForUrl(
  url: string,
  pattern: string,
  index: number,
  taken: Set<string>,
): string {
  const base = filenameForUrl(url, pattern, index);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot === -1 ? base : base.slice(0, dot);
  const ext = dot === -1 ? "" : base.slice(dot);
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${stem}-${n}${ext}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  // 10k collisions for the same stem is operator error, not a real condition.
  throw new Error(
    `filename collision: exhausted suffixes for "${base}" in the batch`,
  );
}
