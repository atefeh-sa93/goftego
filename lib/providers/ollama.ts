import { isAbortError, SSEHttpError, streamSSE } from "@/lib/sse/client";
import { parseOllamaChunk } from "./ollama-chunk";
import { type ChatProvider, ProviderError } from "./types";

export interface OllamaConfig {
  /** OpenAI-compatible base URL, e.g. http://localhost:11434/v1 */
  baseUrl: string;
  model: string;
}

export function createOllamaProvider({ baseUrl, model }: OllamaConfig): ChatProvider {
  return {
    name: "ollama",
    async streamChat(messages, { signal, onToken }) {
      let finishReason: string | undefined;
      let ended = false;

      try {
        await streamSSE(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, stream: true, messages }),
          signal,
          onEvent: ({ data }) => {
            const chunk = parseOllamaChunk(data);
            if (chunk.type === "token") onToken(chunk.text);
            else if (chunk.type === "finish") finishReason = chunk.reason;
            else if (chunk.type === "end") ended = true;
          },
        });
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw toProviderError(error, model);
      }

      if (!ended && finishReason === undefined) {
        throw new ProviderError("Ollama closed the stream before the reply finished", true);
      }
      return { finishReason: finishReason ?? "stop" };
    },
  };
}

function toProviderError(error: unknown, model: string): ProviderError {
  if (error instanceof SSEHttpError) {
    if (error.status === 404) {
      return new ProviderError(`Model "${model}" not found. Run: ollama pull ${model}`, false);
    }
    return new ProviderError(`Ollama responded with HTTP ${error.status}`, error.status >= 500 || error.status === 429);
  }
  // fetch rejects with a TypeError when nothing is listening on the port.
  if (error instanceof TypeError) {
    return new ProviderError("Can't reach Ollama. Is it running?", true);
  }
  return new ProviderError(error instanceof Error ? error.message : "Unknown provider error", false);
}
