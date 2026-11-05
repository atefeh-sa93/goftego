import { describe, expect, it } from "vitest";
import { formatSSE } from "@/lib/sse/format";
import { createSSEParser, type SSEEvent } from "@/lib/sse/parse";

describe("formatSSE", () => {
  it("writes an event and its data, ending with a blank line", () => {
    expect(formatSSE("token", '{"text":"سلام"}')).toBe('event: token\ndata: {"text":"سلام"}\n\n');
  });

  it("splits multi-line data into data lines", () => {
    expect(formatSSE("message", "a\nb")).toBe("event: message\ndata: a\ndata: b\n\n");
  });

  it("round-trips through the parser", () => {
    const events: SSEEvent[] = [];
    const parser = createSSEParser((e) => events.push(e));
    parser.feed(formatSSE("token", "line 1\nline 2") + formatSSE("done", "{}"));
    expect(events).toEqual([
      { event: "token", data: "line 1\nline 2" },
      { event: "done", data: "{}" },
    ]);
  });

  it("rejects an event name with a line break", () => {
    expect(() => formatSSE("bad\nname", "x")).toThrow();
  });
});
