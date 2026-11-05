/**
 * Translates the `data:` of one SSE event from Ollama's OpenAI-compatible
 * stream into something simple. Ollama sends lines like these:
 *
 *   data: {"id":"chatcmpl-254", ..., "choices":[{"index":0,"delta":{"role":"assistant","content":"سلام"},"finish_reason":null}]}
 *   data: {"id":"chatcmpl-254", ..., "choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}
 *   data: [DONE]
 *
 * (The full samples are in tests/unit/ollama-chunk.test.ts.)
 */

export type OllamaChunk =
  /** The chunk carries text to show. */
  | { type: "token"; text: string }
  /** The model finished; `reason` is finish_reason, e.g. "stop" or "length". */
  | { type: "finish"; reason: string }
  /** `[DONE]`: the stream is over. */
  | { type: "end" }
  /** Nothing useful in it (for example an empty delta). */
  | { type: "skip" };

/**
 * Rules, in order:
 * 1. data === "[DONE]"                     → { type: "end" }
 * 2. Otherwise data is JSON. Look at choices[0].
 * 3. delta.content is a non-empty string   → { type: "token", text: delta.content }
 * 4. finish_reason is a string             → { type: "finish", reason: finish_reason }
 * 5. Anything else                         → { type: "skip" }
 * 6. data that is not valid JSON           → throw an Error
 *
 * Tip: JSON.parse returns `any`. Treat it as `unknown` and check each step
 * (`?.` helps), because TypeScript can't check what the network sends.
 */
export function parseOllamaChunk(data: string): OllamaChunk {
  if (data === "[DONE]") {
    return {type: "end"};
  }

  const json: unknown = JSON.parse(data);
  const choice = (json as { choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[] })?.choices?.[0];

  if(typeof choice !== "object" || choice === null) {
    return {type: "skip"};
  }
  if(typeof choice?.delta?.content === "string" && choice.delta.content.length > 0) {
    return {type: "token", text: choice.delta.content};
  }
  if (typeof choice?.finish_reason === "string") {
    return {type: "finish", reason: choice.finish_reason};
  }
  return {type: "skip"};
}
