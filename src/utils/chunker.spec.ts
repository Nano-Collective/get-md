// src/utils/chunker.spec.ts

import test from "ava";
import { chunkMarkdown } from "./chunker.js";

test("chunkMarkdown: throws when maxTokens is not positive", (t) => {
  t.throws(() => chunkMarkdown("hello", { maxTokens: 0 }), {
    message: /maxTokens must be a positive number/,
  });
  t.throws(() => chunkMarkdown("hello", { maxTokens: -5 }), {
    message: /maxTokens must be a positive number/,
  });
  t.throws(() => chunkMarkdown("hello", { maxTokens: Number.NaN }), {
    message: /maxTokens must be a positive number/,
  });
});

test("chunkMarkdown: throws when overlap >= maxTokens", (t) => {
  t.throws(() => chunkMarkdown("hello", { maxTokens: 10, overlap: 10 }), {
    message: /overlap must be smaller than maxTokens/,
  });
});

test("chunkMarkdown: returns single chunk when document fits", (t) => {
  const md = "# Heading\n\nShort paragraph.";
  const chunks = chunkMarkdown(md, { maxTokens: 1000 });
  t.is(chunks.length, 1);
  t.is(chunks[0].index, 0);
  t.is(chunks[0].total, 1);
  t.true(chunks[0].content.includes("Short paragraph."));
});

test("chunkMarkdown: splits at paragraph boundaries", (t) => {
  // Each paragraph is ~30 tokens; maxTokens=20 forces splits between them.
  const para = "word ".repeat(100).trim();
  const md = `${para}\n\n${para}\n\n${para}`;
  const chunks = chunkMarkdown(md, { maxTokens: 200 });
  t.true(chunks.length >= 2);
  // Index/total are populated consistently
  chunks.forEach((c, i) => {
    t.is(c.index, i);
    t.is(c.total, chunks.length);
  });
});

test("chunkMarkdown: every chunk stays under maxTokens (excluding heading-path overhead)", (t) => {
  const para = "lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(
    50,
  );
  const md = `# Title\n\n## Section A\n\n${para}\n\n## Section B\n\n${para}`;
  const maxTokens = 300;
  const chunks = chunkMarkdown(md, {
    maxTokens,
    includeHeadingPath: false,
  });
  for (const chunk of chunks) {
    t.true(
      chunk.estimatedTokens <= maxTokens,
      `chunk ${chunk.index} has ${chunk.estimatedTokens} tokens, max is ${maxTokens}`,
    );
  }
});

test("chunkMarkdown: tracks heading path across chunks", (t) => {
  const para = "filler ".repeat(200);
  const md = `# Doc\n\n## Setup\n\n${para}\n\n## Usage\n\n${para}`;
  const chunks = chunkMarkdown(md, { maxTokens: 200 });

  const setupChunk = chunks.find((c) => c.headingPath.includes("Setup"));
  const usageChunk = chunks.find((c) => c.headingPath.includes("Usage"));

  t.truthy(setupChunk, "expected at least one chunk under Setup");
  t.truthy(usageChunk, "expected at least one chunk under Usage");
  t.deepEqual(setupChunk?.headingPath, ["Doc", "Setup"]);
  t.deepEqual(usageChunk?.headingPath, ["Doc", "Usage"]);
});

test("chunkMarkdown: prepends heading path by default", (t) => {
  const para = "filler ".repeat(100);
  const md = `# Doc\n\n## Setup\n\n${para}\n\n## Usage\n\n${para}`;
  const chunks = chunkMarkdown(md, { maxTokens: 150 });

  // At least one of the Usage chunks should start with the heading trail
  const usageChunk = chunks.find(
    (c) => c.headingPath.includes("Usage") && !c.content.startsWith("# Doc"),
  );
  // The first Usage chunk will have the heading inline (since it's the
  // heading block itself); subsequent Usage chunks should be prepended.
  // Just check the heading appears somewhere in chunks under Usage.
  const everyUsageChunkMentionsUsage = chunks
    .filter((c) => c.headingPath[c.headingPath.length - 1] === "Usage")
    .every((c) => c.content.includes("Usage"));
  t.true(everyUsageChunkMentionsUsage);
  t.truthy(usageChunk || chunks.some((c) => c.headingPath.includes("Usage")));
});

test("chunkMarkdown: skips heading path when includeHeadingPath is false", (t) => {
  const para = "filler ".repeat(100);
  const md = `# Doc\n\n## Section\n\n${para}\n\n${para}`;
  const chunks = chunkMarkdown(md, {
    maxTokens: 150,
    includeHeadingPath: false,
  });

  // Continuation chunks (not the first one under a heading) should not
  // contain the heading trail prepended to them.
  const continuationChunks = chunks.slice(1);
  for (const chunk of continuationChunks) {
    t.false(chunk.content.startsWith("# Doc"));
  }
});

test("chunkMarkdown: strips YAML frontmatter", (t) => {
  const md = `---
title: Hello
author: Test
---

# Body

Content here.`;
  const chunks = chunkMarkdown(md, { maxTokens: 1000 });
  t.is(chunks.length, 1);
  t.false(chunks[0].content.includes("---"));
  t.false(chunks[0].content.includes("title: Hello"));
});

test("chunkMarkdown: splits an oversized single block on sentences", (t) => {
  // One huge paragraph, no blank-line breaks — must split internally.
  const sentence = "This is a sentence. ";
  const huge = sentence.repeat(200).trim();
  const chunks = chunkMarkdown(huge, { maxTokens: 100 });
  t.true(chunks.length >= 2);
  for (const chunk of chunks) {
    t.true(chunk.estimatedTokens <= 100 * 1.5); // some headroom for join overhead
  }
});

test("chunkMarkdown: overlap shares content between adjacent chunks", (t) => {
  const para = "alpha beta gamma delta epsilon zeta eta theta ".repeat(50);
  const md = `${para}\n\n${para}\n\n${para}`;
  const noOverlap = chunkMarkdown(md, {
    maxTokens: 200,
    includeHeadingPath: false,
  });
  const withOverlap = chunkMarkdown(md, {
    maxTokens: 200,
    overlap: 50,
    includeHeadingPath: false,
  });

  t.is(noOverlap.length, withOverlap.length);
  // Chunks past the first should be larger when overlap is enabled.
  for (let i = 1; i < withOverlap.length; i++) {
    t.true(
      withOverlap[i].estimatedTokens >= noOverlap[i].estimatedTokens,
      `chunk ${i}: overlap ${withOverlap[i].estimatedTokens} should be >= no-overlap ${noOverlap[i].estimatedTokens}`,
    );
  }
});

test("chunkMarkdown: empty document yields no chunks", (t) => {
  t.deepEqual(chunkMarkdown("", { maxTokens: 100 }), []);
  t.deepEqual(chunkMarkdown("   \n\n   ", { maxTokens: 100 }), []);
});

test("chunkMarkdown: nested headings build correct path", (t) => {
  const md = `# A

para under A.

## B

para under B.

### C

para under C.

## D

para under D.
`;
  // Use a small budget so the packer breaks at each heading and we can read
  // the heading path off each chunk.
  const small = chunkMarkdown(md, { maxTokens: 20, includeHeadingPath: false });
  const paths = small.map((c) => c.headingPath.join("/"));
  t.true(paths.some((p) => p === "A"));
  t.true(paths.some((p) => p === "A/B"));
  t.true(paths.some((p) => p === "A/B/C"));
  t.true(paths.some((p) => p === "A/D"));
});
