// Tests for YOUR function in lib/providers/ollama-chunk.ts.
// Run just these with: pnpm test ollama-chunk
import { describe, expect, it } from "vitest";
import { parseOllamaChunk } from "@/lib/providers/ollama-chunk";

// Recorded from a real Ollama (qwen2.5:3b) stream.
const FIRST_TOKEN =
  '{"id":"chatcmpl-254","object":"chat.completion.chunk","created":1793864929,"model":"qwen2.5:3b","system_fingerprint":"fp_ollama","choices":[{"index":0,"delta":{"role":"assistant","content":"سلام"},"finish_reason":null}]}';
const FINISH =
  '{"id":"chatcmpl-254","object":"chat.completion.chunk","created":1793864929,"model":"qwen2.5:3b","system_fingerprint":"fp_ollama","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}';

describe("parseOllamaChunk", () => {
  it("1. [DONE] ends the stream", () => {
    expect(parseOllamaChunk("[DONE]")).toEqual({ type: "end" });
  });

  it("3. a delta with content is a token", () => {
    expect(parseOllamaChunk(FIRST_TOKEN)).toEqual({ type: "token", text: "سلام" });
  });

  it("3. keeps spaces and newlines in the text as they are", () => {
    const data = JSON.stringify({ choices: [{ delta: { content: " دنیا\n" }, finish_reason: null }] });
    expect(parseOllamaChunk(data)).toEqual({ type: "token", text: " دنیا\n" });
  });

  it("4. an empty delta with finish_reason is a finish", () => {
    expect(parseOllamaChunk(FINISH)).toEqual({ type: "finish", reason: "stop" });
  });

  it("4. passes other finish reasons through", () => {
    const data = JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }] });
    expect(parseOllamaChunk(data)).toEqual({ type: "finish", reason: "length" });
  });

  it("5. an empty content string is skipped", () => {
    const data = JSON.stringify({ choices: [{ delta: { content: "" }, finish_reason: null }] });
    expect(parseOllamaChunk(data)).toEqual({ type: "skip" });
  });

  it("5. JSON without choices is skipped", () => {
    expect(parseOllamaChunk('{"object":"ping"}')).toEqual({ type: "skip" });
  });

  it("5. JSON null is skipped instead of crashing", () => {
    expect(parseOllamaChunk("null")).toEqual({ type: "skip" });
  });

  it("6. invalid JSON throws", () => {
    expect(() => parseOllamaChunk("{not json")).toThrow();
  });
});
