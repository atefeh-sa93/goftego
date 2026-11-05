"use client";

import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { StatusIndicator } from "./StatusIndicator";

export function ChatPanel() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3.5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold">گفتگو</h1>
          <span dir="ltr" className="text-sm text-muted">
            Goftego
          </span>
        </div>
        <StatusIndicator />
      </header>
      <MessageList />
      <Composer />
    </div>
  );
}
