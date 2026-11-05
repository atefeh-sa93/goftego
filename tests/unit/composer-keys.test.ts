// Tests for YOUR function in components/chat/composer-keys.ts.
// Run just these with: pnpm test composer-keys
import { describe, expect, it } from "vitest";
import { type ComposerKey, composerKeyAction } from "@/components/chat/composer-keys";

const press = (key: string, extra: Partial<ComposerKey> = {}): ComposerKey => ({
  key,
  shiftKey: false,
  isComposing: false,
  ...extra,
});

describe("composerKeyAction", () => {
  it("Enter sends", () => {
    expect(composerKeyAction(press("Enter"))).toBe("send");
  });

  it("Shift+Enter makes a new line", () => {
    expect(composerKeyAction(press("Enter", { shiftKey: true }))).toBe("none");
  });

  it("Enter while an IME is composing does not send", () => {
    expect(composerKeyAction(press("Enter", { isComposing: true }))).toBe("none");
  });

  it.each(["a", "س", " ", "Backspace", "Escape", "Tab"])("%j does nothing special", (key) => {
    expect(composerKeyAction(press(key))).toBe("none");
  });

  it("Shift on another key does nothing special", () => {
    expect(composerKeyAction(press("A", { shiftKey: true }))).toBe("none");
  });
});
