/**
 * The chat's state machine: which status we are in, and which events may
 * move us to another one. Pure and React-free so it is easy to test.
 *
 *   idle ──send──► thinking ──token──► streaming ──done──► done
 *                     │                    │
 *                     ├──error──► error ◄──┤
 *                     └──stop───► aborted ◄┘
 *
 *   done / error / aborted ──send──► thinking
 */

export type ChatStatus = "idle" | "thinking" | "streaming" | "done" | "error" | "aborted";

export type ChatStatusEvent =
  /** The user sends a message. */
  | "send"
  /** A piece of the reply arrived. */
  | "token"
  /** The server said the reply is complete. */
  | "done"
  /** The request or the server failed. */
  | "error"
  /** The user pressed Stop. */
  | "stop";

/** True while a request is in flight (Stop is available). */
export function isBusy(status: ChatStatus): boolean {
  return status === "thinking" || status === "streaming";
}

/**
 * TODO(you): implement this so `pnpm test chat-status` passes.
 *
 * Returns the status after `event`, or `null` when the event is not allowed
 * in that status (the store then ignores it).
 *
 * Rules:
 * - "send":  from idle, done, error or aborted → thinking.
 *            While busy (thinking or streaming) → null: one reply at a time.
 * - "token": thinking → streaming, and streaming stays streaming.
 *            Anywhere else → null (a late token after done must not restart the stream).
 * - "done":  thinking or streaming → done.        Otherwise null.
 * - "error": thinking or streaming → error.       Otherwise null.
 * - "stop":  thinking or streaming → aborted.     Otherwise null.
 *
 * Tip: isBusy() above already answers "thinking or streaming?".
 */
export function nextStatus(status: ChatStatus, event: ChatStatusEvent): ChatStatus | null {
  throw new Error(`nextStatus is not implemented yet (${status} + ${event})`);
}
