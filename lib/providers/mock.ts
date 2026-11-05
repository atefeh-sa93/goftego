/**
 * A provider that replays recorded /api/chat replies instead of calling a
 * model, so CI, E2E tests and the demo work without Ollama. Recordings are
 * in our own SSE format (see protocol.ts) and are played in turn: the first
 * request gets the first recording, the next one the second, and so on.
 */
import { createSSEParser, type SSEEvent } from "@/lib/sse/parse";
import { sleep } from "./sleep";
import { type ChatProvider, ProviderError } from "./types";

export interface Recording {
  name: string;
  /** The raw text/event-stream body, as saved by `pnpm record`. */
  sse: string;
}

export interface MockConfig {
  recordings: Recording[];
  /** Pause before each token, picked between min and max (ms). */
  delay?: { min: number; max: number };
  random?: () => number;
}

export function createMockProvider({ recordings, delay = { min: 15, max: 45 }, random = Math.random }: MockConfig): ChatProvider {
  if (recordings.length === 0) throw new Error("The mock provider needs at least one recording");
  let turn = 0;

  return {
    name: "mock",
    async streamChat(_messages, { signal, onToken }) {
      const recording = recordings[turn % recordings.length]!;
      turn++;

      const events: SSEEvent[] = [];
      const parser = createSSEParser((e) => events.push(e));
      parser.feed(recording.sse);
      parser.end();

      for (const { event, data } of events) {
        const payload = JSON.parse(data) as Record<string, unknown>;
        switch (event) {
          case "token":
            await sleep(delay.min + random() * (delay.max - delay.min), signal);
            onToken(String(payload.text));
            break;
          case "done":
            return { finishReason: String(payload.finishReason ?? "stop") };
          case "error":
            throw new ProviderError(String(payload.message), Boolean(payload.retryable));
        }
      }
      throw new ProviderError(`Recording "${recording.name}" has no done event`, false);
    },
  };
}
