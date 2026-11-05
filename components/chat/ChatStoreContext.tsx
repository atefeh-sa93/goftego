"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useStore } from "zustand";
import { type ChatState, type ChatStore, chatStore } from "@/lib/store/chat-store";

// Defaults to the app's store; tests pass their own.
const ChatStoreContext = createContext<ChatStore>(chatStore);

export function ChatStoreProvider({ store, children }: { store: ChatStore; children: ReactNode }) {
  return <ChatStoreContext value={store}>{children}</ChatStoreContext>;
}

/** `const status = useChat((s) => s.status)` — re-renders only when the selected value changes. */
export function useChat<T>(selector: (state: ChatState) => T): T {
  return useStore(useContext(ChatStoreContext), selector);
}
