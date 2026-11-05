/**
 * The chat's memory: messages, the current status, and the two actions the
 * UI calls (send, stop). Streams replies from /api/chat with lib/sse and
 * moves the status only through nextStatus(), so impossible transitions
 * (a late token after done, a second send while busy) are ignored.
 */
import { createStore } from "zustand";
import type { ChatStreamEvent } from "@/lib/chat/protocol";
import { isAbortError, SSEHttpError, streamSSE } from "@/lib/sse/client";
import { type ChatStatus, type ChatStatusEvent, isBusy, nextStatus } from "./chat-status";
import { animationFrameScheduler, createTokenBuffer, type FrameScheduler, type TokenBuffer } from "./token-buffer";

export interface ChatUIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ChatError {
  message: string;
  retryable: boolean;
}

export interface ChatState {
  messages: ChatUIMessage[];
  status: ChatStatus;
  error: ChatError | null;
  send(text: string): void;
  stop(): void;
}

export interface ChatStoreDeps {
  streamSSE?: typeof streamSSE;
  scheduler?: FrameScheduler;
  createId?: () => string;
  endpoint?: string;
}

export function createChatStore({
  streamSSE: stream = streamSSE,
  scheduler = animationFrameScheduler,
  createId = () => crypto.randomUUID(),
  endpoint = "/api/chat",
}: ChatStoreDeps = {}) {
  // One request at a time; anything from an older request is ignored.
  let current: { controller: AbortController; buffer: TokenBuffer; replyId: string } | null = null;

  return createStore<ChatState>()((set, get) => {
    function move(event: ChatStatusEvent): boolean {
      const next = nextStatus(get().status, event);
      if (next === null) return false;
      set({ status: next });
      return true;
    }

    function appendToReply(replyId: string, text: string) {
      set({
        messages: get().messages.map((m) => (m.id === replyId ? { ...m, content: m.content + text } : m)),
      });
    }

    function removeIfEmpty(replyId: string) {
      const reply = get().messages.find((m) => m.id === replyId);
      if (reply && reply.content === "") {
        set({ messages: get().messages.filter((m) => m.id !== replyId) });
      }
    }

    function fail(error: ChatError) {
      if (move("error")) set({ error });
    }

    async function run(request: NonNullable<typeof current>, history: ChatUIMessage[]) {
      const isCurrent = () => current === request;

      const handle = (event: ChatStreamEvent) => {
        if (!isCurrent()) return;
        switch (event.event) {
          case "token":
            request.buffer.push(event.data.text);
            break;
          case "done":
            request.buffer.flush();
            move("done");
            break;
          case "error":
            request.buffer.flush();
            fail(event.data);
            break;
        }
      };

      try {
        await stream(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
          signal: request.controller.signal,
          onEvent: ({ event, data }) => handle({ event, data: JSON.parse(data) } as ChatStreamEvent),
        });
        if (isCurrent() && isBusy(get().status)) {
          request.buffer.flush();
          fail({ message: "The connection closed before the reply finished", retryable: true });
        }
      } catch (error) {
        if (!isCurrent() || isAbortError(error)) return;
        request.buffer.flush();
        if (error instanceof SSEHttpError) {
          fail({ message: `Request failed with HTTP ${error.status}`, retryable: error.status >= 500 });
        } else {
          fail({ message: "Network error. Check your connection.", retryable: true });
        }
      } finally {
        if (isCurrent()) {
          request.buffer.dispose();
          removeIfEmpty(request.replyId);
          current = null;
        }
      }
    }

    return {
      messages: [],
      status: "idle",
      error: null,

      send(text) {
        const content = text.trim();
        if (content === "" || !move("send")) return;

        const userMessage: ChatUIMessage = { id: createId(), role: "user", content };
        const reply: ChatUIMessage = { id: createId(), role: "assistant", content: "" };
        // Earlier replies that were stopped before any text are already removed.
        const history = [...get().messages, userMessage];
        set({ messages: [...history, reply], error: null });

        const request = {
          controller: new AbortController(),
          replyId: reply.id,
          buffer: createTokenBuffer((chunk) => {
            // nextStatus refuses a token after done/stop, so nothing is appended then.
            if (current === request && move("token")) appendToReply(reply.id, chunk);
          }, scheduler),
        };
        current = request;
        void run(request, history);
      },

      stop() {
        const request = current;
        if (!request || !isBusy(get().status)) return;
        // Keep what has arrived so far, then stop.
        request.buffer.flush();
        move("stop");
        request.controller.abort();
        request.buffer.dispose();
        removeIfEmpty(request.replyId);
        current = null;
      },
    };
  });
}

export type ChatStore = ReturnType<typeof createChatStore>;

/** The app's one store. Components reach it through ChatStoreProvider. */
export const chatStore = createChatStore();
