/**
 * Decides what a key press in the Composer's textarea means.
 * Kept apart from the component so it can be tested without React.
 */

export interface ComposerKey {
  /** KeyboardEvent.key, e.g. "Enter", "a", "Escape". */
  key: string;
  shiftKey: boolean;
  /**
   * True while an input method (IME) is still composing a character,
   * e.g. picking a Japanese or Chinese word. Enter then confirms the word;
   * it must not send the message.
   */
  isComposing: boolean;
}

/** "send": send the message (and stop the newline). "none": let the browser handle the key. */
export type ComposerKeyAction = "send" | "none";

/**
 * Rules:
 * - Enter                    → "send"
 * - Shift+Enter              → "none" (the textarea adds a new line by itself)
 * - Enter while isComposing  → "none"
 * - any other key            → "none"
 */
export function composerKeyAction(event: ComposerKey): ComposerKeyAction {
  if(event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    return "send";
  }
  return "none";
}
