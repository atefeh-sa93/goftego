"use client";

import { memo } from "react";
import type { ChatUIMessage } from "@/lib/store/chat-store";

export type MessageState = "thinking" | "streaming" | "aborted" | null;

interface MessageProps {
  message: ChatUIMessage;
  /** Only the latest reply has a live state; finished ones get null. */
  state: MessageState;
}

/** Memoized: while a reply streams, earlier messages keep the same props and skip rendering. */
export const Message = memo(function Message({ message, state }: MessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-start">
        <p
          dir="auto"
          className="max-w-4/5 rounded-2xl rounded-es-sm bg-foreground px-4 py-3 text-[15px] leading-7 whitespace-pre-wrap text-white"
        >
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <article aria-label="پاسخ دستیار" className="flex flex-col gap-2">
      {state === "thinking" && message.content === "" ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden="true" className="flex gap-1">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
          </span>
          در حال فکر کردن…
        </p>
      ) : (
        <p dir="auto" className="text-[15px] leading-8 whitespace-pre-wrap">
          {message.content}
          {state === "streaming" && (
            <span
              aria-hidden="true"
              data-testid="caret"
              className="ms-0.5 inline-block h-4.5 w-2 animate-blink rounded-xs bg-accent align-[-3px]"
            />
          )}
        </p>
      )}
      {state === "aborted" && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden="true" className="size-3 rounded-xs bg-muted" />
          متوقف شد
        </p>
      )}
    </article>
  );
});
