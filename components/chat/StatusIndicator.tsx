"use client";

import type { ChatStatus } from "@/lib/store/chat-status";
import { useChat } from "./ChatStoreContext";

const labels: Record<ChatStatus, string> = {
  idle: "آماده",
  thinking: "در حال فکر کردن…",
  streaming: "در حال پاسخ…",
  done: "آماده",
  error: "خطا",
  aborted: "متوقف شد",
};

export function StatusIndicator() {
  const status = useChat((s) => s.status);
  const busy = status === "thinking" || status === "streaming";
  const tone =
    status === "error" ? "bg-danger-soft text-danger" : busy ? "bg-accent-soft text-accent-strong" : "bg-background text-muted";

  return (
    <div data-status={status} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${tone}`}>
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${status === "error" ? "bg-danger" : busy ? "animate-pulse bg-accent" : "bg-border-strong"}`}
      />
      <span>{labels[status]}</span>
    </div>
  );
}
