// @vitest-environment node
// Uses parseOllamaChunk, so these pass once that function is implemented.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOllamaProvider } from "@/lib/providers/ollama";
import { ProviderError } from "@/lib/providers/types";

const provider = createOllamaProvider({ baseUrl: "http://ollama.test/v1", model: "qwen2.5:3b" });
const encoder = new TextEncoder();

function ollamaStream(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

const token = (content: string) => JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] });
const finish = (reason: string) => JSON.stringify({ choices: [{ delta: {}, finish_reason: reason }] });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ollama provider", () => {
  it("streams tokens and returns the finish reason", async () => {
    const fetchMock = vi.fn(async () => ollamaStream([token("سل"), token("ام"), finish("stop"), "[DONE]"]));
    vi.stubGlobal("fetch", fetchMock);
    const tokens: string[] = [];

    const result = await provider.streamChat([{ role: "user", content: "سلام" }], {
      signal: new AbortController().signal,
      onToken: (t) => tokens.push(t),
    });

    expect(tokens).toEqual(["سل", "ام"]);
    expect(result).toEqual({ finishReason: "stop" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://ollama.test/v1/chat/completions");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "qwen2.5:3b", stream: true });
  });

  it("passes the abort signal to fetch", async () => {
    const fetchMock = vi.fn(async () => ollamaStream(["[DONE]"]));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await provider.streamChat([], { signal: controller.signal, onToken: () => {} });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it("explains a missing model and marks it not retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("model not found", { status: 404 })));

    const error = await provider
      .streamChat([], { signal: new AbortController().signal, onToken: () => {} })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ retryable: false });
    expect((error as Error).message).toContain("ollama pull qwen2.5:3b");
  });

  it("marks an unreachable Ollama as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));

    const error = await provider
      .streamChat([], { signal: new AbortController().signal, onToken: () => {} })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ name: "ProviderError", retryable: true });
  });

  it("treats a stream cut off before the end as a retryable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ollamaStream([token("نیمه")])));

    const error = await provider
      .streamChat([], { signal: new AbortController().signal, onToken: () => {} })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ name: "ProviderError", retryable: true });
  });
});
