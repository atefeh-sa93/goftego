/**
 * Incremental parser for the text/event-stream format.
 * Follows the WHATWG HTML spec, "Parsing an event stream":
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 *
 * Takes already-decoded text in arbitrary chunks. A line or an event may be
 * split across any number of chunks. No dependencies on the rest of the app.
 */

export interface SSEEvent {
  /** Event type; "message" when the stream sends no `event:` field. */
  event: string;
  /** Data lines joined with "\n". */
  data: string;
  /** Last event ID seen so far, if any. */
  id?: string;
}

export interface SSEParser {
  /** Feeds the next chunk of decoded text. */
  feed(chunk: string): void;
  /** Ends the stream. An unterminated trailing event is dropped, per spec. */
  end(): void;
  /** Latest `retry:` value in ms, if the server sent one. */
  readonly retry: number | undefined;
}

export function createSSEParser(onEvent: (event: SSEEvent) => void): SSEParser {
  let buffer = "";
  let isFirstChunk = true;
  // A chunk ending in "\r" may be the first half of "\r\n".
  let skipLeadingLF = false;

  let eventType = "";
  let data = "";
  let lastEventId: string | undefined;
  let retry: number | undefined;

  function dispatch() {
    if (data === "") {
      eventType = "";
      return;
    }
    const event: SSEEvent = {
      event: eventType || "message",
      data: data.endsWith("\n") ? data.slice(0, -1) : data,
    };
    if (lastEventId !== undefined) event.id = lastEventId;
    eventType = "";
    data = "";
    onEvent(event);
  }

  function processLine(line: string) {
    if (line === "") {
      dispatch();
      return;
    }
    if (line.startsWith(":")) return;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    switch (field) {
      case "event":
        eventType = value;
        break;
      case "data":
        data += value + "\n";
        break;
      case "id":
        if (!value.includes("\0")) lastEventId = value;
        break;
      case "retry":
        if (/^\d+$/.test(value)) retry = Number(value);
        break;
      // Unknown fields are ignored.
    }
  }

  return {
    feed(chunk) {
      if (chunk === "") return;
      if (isFirstChunk) {
        isFirstChunk = false;
        if (chunk.startsWith("﻿")) chunk = chunk.slice(1);
      }
      if (skipLeadingLF && chunk.startsWith("\n")) chunk = chunk.slice(1);
      skipLeadingLF = false;

      buffer += chunk;
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i];
        if (ch !== "\r" && ch !== "\n") continue;
        processLine(buffer.slice(start, i));
        if (ch === "\r") {
          if (i + 1 < buffer.length) {
            if (buffer[i + 1] === "\n") i++;
          } else {
            skipLeadingLF = true;
          }
        }
        start = i + 1;
      }
      buffer = buffer.slice(start);
    },
    end() {
      buffer = "";
      eventType = "";
      data = "";
    },
    get retry() {
      return retry;
    },
  };
}
