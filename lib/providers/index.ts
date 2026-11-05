import { createOllamaProvider } from "./ollama";
import type { ChatProvider } from "./types";

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
      throw new Error("The mock provider is added in #7");
    default:
      throw new Error(`Unknown LLM_PROVIDER "${name}"`);
  }
}
