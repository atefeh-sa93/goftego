/**
 * The contract between the browser and /api/chat: what the browser POSTs,
 * and the SSE events the route sends back. Documented in the README.
 */
import { z } from "zod";

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        // "system" is not accepted from the browser; the route adds its own.
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(200),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = ChatRequest["messages"][number];

export type ChatStreamEvent =
  | { event: "token"; data: { text: string } }
  | { event: "done"; data: { finishReason: string } }
  | { event: "error"; data: { message: string; retryable: boolean } };
