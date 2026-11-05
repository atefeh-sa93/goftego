import { createMockProvider } from "./mock";
import { createOllamaProvider } from "./ollama";
import { loadRecordings } from "./recordings";
import type { ChatProvider } from "./types";

// One mock for the whole server, so "in turn" carries across requests.
let mockProvider: ChatProvider | undefined;

/** Picks the backend from LLM_PROVIDER (default: ollama). */
export function getProvider(): ChatProvider {
  const name = process.env.LLM_PROVIDER ?? "ollama";
  switch (name) {
    case "ollama":
      return createOllamaProvider({
        baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
        model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b",
      });
    case "mock":
      mockProvider ??= createLazyMock();
      return mockProvider;
    default:
      throw new Error(`Unknown LLM_PROVIDER "${name}"`);
  }
}

/** Reads the recordings on the first request, not at import time. */
function createLazyMock(): ChatProvider {
  let ready: Promise<ChatProvider> | undefined;
  return {
    name: "mock",
    async streamChat(messages, options) {
      ready ??= loadRecordings().then((recordings) => createMockProvider({ recordings }));
      return (await ready).streamChat(messages, options);
    },
  };
}
