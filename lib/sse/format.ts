/**
 * Serializes one event in text/event-stream format — the inverse of parse.ts.
 * No dependencies on the rest of the app.
 */
export function formatSSE(event: string, data: string): string {
  if (/[\r\n]/.test(event)) throw new Error("SSE event name must not contain line breaks");
  // Each line of data needs its own `data:` field; the parser joins them back with "\n".
  const dataLines = data
    .split(/\r\n|\r|\n/)
    .map((line) => `data: ${line}`)
    .join("\n");
  return `event: ${event}\n${dataLines}\n\n`;
}
