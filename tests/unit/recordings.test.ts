// @vitest-environment node
// Checks the real files in mocks/recordings, so a bad re-recording fails CI.
import { describe, expect, it } from "vitest";
import { loadRecordings, RECORDING_NAMES } from "@/lib/providers/recordings";
import { createSSEParser, type SSEEvent } from "@/lib/sse/parse";

function parse(sse: string) {
  const events: SSEEvent[] = [];
  const parser = createSSEParser((e) => events.push(e));
  parser.feed(sse);
  parser.end();
  return events;
}

const recordings = await loadRecordings();

describe("mocks/recordings", () => {
  it("has every recording the mock plays", () => {
    expect(recordings.map((r) => r.name)).toEqual([...RECORDING_NAMES]);
  });

  it.each(recordings)("$name is tokens followed by one done", ({ sse }) => {
    const events = parse(sse);
    const last = events.at(-1);

    expect(events.length).toBeGreaterThan(10);
    expect(events.slice(0, -1).every((e) => e.event === "token")).toBe(true);
    expect(last?.event).toBe("done");
    for (const e of events) expect(() => JSON.parse(e.data)).not.toThrow();
  });

  it("code has a fenced code block", () => {
    const code = recordings.find((r) => r.name === "code")!;
    const text = parse(code.sse)
      .filter((e) => e.event === "token")
      .map((e) => (JSON.parse(e.data) as { text: string }).text)
      .join("");

    expect(text).toMatch(/^```\w+\n[\s\S]+?\n```/m);
  });
});
