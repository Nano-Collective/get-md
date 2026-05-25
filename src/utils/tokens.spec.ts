// src/utils/tokens.spec.ts

import test from "ava";
import { estimateTokens } from "./tokens.js";

test("estimateTokens: returns 0 for empty string", (t) => {
  t.is(estimateTokens(""), 0);
});

test("estimateTokens: returns 0 for null/undefined-like falsy", (t) => {
  // The signature is `string`, but downstream callers may pass empty values.
  t.is(estimateTokens("" as string), 0);
});

test("estimateTokens: rounds up so small strings register as 1 token", (t) => {
  // "hi" is 2 chars -> ceil(2/4) = 1
  t.is(estimateTokens("hi"), 1);
});

test("estimateTokens: uses chars/4 heuristic", (t) => {
  // 16 chars -> 16/4 = 4 tokens exactly
  t.is(estimateTokens("abcdefghijklmnop"), 4);
});

test("estimateTokens: rounds up partial tokens", (t) => {
  // 17 chars -> ceil(17/4) = 5
  t.is(estimateTokens("abcdefghijklmnopq"), 5);
});

test("estimateTokens: scales linearly with input length", (t) => {
  const short = "hello world".repeat(10); // 110 chars
  const long = "hello world".repeat(100); // 1100 chars
  t.true(estimateTokens(long) >= estimateTokens(short) * 9);
});

test("estimateTokens: handles multi-line markdown", (t) => {
  const md = `# Heading

Paragraph one with some text.

Paragraph two with more text.
`;
  t.true(estimateTokens(md) > 0);
  t.is(estimateTokens(md), Math.ceil(md.length / 4));
});
