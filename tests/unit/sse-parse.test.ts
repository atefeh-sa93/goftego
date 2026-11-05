import { describe, expect, it } from "vitest";
import { createSSEParser, type SSEEvent } from "@/lib/sse/parse";

function parseChunks(chunks: string[]) {
  const events: SSEEvent[] = [];
  const parser = createSSEParser((e) => events.push(e));
  for (const chunk of chunks) parser.feed(chunk);
  return { events, parser };
}

describe("createSSEParser", () => {
  it("parses a named event with JSON data", () => {
    const { events } = parseChunks(['event: token\ndata: {"text":"سلام"}\n\n']);
    expect(events).toEqual([{ event: "token", data: '{"text":"سلام"}' }]);
  });

  it("defaults the event type to message", () => {
    const { events } = parseChunks(["data: hi\n\n"]);
    expect(events).toEqual([{ event: "message", data: "hi" }]);
  });

  it("joins one event split across many chunks", () => {
    const { events } = parseChunks(["ev", "ent: tok", "en\nda", "ta: {\"te", 'xt":"a"}', "\n", "\n"]);
    expect(events).toEqual([{ event: "token", data: '{"text":"a"}' }]);
  });

  it("splits many events in one chunk", () => {
    const { events } = parseChunks([
      "event: token\ndata: a\n\nevent: token\ndata: b\n\nevent: done\ndata: {}\n\n",
    ]);
    expect(events.map((e) => [e.event, e.data])).toEqual([
      ["token", "a"],
      ["token", "b"],
      ["done", "{}"],
    ]);
  });

  it("feeds one character at a time", () => {
    const text = "event: token\r\ndata: x\r\n\r\nevent: done\rdata: y\r\r";
    const { events } = parseChunks([...text]);
    expect(events.map((e) => [e.event, e.data])).toEqual([
      ["token", "x"],
      ["done", "y"],
    ]);
  });

  it("treats \\r\\n split across chunks as one line break", () => {
    const { events } = parseChunks(["data: a\r", "\ndata: b\r", "\n\r", "\n"]);
    expect(events).toEqual([{ event: "message", data: "a\nb" }]);
  });

  it("joins multiple data lines with \\n", () => {
    const { events } = parseChunks(["data: line 1\ndata:line 2\ndata\n\n"]);
    expect(events[0]?.data).toBe("line 1\nline 2\n");
  });

  it("strips only one leading space from a value", () => {
    const { events } = parseChunks(["data:   indented\n\n"]);
    expect(events[0]?.data).toBe("  indented");
  });

  it("ignores comments and unknown fields", () => {
    const { events } = parseChunks([": keep-alive\nfoo: bar\ndata: x\n\n"]);
    expect(events).toEqual([{ event: "message", data: "x" }]);
  });

  it("does not dispatch an event without data", () => {
    const { events } = parseChunks(["event: ping\n\ndata: x\n\n"]);
    expect(events).toEqual([{ event: "message", data: "x" }]);
  });

  it("keeps the last event id and reads retry", () => {
    const { events, parser } = parseChunks(["id: 1\ndata: a\n\ndata: b\n\nretry: 3000\nretry: soon\n"]);
    expect(events.map((e) => e.id)).toEqual(["1", "1"]);
    expect(parser.retry).toBe(3000);
  });

  it("strips a leading BOM", () => {
    const { events } = parseChunks(["﻿data: x\n\n"]);
    expect(events).toEqual([{ event: "message", data: "x" }]);
  });

  it("drops an unterminated event at end of stream", () => {
    const { events, parser } = parseChunks(["data: complete\n\ndata: partial"]);
    parser.end();
    expect(events).toEqual([{ event: "message", data: "complete" }]);
  });
});
