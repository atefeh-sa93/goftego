"use client";

import { useEffect, useRef } from "react";
import { useChat } from "./ChatStoreContext";
import { Message, type MessageState } from "./Message";

// Within this many px of the bottom counts as "at the bottom".
const STICK_THRESHOLD = 80;

export function MessageList() {
  const messages = useChat((s) => s.messages);
  const status = useChat((s) => s.status);
  const error = useChat((s) => s.error);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Follow the reply as it grows, unless the user scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // The live state belongs to the reply of the latest turn only. If that reply
  // was removed (stopped before any text), no older reply may inherit it.
  const lastReplyIndex = messages.at(-1)?.role === "assistant" ? messages.length - 1 : -1;
  const liveState: MessageState =
    status === "thinking" || status === "streaming" || status === "aborted" ? status : null;

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
      }}
      className="flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-195 flex-col gap-7 px-5 py-8">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-24 text-center">
            <p className="text-xl font-bold">چه کمکی از دستم برمی‌آید؟</p>
            <p className="text-sm text-muted">به فارسی یا انگلیسی بپرس.</p>
          </div>
        )}
        {messages.map((message, index) => (
          <Message key={message.id} message={message} state={index === lastReplyIndex ? liveState : null} />
        ))}
        {status === "error" && error && (
          <div role="alert" className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3">
            <p className="text-sm font-medium text-danger">پاسخ کامل نشد</p>
            <p dir="auto" className="text-sm text-danger">
              {error.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
