/**
 * The body of POST /api/chat, kept apart from route.ts so tests can pass in
 * a fake provider. Validates the request, calls the provider, and translates
 * what it produces into our SSE events (see protocol.ts).
 */
import { z } from "zod";
import type { ChatProvider } from "@/lib/providers/types";
import { ProviderError } from "@/lib/providers/types";
import { isAbortError } from "@/lib/sse/client";
import { formatSSE } from "@/lib/sse/format";
import { chatRequestSchema, type ChatStreamEvent } from "./protocol";
import { SYSTEM_PROMPT } from "./system-prompt";

export function createChatHandler(getProvider: () => ChatProvider) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
    }

    const provider = getProvider();
    const messages = [{ role: "system" as const, content: SYSTEM_PROMPT }, ...parsed.data.messages];

    // Aborts the request to the model when the browser goes away, whether
    // Next reports it through request.signal or by cancelling our stream.
    const upstream = new AbortController();
    request.signal.addEventListener("abort", () => upstream.abort(), { once: true });

    const encoder = new TextEncoder();
    let closed = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (e: ChatStreamEvent) => {
          if (closed) return;
          controller.enqueue(encoder.encode(formatSSE(e.event, JSON.stringify(e.data))));
        };

        try {
          const { finishReason } = await provider.streamChat(messages, {
            signal: upstream.signal,
            onToken: (text) => send({ event: "token", data: { text } }),
          });
          send({ event: "done", data: { finishReason } });
        } catch (error) {
          if (!(isAbortError(error) || upstream.signal.aborted)) {
            const retryable = error instanceof ProviderError ? error.retryable : false;
            const message = error instanceof Error ? error.message : "Unknown error";
            send({ event: "error", data: { message, retryable } });
          }
        } finally {
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      },
      cancel() {
        closed = true;
        upstream.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        // Stops proxies such as nginx from buffering the stream.
        "X-Accel-Buffering": "no",
      },
    });
  };
}
