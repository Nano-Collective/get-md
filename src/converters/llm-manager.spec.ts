// src/converters/llm-manager.spec.ts

import test from "ava";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  LLMManager,
  checkLLMModel,
  downloadLLMModel,
  removeLLMModel,
  getLLMModelInfo,
} from "./llm-manager.js";
import type { LLMEvent, LLMModelStatus, LLMModelInfo } from "../types.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_MODEL_DIR = path.join(os.tmpdir(), "get-md-test-models");
const TEST_MODEL_PATH = path.join(TEST_MODEL_DIR, "test-model.gguf");

// Helper to create a fake model file
async function createFakeModel(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, "fake-model-content");
}

// Helper to clean up test files
async function cleanupTestFiles(): Promise<void> {
  try {
    await fs.rm(TEST_MODEL_DIR, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// LLMManager Class Tests
// ============================================================================

test.beforeEach(async () => {
  await cleanupTestFiles();
});

test.afterEach(async () => {
  await cleanupTestFiles();
});

test("LLMManager: constructor sets default model path", (t) => {
  const manager = new LLMManager();
  const modelPath = manager.getModelPath();

  t.true(modelPath.includes(".get-md"));
  t.true(modelPath.includes("models"));
  t.true(modelPath.endsWith(".gguf"));
});

test("LLMManager: constructor accepts custom model path", (t) => {
  const customPath = "/custom/path/model.gguf";
  const manager = new LLMManager({ modelPath: customPath });

  t.is(manager.getModelPath(), customPath);
});

test("LLMManager: checkModel returns not available for missing model", async (t) => {
  const manager = new LLMManager({ modelPath: TEST_MODEL_PATH });
  const status = await manager.checkModel();

  t.false(status.available);
  t.is(status.path, TEST_MODEL_PATH);
  t.is(status.size, undefined);
  t.is(status.sizeFormatted, undefined);
});

test("LLMManager: checkModel returns available for existing model", async (t) => {
  await createFakeModel(TEST_MODEL_PATH);

  const manager = new LLMManager({ modelPath: TEST_MODEL_PATH });
  const status = await manager.checkModel();

  t.true(status.available);
  t.is(status.path, TEST_MODEL_PATH);
  t.is(typeof status.size, "number");
  t.true(status.size! > 0);
  t.is(typeof status.sizeFormatted, "string");
  t.is(status.version, "2.0");
});

test("LLMManager: checkModel emits events", async (t) => {
  const events: LLMEvent[] = [];
  const manager = new LLMManager({
    modelPath: TEST_MODEL_PATH,
    onEvent: (event) => {
      events.push(event);
    },
  });

  await manager.checkModel();

  t.true(events.length >= 2);
  t.is(events[0].type, "model-check");
  t.is((events[0] as { status: string }).status, "checking");
  t.is(events[1].type, "model-check");
  t.is((events[1] as { status: string }).status, "not-found");
});

test("LLMManager: checkModel emits found event for existing model", async (t) => {
  await createFakeModel(TEST_MODEL_PATH);

  const events: LLMEvent[] = [];
  const manager = new LLMManager({
    modelPath: TEST_MODEL_PATH,
    onEvent: (event) => {
      events.push(event);
    },
  });

  await manager.checkModel();

  t.true(events.length >= 2);
  t.is(events[1].type, "model-check");
  t.is((events[1] as { status: string }).status, "found");
});

test("LLMManager: removeModel deletes existing model", async (t) => {
  await createFakeModel(TEST_MODEL_PATH);

  // Verify file exists
  const existsBefore = await fs
    .access(TEST_MODEL_PATH)
    .then(() => true)
    .catch(() => false);
  t.true(existsBefore);

  const manager = new LLMManager({ modelPath: TEST_MODEL_PATH });
  await manager.removeModel();

  // Verify file is deleted
  const existsAfter = await fs
    .access(TEST_MODEL_PATH)
    .then(() => true)
    .catch(() => false);
  t.false(existsAfter);
});

test("LLMManager: removeModel handles missing file gracefully", async (t) => {
  const manager = new LLMManager({ modelPath: TEST_MODEL_PATH });

  // Should not throw
  await t.notThrowsAsync(async () => {
    await manager.removeModel();
  });
});

test("LLMManager: getModelInfo returns correct structure", (t) => {
  const info = LLMManager.getModelInfo();

  t.is(typeof info.defaultPath, "string");
  t.is(typeof info.recommendedModel, "string");
  t.true(Array.isArray(info.availableModels));
  t.true(info.availableModels.length > 0);

  // Check first model variant
  const variant = info.availableModels[0];
  t.is(typeof variant.name, "string");
  t.is(typeof variant.size, "number");
  t.is(typeof variant.quantization, "string");
  t.is(typeof variant.ramRequired, "string");
});

test("LLMManager: getModelInfo includes Q4_K_M as recommended", (t) => {
  const info = LLMManager.getModelInfo();

  t.true(info.recommendedModel.includes("Q4_K_M"));
  t.true(info.availableModels.some((m) => m.name === info.recommendedModel));
});

// ============================================================================
// Exported Function Tests
// ============================================================================

test("checkLLMModel: returns status for default path", async (t) => {
  const status = await checkLLMModel();

  t.is(typeof status.available, "boolean");
  t.is(typeof status.path, "string");
});

test("checkLLMModel: accepts custom model path", async (t) => {
  await createFakeModel(TEST_MODEL_PATH);

  const status = await checkLLMModel({ modelPath: TEST_MODEL_PATH });

  t.true(status.available);
  t.is(status.path, TEST_MODEL_PATH);
});

test("removeLLMModel: removes model at custom path", async (t) => {
  await createFakeModel(TEST_MODEL_PATH);

  await removeLLMModel({ modelPath: TEST_MODEL_PATH });

  const exists = await fs
    .access(TEST_MODEL_PATH)
    .then(() => true)
    .catch(() => false);
  t.false(exists);
});

test("removeLLMModel: handles missing model gracefully", async (t) => {
  await t.notThrowsAsync(async () => {
    await removeLLMModel({ modelPath: TEST_MODEL_PATH });
  });
});

test("getLLMModelInfo: returns model information", (t) => {
  const info = getLLMModelInfo();

  t.is(typeof info, "object");
  t.is(typeof info.defaultPath, "string");
  t.is(typeof info.recommendedModel, "string");
  t.true(Array.isArray(info.availableModels));
});

test("getLLMModelInfo: default path is in home directory", (t) => {
  const info = getLLMModelInfo();

  t.true(info.defaultPath.includes(os.homedir()));
  t.true(info.defaultPath.includes(".get-md"));
});

test("getLLMModelInfo: includes multiple model variants", (t) => {
  const info = getLLMModelInfo();

  t.true(info.availableModels.length >= 3);

  // Check for different quantization types
  const quantizations = info.availableModels.map((m) => m.quantization);
  t.true(quantizations.includes("Q2_K"));
  t.true(quantizations.includes("Q4_K_M"));
  t.true(quantizations.includes("Q8_0"));
});

// ============================================================================
// Type Export Tests
// ============================================================================

test("types: LLMModelStatus interface is properly structured", async (t) => {
  const status: LLMModelStatus = {
    available: false,
    path: "/test/path",
  };

  t.is(typeof status.available, "boolean");
  t.is(typeof status.path, "string");
});

test("types: LLMModelStatus with all fields", async (t) => {
  const status: LLMModelStatus = {
    available: true,
    path: "/test/path",
    size: 1024,
    sizeFormatted: "1KB",
    version: "2.0",
  };

  t.is(status.available, true);
  t.is(status.size, 1024);
  t.is(status.sizeFormatted, "1KB");
  t.is(status.version, "2.0");
});

test("types: LLMModelInfo interface is properly structured", (t) => {
  const info: LLMModelInfo = {
    defaultPath: "/path",
    recommendedModel: "model",
    availableModels: [
      {
        name: "test",
        size: 100,
        quantization: "Q4",
        ramRequired: "2GB",
      },
    ],
  };

  t.is(typeof info.defaultPath, "string");
  t.is(typeof info.recommendedModel, "string");
  t.true(Array.isArray(info.availableModels));
});

// ============================================================================
// Edge Cases
// ============================================================================

test("LLMManager: handles empty model file", async (t) => {
  await fs.mkdir(path.dirname(TEST_MODEL_PATH), { recursive: true });
  await fs.writeFile(TEST_MODEL_PATH, "");

  const manager = new LLMManager({ modelPath: TEST_MODEL_PATH });
  const status = await manager.checkModel();

  // Empty file should not be considered available
  t.false(status.available);
});

test("LLMManager: handles directory instead of file", async (t) => {
  await fs.mkdir(TEST_MODEL_PATH, { recursive: true });

  const manager = new LLMManager({ modelPath: TEST_MODEL_PATH });
  const status = await manager.checkModel();

  // Directory should not be considered a valid model
  t.false(status.available);
});

test("LLMManager: async event callback works correctly", async (t) => {
  const events: LLMEvent[] = [];
  const manager = new LLMManager({
    modelPath: TEST_MODEL_PATH,
    onEvent: async (event) => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 1));
      events.push(event);
    },
  });

  await manager.checkModel();

  t.true(events.length >= 2);
});

// ============================================================================
// Download Tests (Mocked - don't actually download)
// ============================================================================

// Note: We don't test actual downloads in unit tests to avoid network calls
// and large file downloads. Integration tests should cover actual downloads.

test("downloadLLMModel: function exists and is callable", (t) => {
  t.is(typeof downloadLLMModel, "function");
});

test("downloadLLMModel: accepts options parameter", (t) => {
  // Just verify the function signature is correct by checking it accepts the right shape
  // We use a type assertion to verify the parameter types without actually calling the function
  const options: Parameters<typeof downloadLLMModel>[0] = {
    modelPath: TEST_MODEL_PATH,
    onProgress: () => {},
    onComplete: () => {},
    onError: () => {},
  };

  t.is(typeof options.modelPath, "string");
  t.is(typeof options.onProgress, "function");
  t.is(typeof options.onComplete, "function");
  t.is(typeof options.onError, "function");
});
