// src/converters/remote-llm-converter.spec.ts

import test from "ava";
import type { LLMEvent, RemoteLlmConfig } from "../types.js";
import { createRemoteLlmConverter } from "./remote-llm-converter.js";

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

/**
 * Minimal mock of an OpenAI-compatible /chat/completions response. The AI
 * SDK's openai-compatible provider POSTs there and expects this shape.
 */
function mockOpenAiCompatibleResponse(content: string): typeof fetch {
  return (async () => {
    const body = {
      id: "chatcmpl-test",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };
    const bodyText = JSON.stringify(body);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
      text: async () => bodyText,
      body: null,
      clone() {
        return this as unknown as Response;
      },
    } as unknown as Response;
  }) as typeof fetch;
}

test("RemoteLlmConverter: converts HTML via openai-compatible provider", async (t) => {
  global.fetch = mockOpenAiCompatibleResponse("# Hello\n\nFrom the model");

  const config: RemoteLlmConfig = {
    sdkProvider: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "sk-test",
    model: "anthropic/claude-haiku-4.5",
  };
  const converter = createRemoteLlmConverter({ config });

  const markdown = await converter.convert("<h1>Hello</h1><p>World</p>");
  t.is(markdown, "# Hello\n\nFrom the model");
});

test("RemoteLlmConverter: strips ```markdown code-fence wrapping", async (t) => {
  global.fetch = mockOpenAiCompatibleResponse(
    "```markdown\n# Title\n\nBody.\n```",
  );

  const converter = createRemoteLlmConverter({
    config: {
      sdkProvider: "openai-compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk-test",
      model: "any-model",
    },
  });

  const markdown = await converter.convert("<h1>Title</h1>");
  t.is(markdown, "# Title\n\nBody.");
});

test("RemoteLlmConverter: throws when openai-compatible has no baseUrl", async (t) => {
  global.fetch = mockOpenAiCompatibleResponse("# x");

  const converter = createRemoteLlmConverter({
    config: {
      sdkProvider: "openai-compatible",
      // intentionally no baseUrl
      apiKey: "sk-test",
      model: "any-model",
    } as RemoteLlmConfig,
  });

  await t.throwsAsync(() => converter.convert("<p>hi</p>"), {
    message: /openai-compatible.*requires a baseUrl/,
  });
});

test("RemoteLlmConverter: emits conversion-start and conversion-complete events", async (t) => {
  global.fetch = mockOpenAiCompatibleResponse("# Done");

  const events: LLMEvent["type"][] = [];
  const converter = createRemoteLlmConverter({
    config: {
      sdkProvider: "openai-compatible",
      baseUrl: "https://example.com/v1",
      apiKey: "sk-test",
      model: "m",
    },
    onEvent: (event) => {
      events.push(event.type);
    },
  });

  await converter.convert("<p>hi</p>");
  t.true(events.includes("conversion-start"));
  t.true(events.includes("conversion-complete"));
  t.true(events.includes("model-loaded"));
});

test("RemoteLlmConverter: emits conversion-error on failure", async (t) => {
  global.fetch = (async () => {
    return {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: new Headers(),
      text: async () => "boom",
      json: async () => ({}),
      body: null,
      clone() {
        return this as unknown as Response;
      },
    } as unknown as Response;
  }) as typeof fetch;

  const events: LLMEvent["type"][] = [];
  const converter = createRemoteLlmConverter({
    config: {
      sdkProvider: "openai-compatible",
      baseUrl: "https://example.com/v1",
      apiKey: "sk-test",
      model: "m",
    },
    onEvent: (event) => {
      events.push(event.type);
    },
  });

  await t.throwsAsync(() => converter.convert("<p>hi</p>"));
  t.true(events.includes("conversion-error"));
});

test("RemoteLlmConverter: isLoaded() always returns true and unload() is a no-op", async (t) => {
  const converter = createRemoteLlmConverter({
    config: {
      sdkProvider: "anthropic",
      apiKey: "sk-ant-test",
      model: "claude-haiku-4-5",
    },
  });

  t.true(converter.isLoaded());
  await converter.unload();
  t.true(converter.isLoaded());
});

test("RemoteLlmConverter: uses VISION_SYSTEM_PROMPT and messages when images are provided", async (t) => {
  let requestBody: any;
  global.fetch = (async (url: string, init: any) => {
    requestBody = JSON.parse(init.body);
    return mockOpenAiCompatibleResponse("Mocked vision response")(url, init);
  }) as any;

  const converter = createRemoteLlmConverter({
    config: {
      sdkProvider: "openai-compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk-test",
      model: "vision-model",
    },
  });

  const dummyImage = Buffer.from("dummy-image-data");
  const markdown = await converter.convert("<h1>Has Images</h1>", [dummyImage]);

  t.is(markdown, "Mocked vision response");
  
  // The system prompt should contain "images of the rendered page"
  const systemMessage = requestBody.messages.find((m: any) => m.role === "system");
  t.truthy(systemMessage, "Should have a system message");
  t.regex(systemMessage.content, /images of the rendered page/i);

  // The user prompt should be a message with text and image parts
  const userMessage = requestBody.messages.find((m: any) => m.role === "user");
  t.truthy(userMessage, "Should have a user message");
  
  // Vercel AI SDK translates the internal representation into API-specific parts.
  // We just verify it has the content array indicating a multimodal message.
  t.true(Array.isArray(userMessage.content), "User content should be an array of parts");
  
  const textPart = userMessage.content.find((p: any) => p.type === "text");
  t.truthy(textPart, "Should have a text part");
  t.regex(textPart.text, /Has Images/);

  const imagePart = userMessage.content.find((p: any) => p.type === "image_url");
  t.truthy(imagePart, "Should have an image part");
});

function mockRetryResponse(content: string): typeof fetch {
  let callCount = 0;
  return (async (_url: any, _init: any) => {
    callCount++;
    if (callCount === 1) {
      // Simulate multimodal rejection
      const errBody = { error: { message: "Multimodal not supported" } };
      return {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => errBody,
        text: async () => JSON.stringify(errBody),
        body: null,
        clone() { return this as unknown as Response; },
      } as unknown as Response;
    }
    
    // Simulate successful text-only response
    const body = {
      id: "chatcmpl-test",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "test-model",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
      text: async () => JSON.stringify(body),
      body: null,
      clone() { return this as unknown as Response; },
    } as unknown as Response;
  }) as typeof fetch;
}

test("RemoteLlmConverter: retries without images if multimodal request fails", async (t) => {
  global.fetch = mockRetryResponse("# Retried Markdown\n\nNo images here");

  const config: RemoteLlmConfig = {
    sdkProvider: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "sk-test",
    model: "test/model",
  };
  const converter = createRemoteLlmConverter({ config });
  
  const dummyImages = [Buffer.from("fake-image")];
  const markdown = await converter.convert("<h1>Hello</h1>", dummyImages);

  t.is(markdown, "# Retried Markdown\n\nNo images here");
});
