"use client";

import { type FormEvent, type KeyboardEvent, useState } from "react";
import { isBusy } from "@/lib/store/chat-status";
import { useChat } from "./ChatStoreContext";
import { composerKeyAction } from "./composer-keys";

export function Composer() {
  const busy = useChat((s) => isBusy(s.status));
  const send = useChat((s) => s.send);
  const stop = useChat((s) => s.stop);
  const [text, setText] = useState("");

  // Typing is allowed while a reply streams; sending waits until it ends.
  function submit() {
    if (busy || text.trim() === "") return;
    send(text);
    setText("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const action = composerKeyAction({
      key: e.key,
      shiftKey: e.shiftKey,
      isComposing: e.nativeEvent.isComposing,
    });
    if (action === "send") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-195 flex-col gap-2 px-5 pt-3 pb-5">
      <div className="flex items-end gap-2.5 rounded-2xl border border-border-strong bg-surface py-2.5 ps-3.5 pe-2.5">
        <label htmlFor="composer" className="sr-only">
          پیام
        </label>
        <textarea
          id="composer"
          dir="auto"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="پیام بنویس…"
          className="max-h-40 flex-1 resize-none bg-transparent py-2 text-[15px] leading-7 outline-none field-sizing-content"
        />
        {busy ? (
          <button
            type="button"
            onClick={stop}
            className="flex h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm text-white"
          >
            <span aria-hidden="true" className="size-3 rounded-xs bg-white" />
            توقف
          </button>
        ) : (
          <button
            type="submit"
            disabled={text.trim() === ""}
            className="h-11 rounded-xl bg-accent px-4 text-sm text-white disabled:opacity-40"
          >
            ارسال
          </button>
        )}
      </div>
      <p className="text-xs text-muted">Enter برای ارسال · Shift+Enter برای خط جدید</p>
    </form>
  );
}
