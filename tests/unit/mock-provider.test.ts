// @vitest-environment node
// Uses sleep, so these pass once that function is implemented.
import { describe, expect, it } from "vitest";
import { formatSSE } from "@/lib/sse/format";
import { isAbortError } from "@/lib/sse/client";
import { createMockProvider, type Recording } from "@/lib/providers/mock";
import { ProviderError } from "@/lib/providers/types";

const token = (text: string) => formatSSE("token", JSON.stringify({ text }));
const done = formatSSE("done", JSON.stringify({ finishReason: "stop" }));

const hello: Recording = { name: "hello", sse: token("سل") + token("ام") + done };
const world: Recording = { name: "world", sse: token("world") + done };

const noDelay = { min: 0, max: 0 };
const play = (provider: ReturnType<typeof createMockProvider>, signal = new AbortController().signal) => {
  const tokens: string[] = [];
  return provider.streamChat([], { signal, onToken: (t) => tokens.push(t) }).then((r) => ({ ...r, tokens }));
};

describe("mock provider", () => {
  it("replays a recording token by token", async () => {
    const provider = createMockProvider({ recordings: [hello], delay: noDelay });

    expect(await play(provider)).toEqual({ finishReason: "stop", tokens: ["سل", "ام"] });
  });

  it("plays recordings in turn and starts over", async () => {
    const provider = createMockProvider({ recordings: [hello, world], delay: noDelay });

    const replies = [];
    for (let i = 0; i < 3; i++) replies.push((await play(provider)).tokens.join(""));

    expect(replies).toEqual(["سلام", "world", "سلام"]);
  });

  it("picks each pause between min and max", async () => {
    const values = [0, 1];
    const provider = createMockProvider({
      recordings: [hello],
      delay: { min: 1, max: 3 },
      random: () => values.shift() ?? 0,
    });
    const started = Date.now();

    await play(provider);

    // pauses of 1 ms and 3 ms
    expect(Date.now() - started).toBeGreaterThanOrEqual(3);
  });

  it("stops when aborted mid-replay", async () => {
    const provider = createMockProvider({ recordings: [hello], delay: { min: 50, max: 50 } });
    const controller = new AbortController();
    const tokens: string[] = [];

    const replay = provider.streamChat([], { signal: controller.signal, onToken: (t) => tokens.push(t) });
    setTimeout(() => controller.abort(), 70);
    const error = await replay.catch((e: unknown) => e);

    expect(isAbortError(error)).toBe(true);
    expect(tokens).toEqual(["سل"]);
  });

  it("turns a recorded error event into a ProviderError", async () => {
    const failing: Recording = {
      name: "failing",
      sse: token("نیمه") + formatSSE("error", JSON.stringify({ message: "boom", retryable: true })),
    };
    const provider = createMockProvider({ recordings: [failing], delay: noDelay });

    const error = await play(provider).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ message: "boom", retryable: true });
  });

  it("needs at least one recording", () => {
    expect(() => createMockProvider({ recordings: [] })).toThrow();
  });
});
