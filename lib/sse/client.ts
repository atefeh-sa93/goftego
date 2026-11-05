/**
 * Reads a text/event-stream response with fetch + ReadableStream.
 * EventSource can't POST a body, so the chat client uses this instead.
 * No dependencies on the rest of the app.
 */

import { createSSEParser, type SSEEvent } from "./parse";

export class SSEHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`SSE request failed with HTTP ${status}`);
    this.name = "SSEHttpError";
  }
}

export interface StreamSSEOptions extends Omit<RequestInit, "signal"> {
  onEvent: (event: SSEEvent) => void;
  signal?: AbortSignal;
}

/**
 * POSTs (or whatever `init.method` says) and calls `onEvent` for each event
 * until the server closes the stream. Rejects with an AbortError when
 * `signal` aborts, and with SSEHttpError on a non-2xx response.
 */
export async function streamSSE(
  url: string,
  { onEvent, signal, headers, ...init }: StreamSSEOptions,
): Promise<void> {
  const response = await fetch(url, {
    ...init,
    signal,
    headers: { Accept: "text/event-stream", ...headers },
  });
  if (!response.ok) {
    throw new SSEHttpError(response.status, await response.text().catch(() => ""));
  }
  if (!response.body) throw new Error("SSE response has no body");
  await readSSEStream(response.body, onEvent, signal);
}

/** Decodes and parses a byte stream, calling `onEvent` per event. */
export async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  // stream: true keeps a multi-byte character split across chunks intact.
  const decoder = new TextDecoder("utf-8");
  const parser = createSSEParser(onEvent);

  const onAbort = () => {
    reader.cancel(signal?.reason).catch(() => {});
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    signal?.throwIfAborted();
    for (;;) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
    parser.end();
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
