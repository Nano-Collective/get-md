// src/utils/filename.spec.ts

import test from "ava";
import {
  DEFAULT_NAME_PATTERN,
  filenameForUrl,
  slugify,
  uniqueFilenameForUrl,
} from "./filename.js";

test("slugify: lowercases and dasherises", (t) => {
  t.is(slugify("Hello World"), "hello-world");
});

test("slugify: collapses multiple separators", (t) => {
  t.is(slugify("a/b___c   d"), "a-b-c-d");
});

test("slugify: strips leading/trailing dashes", (t) => {
  t.is(slugify("---hi---"), "hi");
});

test("slugify: returns empty for empty input", (t) => {
  t.is(slugify(""), "");
});

test("filenameForUrl: default pattern uses host + last slug", (t) => {
  const name = filenameForUrl("https://example.com/blog/my-post");
  t.is(name, "example-com-my-post.md");
});

test("filenameForUrl: falls back to host slug when path is empty", (t) => {
  const name = filenameForUrl("https://example.com/");
  t.is(name, "example-com-example-com.md");
});

test("filenameForUrl: index placeholder is 1-based, zero-padded", (t) => {
  const name = filenameForUrl(
    "https://example.com/x",
    "{index}-{slug}.md",
    4,
  );
  t.is(name, "0005-x.md");
});

test("filenameForUrl: {path} expands the full slugified path", (t) => {
  const name = filenameForUrl(
    "https://example.com/docs/guides/install",
    "{host}-{path}.md",
  );
  t.is(name, "example-com-docs-guides-install.md");
});

test("filenameForUrl: handles unparseable URLs gracefully", (t) => {
  const name = filenameForUrl("not a url", DEFAULT_NAME_PATTERN);
  t.true(name.endsWith(".md"));
  t.true(name.length > 0);
});

test("filenameForUrl: replaces filesystem-unsafe chars", (t) => {
  // The pattern itself can include literals that contain "/" etc.
  const name = filenameForUrl(
    "https://example.com/x",
    "out/{slug}.md",
    0,
  );
  t.false(name.includes("/"));
});

test("uniqueFilenameForUrl: appends -2, -3 on collision", (t) => {
  const taken = new Set<string>();
  const a = uniqueFilenameForUrl(
    "https://a.test/post",
    "{slug}.md",
    0,
    taken,
  );
  const b = uniqueFilenameForUrl(
    "https://b.test/post",
    "{slug}.md",
    1,
    taken,
  );
  const c = uniqueFilenameForUrl(
    "https://c.test/post",
    "{slug}.md",
    2,
    taken,
  );
  t.is(a, "post.md");
  t.is(b, "post-2.md");
  t.is(c, "post-3.md");
});
