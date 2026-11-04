// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAbortError, readSSEStream, SSEHttpError, streamSSE } from "@/lib/sse/client";
import type { SSEEvent } from "@/lib/sse/parse";

const encoder = new TextEncoder();

function byteStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readSSEStream", () => {
  it("decodes a Persian character split across two chunks", async () => {
    const bytes = encoder.encode('event: token\ndata: {"text":"سلام"}\n\n');
    // "س" is two bytes in UTF-8; cut between them.
    const cut = bytes.indexOf(0xd8) + 1;
    const events: SSEEvent[] = [];

    await readSSEStream(byteStream([bytes.slice(0, cut), bytes.slice(cut)]), (e) => events.push(e));

    expect(events).toEqual([{ event: "token", data: '{"text":"سلام"}' }]);
  });

  it("decodes byte-by-byte chunks", async () => {
    const bytes = encoder.encode("data: گفتگو 👋\n\n");
    const events: SSEEvent[] = [];

    await readSSEStream(byteStream([...bytes].map((b) => Uint8Array.of(b))), (e) => events.push(e));

    expect(events[0]?.data).toBe("گفتگو 👋");
  });

  it("stops and rejects with AbortError when aborted mid-stream", async () => {
    const controller = new AbortController();
    const events: SSEEvent[] = [];
    let sent = false;
    // Sends one event, then stays open like a model still generating.
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (!sent) {
          sent = true;
          c.enqueue(encoder.encode("data: first\n\n"));
        }
        return new Promise(() => {});
      },
    });

    const done = readSSEStream(body, (e) => {
      events.push(e);
      controller.abort();
    }, controller.signal);

    const error = await done.catch((e: unknown) => e);
    expect(isAbortError(error)).toBe(true);
    expect(events).toHaveLength(1);
  });
});

describe("streamSSE", () => {
  it("sends Accept: text/event-stream and streams events", async () => {
    const fetchMock = vi.fn(async () => new Response(byteStream([encoder.encode("data: ok\n\n")])));
    vi.stubGlobal("fetch", fetchMock);
    const events: SSEEvent[] = [];

    await streamSSE("/api/chat", {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
      onEvent: (e) => events.push(e),
    });

    expect(events).toEqual([{ event: "message", data: "ok" }]);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toEqual({ Accept: "text/event-stream", "Content-Type": "application/json" });
  });

  it("throws SSEHttpError on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("model offline", { status: 503 })));

    const error = await streamSSE("/api/chat", { onEvent: () => {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SSEHttpError);
    expect(error).toMatchObject({ status: 503, body: "model offline" });
  });
});
