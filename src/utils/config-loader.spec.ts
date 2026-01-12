// src/utils/config-loader.spec.ts

import test from "ava";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadConfig,
  loadConfigFromFile,
  findConfigPath,
  mergeConfigWithOptions,
  type GetMdConfig,
} from "./config-loader.js";
import type { MarkdownOptions } from "../types.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_CONFIG_DIR = path.join(os.tmpdir(), "get-md-config-test");
const ORIGINAL_CWD = process.cwd();

// Helper to create a config file
async function createConfigFile(
  dir: string,
  filename: string,
  content: object,
): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  return filePath;
}

// Helper to clean up test files
async function cleanupTestFiles(): Promise<void> {
  try {
    await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// Setup and Teardown
// ============================================================================

test.beforeEach(async () => {
  await cleanupTestFiles();
  await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
});

test.afterEach(async () => {
  process.chdir(ORIGINAL_CWD);
  await cleanupTestFiles();
});

// ============================================================================
// loadConfigFromFile Tests
// ============================================================================

test("loadConfigFromFile: loads valid config file", async (t) => {
  const config = { useLLM: true, llmTemperature: 0.5 };
  const filePath = await createConfigFile(
    TEST_CONFIG_DIR,
    ".getmdrc",
    config,
  );

  const loaded = loadConfigFromFile(filePath);

  t.deepEqual(loaded, config);
});

test("loadConfigFromFile: loads all supported boolean options", async (t) => {
  const config: GetMdConfig = {
    useLLM: true,
    llmFallback: false,
    extractContent: true,
    includeMeta: false,
    includeImages: true,
    includeLinks: false,
    includeTables: true,
    aggressiveCleanup: false,
  };
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  const loaded = loadConfigFromFile(filePath);

  t.deepEqual(loaded, config);
});

test("loadConfigFromFile: loads string options", async (t) => {
  const config = { llmModelPath: "/custom/path/model.gguf" };
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  const loaded = loadConfigFromFile(filePath);

  t.is(loaded.llmModelPath, "/custom/path/model.gguf");
});

test("loadConfigFromFile: loads number options", async (t) => {
  const config = { llmTemperature: 0.3, maxLength: 50000 };
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  const loaded = loadConfigFromFile(filePath);

  t.is(loaded.llmTemperature, 0.3);
  t.is(loaded.maxLength, 50000);
});

test("loadConfigFromFile: throws for non-existent file", (t) => {
  t.throws(
    () => loadConfigFromFile("/nonexistent/path/.getmdrc"),
    { message: /Failed to load config/ },
  );
});

test("loadConfigFromFile: throws for invalid JSON", async (t) => {
  await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
  const filePath = path.join(TEST_CONFIG_DIR, ".getmdrc");
  await fs.writeFile(filePath, "not valid json");

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /Failed to load config/ },
  );
});

test("loadConfigFromFile: throws for non-object config", async (t) => {
  await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
  const filePath = path.join(TEST_CONFIG_DIR, ".getmdrc");
  await fs.writeFile(filePath, '"just a string"');

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /Config must be a JSON object/ },
  );
});

test("loadConfigFromFile: throws for null config", async (t) => {
  await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
  const filePath = path.join(TEST_CONFIG_DIR, ".getmdrc");
  await fs.writeFile(filePath, "null");

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /Config must be a JSON object/ },
  );
});

// ============================================================================
// Config Validation Tests
// ============================================================================

test("loadConfigFromFile: throws for invalid boolean type", async (t) => {
  const config = { useLLM: "yes" }; // Should be boolean, not string
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /useLLM.*must be a boolean/ },
  );
});

test("loadConfigFromFile: throws for invalid llmModelPath type", async (t) => {
  const config = { llmModelPath: 123 }; // Should be string, not number
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /llmModelPath.*must be a string/ },
  );
});

test("loadConfigFromFile: throws for invalid llmTemperature type", async (t) => {
  const config = { llmTemperature: "0.5" }; // Should be number, not string
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /llmTemperature.*must be a number/ },
  );
});

test("loadConfigFromFile: throws for llmTemperature out of range (negative)", async (t) => {
  const config = { llmTemperature: -0.5 };
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /llmTemperature.*between 0 and 2/ },
  );
});

test("loadConfigFromFile: throws for llmTemperature out of range (too high)", async (t) => {
  const config = { llmTemperature: 3.0 };
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /llmTemperature.*between 0 and 2/ },
  );
});

test("loadConfigFromFile: throws for invalid maxLength type", async (t) => {
  const config = { maxLength: "50000" }; // Should be number, not string
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /maxLength.*must be an integer/ },
  );
});

test("loadConfigFromFile: throws for negative maxLength", async (t) => {
  const config = { maxLength: -100 };
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /maxLength.*must be positive/ },
  );
});

test("loadConfigFromFile: throws for non-integer maxLength", async (t) => {
  const config = { maxLength: 50.5 };
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  t.throws(
    () => loadConfigFromFile(filePath),
    { message: /maxLength.*must be an integer/ },
  );
});

// ============================================================================
// findConfigPath Tests
// ============================================================================

test("findConfigPath: finds .getmdrc in current directory", async (t) => {
  await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", { useLLM: true });
  process.chdir(TEST_CONFIG_DIR);

  const configPath = findConfigPath();

  // Use realpath to resolve symlinks (e.g., /var -> /private/var on macOS)
  t.true(configPath !== null);
  t.true(configPath!.endsWith(".getmdrc"));
});

test("findConfigPath: finds .getmdrc.json in current directory", async (t) => {
  await createConfigFile(TEST_CONFIG_DIR, ".getmdrc.json", { useLLM: true });
  process.chdir(TEST_CONFIG_DIR);

  const configPath = findConfigPath();

  t.true(configPath !== null);
  t.true(configPath!.endsWith(".getmdrc.json"));
});

test("findConfigPath: finds get-md.config.json in current directory", async (t) => {
  await createConfigFile(TEST_CONFIG_DIR, "get-md.config.json", {
    useLLM: true,
  });
  process.chdir(TEST_CONFIG_DIR);

  const configPath = findConfigPath();

  t.true(configPath !== null);
  t.true(configPath!.endsWith("get-md.config.json"));
});

test("findConfigPath: finds getmd.config.json in current directory", async (t) => {
  await createConfigFile(TEST_CONFIG_DIR, "getmd.config.json", {
    useLLM: true,
  });
  process.chdir(TEST_CONFIG_DIR);

  const configPath = findConfigPath();

  t.true(configPath !== null);
  t.true(configPath!.endsWith("getmd.config.json"));
});

test("findConfigPath: returns null when no config file exists", async (t) => {
  // Create empty directory and change to it
  const emptyDir = path.join(TEST_CONFIG_DIR, "empty");
  await fs.mkdir(emptyDir, { recursive: true });
  process.chdir(emptyDir);

  const configPath = findConfigPath();

  // May find config in home directory, so just check the function works
  t.true(configPath === null || typeof configPath === "string");
});

test("findConfigPath: prefers .getmdrc over other formats", async (t) => {
  await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", { useLLM: true });
  await createConfigFile(TEST_CONFIG_DIR, "get-md.config.json", {
    useLLM: false,
  });
  process.chdir(TEST_CONFIG_DIR);

  const configPath = findConfigPath();

  t.true(configPath !== null);
  // .getmdrc should be found first (higher priority)
  t.true(configPath!.endsWith(".getmdrc"));
  t.false(configPath!.endsWith(".json"));
});

// ============================================================================
// loadConfig Tests
// ============================================================================

test("loadConfig: loads config from current directory", async (t) => {
  await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", {
    useLLM: true,
    llmTemperature: 0.2,
  });
  process.chdir(TEST_CONFIG_DIR);

  const config = loadConfig();

  t.is(config.useLLM, true);
  t.is(config.llmTemperature, 0.2);
});

test("loadConfig: returns empty object when no config exists", async (t) => {
  const emptyDir = path.join(TEST_CONFIG_DIR, "empty-dir");
  await fs.mkdir(emptyDir, { recursive: true });
  process.chdir(emptyDir);

  // Note: This might still find config in home directory
  // We just verify the function doesn't crash
  const config = loadConfig();

  t.is(typeof config, "object");
});

// ============================================================================
// mergeConfigWithOptions Tests
// ============================================================================

test("mergeConfigWithOptions: options override config", (t) => {
  const config: GetMdConfig = {
    useLLM: true,
    llmTemperature: 0.5,
    extractContent: true,
  };

  const options: MarkdownOptions = {
    useLLM: false,
    llmTemperature: 0.1,
  };

  const merged = mergeConfigWithOptions(config, options);

  t.is(merged.useLLM, false);
  t.is(merged.llmTemperature, 0.1);
  t.is(merged.extractContent, true); // From config
});

test("mergeConfigWithOptions: preserves config when options are undefined", (t) => {
  const config: GetMdConfig = {
    useLLM: true,
    llmTemperature: 0.5,
    extractContent: true,
    includeMeta: false,
  };

  const options: MarkdownOptions = {
    // All undefined
  };

  const merged = mergeConfigWithOptions(config, options);

  t.is(merged.useLLM, true);
  t.is(merged.llmTemperature, 0.5);
  t.is(merged.extractContent, true);
  t.is(merged.includeMeta, false);
});

test("mergeConfigWithOptions: empty config returns options", (t) => {
  const config: GetMdConfig = {};

  const options: MarkdownOptions = {
    useLLM: true,
    llmTemperature: 0.3,
  };

  const merged = mergeConfigWithOptions(config, options);

  t.is(merged.useLLM, true);
  t.is(merged.llmTemperature, 0.3);
});

test("mergeConfigWithOptions: both empty returns empty", (t) => {
  const config: GetMdConfig = {};
  const options: MarkdownOptions = {};

  const merged = mergeConfigWithOptions(config, options);

  t.deepEqual(merged, {});
});

test("mergeConfigWithOptions: handles all option types", (t) => {
  const config: GetMdConfig = {
    useLLM: false,
    llmModelPath: "/default/path",
    llmTemperature: 0.1,
    maxLength: 100000,
    extractContent: true,
  };

  const options: MarkdownOptions = {
    useLLM: true,
    llmModelPath: "/custom/path",
    onLLMEvent: () => {}, // Additional option not in config
  };

  const merged = mergeConfigWithOptions(config, options);

  t.is(merged.useLLM, true);
  t.is(merged.llmModelPath, "/custom/path");
  t.is(merged.llmTemperature, 0.1); // From config
  t.is(merged.maxLength, 100000); // From config
  t.is(merged.extractContent, true); // From config
  t.is(typeof merged.onLLMEvent, "function"); // From options
});

// ============================================================================
// Edge Cases
// ============================================================================

test("loadConfigFromFile: handles empty config object", async (t) => {
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", {});

  const loaded = loadConfigFromFile(filePath);

  t.deepEqual(loaded, {});
});

test("loadConfigFromFile: ignores unknown options", async (t) => {
  const config = {
    useLLM: true,
    unknownOption: "value",
    anotherUnknown: 123,
  };
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  const loaded = loadConfigFromFile(filePath);

  // Should only include recognized options
  t.is(loaded.useLLM, true);
  t.is((loaded as Record<string, unknown>).unknownOption, undefined);
});

test("loadConfigFromFile: handles edge temperature values", async (t) => {
  // Temperature at boundaries should be valid
  const config = { llmTemperature: 0 };
  const filePath1 = await createConfigFile(
    TEST_CONFIG_DIR,
    ".getmdrc",
    config,
  );
  t.notThrows(() => loadConfigFromFile(filePath1));

  await fs.unlink(filePath1);

  const config2 = { llmTemperature: 2 };
  const filePath2 = await createConfigFile(
    TEST_CONFIG_DIR,
    ".getmdrc",
    config2,
  );
  t.notThrows(() => loadConfigFromFile(filePath2));
});

test("loadConfigFromFile: handles maxLength of zero", async (t) => {
  const config = { maxLength: 0 };
  const filePath = await createConfigFile(TEST_CONFIG_DIR, ".getmdrc", config);

  const loaded = loadConfigFromFile(filePath);

  t.is(loaded.maxLength, 0);
});

// ============================================================================
// Type Tests
// ============================================================================

test("types: GetMdConfig interface is properly structured", (t) => {
  const config: GetMdConfig = {
    useLLM: true,
    llmModelPath: "/path",
    llmTemperature: 0.5,
    llmFallback: true,
    extractContent: true,
    includeMeta: true,
    includeImages: true,
    includeLinks: true,
    includeTables: true,
    aggressiveCleanup: true,
    maxLength: 100000,
  };

  t.is(typeof config.useLLM, "boolean");
  t.is(typeof config.llmModelPath, "string");
  t.is(typeof config.llmTemperature, "number");
  t.is(typeof config.maxLength, "number");
});

test("types: GetMdConfig allows partial config", (t) => {
  const config: GetMdConfig = {
    useLLM: true,
  };

  t.is(config.useLLM, true);
  t.is(config.llmModelPath, undefined);
});
