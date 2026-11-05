// Tests for YOUR function in lib/store/chat-status.ts.
// Run just these with: pnpm test chat-status
import { describe, expect, it } from "vitest";
import { type ChatStatus, type ChatStatusEvent, nextStatus } from "@/lib/store/chat-status";

// Every status × every event. `null` means "not allowed, ignore it".
const table: Record<ChatStatus, Record<ChatStatusEvent, ChatStatus | null>> = {
  idle: { send: "thinking", token: null, done: null, error: null, stop: null },
  thinking: { send: null, token: "streaming", done: "done", error: "error", stop: "aborted" },
  streaming: { send: null, token: "streaming", done: "done", error: "error", stop: "aborted" },
  done: { send: "thinking", token: null, done: null, error: null, stop: null },
  error: { send: "thinking", token: null, done: null, error: null, stop: null },
  aborted: { send: "thinking", token: null, done: null, error: null, stop: null },
};

const cases = Object.entries(table).flatMap(([status, events]) =>
  Object.entries(events).map(([event, expected]) => ({
    status: status as ChatStatus,
    event: event as ChatStatusEvent,
    expected,
  })),
);

describe("nextStatus", () => {
  it.each(cases)("$status + $event → $expected", ({ status, event, expected }) => {
    expect(nextStatus(status, event)).toBe(expected);
  });

  it("a full happy path ends in done", () => {
    let status: ChatStatus = "idle";
    for (const event of ["send", "token", "token", "done"] as const) {
      status = nextStatus(status, event) ?? status;
    }
    expect(status).toBe("done");
  });

  it("a late token after done is rejected", () => {
    expect(nextStatus("done", "token")).toBeNull();
  });
});
