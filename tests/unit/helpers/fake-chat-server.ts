import type { StreamSSEOptions } from "@/lib/sse/client";

/** A fake /api/chat the test drives by hand. */
export function fakeServer() {
  let options: StreamSSEOptions | undefined;
  let finish: () => void = () => {};
  let fail: (error: unknown) => void = () => {};
  let calls = 0;

  const streamSSE = (_url: string, opts: StreamSSEOptions) => {
    calls++;
    options = opts;
    return new Promise<void>((resolve, reject) => {
      finish = resolve;
      fail = reject;
      opts.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  };

  return {
    streamSSE,
    get calls() {
      return calls;
    },
    get body() {
      return JSON.parse(options!.body as string) as { messages: { role: string; content: string }[] };
    },
    get signal() {
      return options!.signal!;
    },
    token(text: string) {
      options!.onEvent({ event: "token", data: JSON.stringify({ text }) });
    },
    done() {
      options!.onEvent({ event: "done", data: JSON.stringify({ finishReason: "stop" }) });
      finish();
    },
    errorEvent(message: string, retryable: boolean) {
      options!.onEvent({ event: "error", data: JSON.stringify({ message, retryable }) });
      finish();
    },
    closeEarly: () => finish(),
    reject: (error: unknown) => fail(error),
  };
}
