// src/converters/llm-converter.spec.ts

import test from "ava";
import { LLMConverter, createLLMConverter } from "./llm-converter.js";
import type { LLMEvent, LLMEventCallback } from "../types.js";

// ============================================================================
// Note on Testing Strategy
// ============================================================================
// These tests focus on the LLMConverter's interface, configuration, and
// error handling without requiring an actual model file. Tests that would
// require loading a real ~1GB model are marked as integration tests and
// should be run separately with the model downloaded.
// ============================================================================

// ============================================================================
// Constructor Tests
// ============================================================================

test("LLMConverter: constructor creates instance with required options", (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
  });

  t.truthy(converter);
  t.is(typeof converter.loadModel, "function");
  t.is(typeof converter.convert, "function");
  t.is(typeof converter.unload, "function");
  t.is(typeof converter.isLoaded, "function");
});

test("LLMConverter: constructor accepts optional temperature", (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
    temperature: 0.5,
  });

  t.truthy(converter);
});

test("LLMConverter: constructor accepts optional maxTokens", (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
    maxTokens: 1000,
  });

  t.truthy(converter);
});

test("LLMConverter: constructor accepts optional event callback", (t) => {
  const events: LLMEvent[] = [];
  const onEvent: LLMEventCallback = (event) => {
    events.push(event);
  };

  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
    onEvent,
  });

  t.truthy(converter);
});

test("LLMConverter: constructor accepts all options together", (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
    temperature: 0.2,
    maxTokens: 10000,
    onEvent: () => {},
  });

  t.truthy(converter);
});

// ============================================================================
// isLoaded Tests
// ============================================================================

test("LLMConverter: isLoaded returns false before loading", (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
  });

  t.false(converter.isLoaded());
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test("LLMConverter: convert throws if model not loaded", async (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
  });

  await t.throwsAsync(
    async () => {
      await converter.convert("<h1>Test</h1>");
    },
    { message: /Model not loaded/ },
  );
});

test("LLMConverter: loadModel throws for non-existent model file", async (t) => {
  const converter = new LLMConverter({
    modelPath: "/nonexistent/path/to/model.gguf",
  });

  await t.throwsAsync(
    async () => {
      await converter.loadModel();
    },
    { message: /Failed to load LLM model/ },
  );
});

// ============================================================================
// unload Tests
// ============================================================================

test("LLMConverter: unload works even if model not loaded", async (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
  });

  // Should not throw
  await t.notThrowsAsync(async () => {
    await converter.unload();
  });
});

test("LLMConverter: unload can be called multiple times", async (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
  });

  await t.notThrowsAsync(async () => {
    await converter.unload();
    await converter.unload();
    await converter.unload();
  });
});

// ============================================================================
// createLLMConverter Factory Function Tests
// ============================================================================

test("createLLMConverter: creates LLMConverter instance", (t) => {
  const converter = createLLMConverter({
    modelPath: "/path/to/model.gguf",
  });

  t.truthy(converter);
  t.true(converter instanceof LLMConverter);
});

test("createLLMConverter: passes all options to constructor", (t) => {
  const events: LLMEvent[] = [];

  const converter = createLLMConverter({
    modelPath: "/path/to/model.gguf",
    temperature: 0.3,
    maxTokens: 5000,
    onEvent: (event) => {
      events.push(event);
    },
  });

  t.truthy(converter);
  t.false(converter.isLoaded());
});

// ============================================================================
// Event Emission Tests (Without Model)
// ============================================================================

test("LLMConverter: emits model-loading event on loadModel attempt", async (t) => {
  const events: LLMEvent[] = [];

  const converter = new LLMConverter({
    modelPath: "/nonexistent/model.gguf",
    onEvent: (event) => {
      events.push(event);
    },
  });

  try {
    await converter.loadModel();
  } catch {
    // Expected to fail
  }

  // Should have emitted model-loading event before failing
  t.true(events.some((e) => e.type === "model-loading"));
});

// ============================================================================
// Type Safety Tests
// ============================================================================

test("types: LLMConverter interface is correctly typed", (t) => {
  // This test verifies TypeScript types at compile time
  const converter: LLMConverter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
  });

  // Verify methods exist and are functions
  t.is(typeof converter.loadModel, "function");
  t.is(typeof converter.convert, "function");
  t.is(typeof converter.unload, "function");
  t.is(typeof converter.isLoaded, "function");
});

// ============================================================================
// Event Type Tests
// ============================================================================

test("types: LLMEvent union covers model-loading", (t) => {
  const event: LLMEvent = {
    type: "model-loading",
    modelName: "ReaderLM-v2",
  };

  t.is(event.type, "model-loading");
});

test("types: LLMEvent union covers model-loaded", (t) => {
  const event: LLMEvent = {
    type: "model-loaded",
    loadTime: 1000,
  };

  t.is(event.type, "model-loaded");
  t.is(event.loadTime, 1000);
});

test("types: LLMEvent union covers conversion-start", (t) => {
  const event: LLMEvent = {
    type: "conversion-start",
    inputSize: 5000,
  };

  t.is(event.type, "conversion-start");
  t.is(event.inputSize, 5000);
});

test("types: LLMEvent union covers conversion-progress", (t) => {
  const event: LLMEvent = {
    type: "conversion-progress",
    tokensProcessed: 100,
  };

  t.is(event.type, "conversion-progress");
  t.is(event.tokensProcessed, 100);
});

test("types: LLMEvent union covers conversion-complete", (t) => {
  const event: LLMEvent = {
    type: "conversion-complete",
    outputSize: 3000,
    duration: 5000,
  };

  t.is(event.type, "conversion-complete");
  t.is(event.outputSize, 3000);
  t.is(event.duration, 5000);
});

test("types: LLMEvent union covers conversion-error", (t) => {
  const event: LLMEvent = {
    type: "conversion-error",
    error: new Error("Test error"),
  };

  t.is(event.type, "conversion-error");
  t.is(event.error.message, "Test error");
});

// ============================================================================
// Edge Cases
// ============================================================================

test("LLMConverter: handles empty HTML input for convert (after model loaded error)", async (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
  });

  // Should fail because model not loaded, not because of empty input
  await t.throwsAsync(
    async () => {
      await converter.convert("");
    },
    { message: /Model not loaded/ },
  );
});

test("LLMConverter: handles very long HTML input for convert (after model loaded error)", async (t) => {
  const converter = new LLMConverter({
    modelPath: "/path/to/model.gguf",
  });

  const longHtml = "<p>" + "x".repeat(100000) + "</p>";

  // Should fail because model not loaded, not because of length
  await t.throwsAsync(
    async () => {
      await converter.convert(longHtml);
    },
    { message: /Model not loaded/ },
  );
});

test("LLMConverter: temperature defaults are reasonable", (t) => {
  // Default temperature should be low (0.1) for consistent output
  // We can't directly test the default, but we can verify the class accepts it
  const converter = createLLMConverter({
    modelPath: "/path/to/model.gguf",
    // Not specifying temperature - should use default
  });

  t.truthy(converter);
});

test("LLMConverter: maxTokens defaults are reasonable", (t) => {
  // Default maxTokens should be high (512000) to handle long documents
  // We can't directly test the default, but we can verify the class accepts it
  const converter = createLLMConverter({
    modelPath: "/path/to/model.gguf",
    // Not specifying maxTokens - should use default
  });

  t.truthy(converter);
});

// ============================================================================
// Async Event Callback Tests
// ============================================================================

test("LLMConverter: async event callback is supported", async (t) => {
  const events: LLMEvent[] = [];

  const converter = new LLMConverter({
    modelPath: "/nonexistent/model.gguf",
    onEvent: async (event) => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 1));
      events.push(event);
    },
  });

  try {
    await converter.loadModel();
  } catch {
    // Expected to fail
  }

  // Give time for async callback to complete
  await new Promise((resolve) => setTimeout(resolve, 10));

  t.true(events.length > 0);
});
