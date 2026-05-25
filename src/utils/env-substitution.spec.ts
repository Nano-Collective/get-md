// src/utils/env-substitution.spec.ts

import test from "ava";
import { substituteEnvVars } from "./env-substitution.js";

test.beforeEach(() => {
  // Make sure each test starts from a clean slate so set/unset interactions
  // don't leak between tests.
  delete process.env.GETMD_TEST_FOO;
  delete process.env.GETMD_TEST_BAR;
  delete process.env.GETMD_TEST_API_KEY;
});

test("substituteEnvVars: replaces ${VAR} when set", (t) => {
  process.env.GETMD_TEST_FOO = "hello";
  t.is(substituteEnvVars("${GETMD_TEST_FOO}"), "hello");
});

test("substituteEnvVars: replaces $VAR when set", (t) => {
  process.env.GETMD_TEST_FOO = "hello";
  t.is(substituteEnvVars("$GETMD_TEST_FOO"), "hello");
});

test("substituteEnvVars: returns empty string when var missing and no default", (t) => {
  t.is(substituteEnvVars("${GETMD_TEST_FOO}"), "");
});

test("substituteEnvVars: uses default when var missing", (t) => {
  t.is(substituteEnvVars("${GETMD_TEST_FOO:-fallback}"), "fallback");
});

test("substituteEnvVars: prefers actual value over default", (t) => {
  process.env.GETMD_TEST_FOO = "real";
  t.is(substituteEnvVars("${GETMD_TEST_FOO:-fallback}"), "real");
});

test("substituteEnvVars: replaces multiple vars in one string", (t) => {
  process.env.GETMD_TEST_FOO = "a";
  process.env.GETMD_TEST_BAR = "b";
  t.is(
    substituteEnvVars("${GETMD_TEST_FOO}-${GETMD_TEST_BAR}-tail"),
    "a-b-tail",
  );
});

test("substituteEnvVars: recurses into objects", (t) => {
  process.env.GETMD_TEST_API_KEY = "sk-xxx";
  const result = substituteEnvVars({
    apiKey: "${GETMD_TEST_API_KEY}",
    model: "anthropic/claude-haiku-4.5",
  });
  t.deepEqual(result, {
    apiKey: "sk-xxx",
    model: "anthropic/claude-haiku-4.5",
  });
});

test("substituteEnvVars: recurses into nested objects", (t) => {
  process.env.GETMD_TEST_API_KEY = "sk-xxx";
  const result = substituteEnvVars({
    llm: {
      apiKey: "${GETMD_TEST_API_KEY}",
      nested: { value: "${GETMD_TEST_API_KEY}" },
    },
  });
  t.deepEqual(result, {
    llm: {
      apiKey: "sk-xxx",
      nested: { value: "sk-xxx" },
    },
  });
});

test("substituteEnvVars: recurses into arrays", (t) => {
  process.env.GETMD_TEST_FOO = "x";
  t.deepEqual(substituteEnvVars(["${GETMD_TEST_FOO}", "literal"]), [
    "x",
    "literal",
  ]);
});

test("substituteEnvVars: leaves non-string scalars alone", (t) => {
  t.is(substituteEnvVars(42), 42);
  t.is(substituteEnvVars(true), true);
  t.is(substituteEnvVars(null), null);
  t.is(substituteEnvVars(undefined), undefined);
});

test("substituteEnvVars: does not mutate input", (t) => {
  process.env.GETMD_TEST_FOO = "hello";
  const input = { a: "${GETMD_TEST_FOO}" };
  const result = substituteEnvVars(input);
  t.is(input.a, "${GETMD_TEST_FOO}");
  t.deepEqual(result, { a: "hello" });
});

test("substituteEnvVars: leaves a literal '$' alone when not followed by a var name", (t) => {
  t.is(substituteEnvVars("price: $5"), "price: $5");
  t.is(substituteEnvVars("$ alone"), "$ alone");
});
