// Tests for YOUR function in lib/providers/sleep.ts.
// Run just these with: pnpm test sleep
//
// vi.useFakeTimers() replaces the real clock: time only moves when the test
// calls vi.advanceTimersByTime(ms), so a 1000 ms wait takes no real time.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "@/lib/providers/sleep";
import { isAbortError } from "@/lib/sse/client";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Lets the test ask "has this promise settled yet?" without awaiting it. */
function track(promise: Promise<void>) {
  const state: { status: "pending" | "resolved" | "rejected"; error?: unknown } = { status: "pending" };
  promise.then(
    () => (state.status = "resolved"),
    (error: unknown) => {
      state.status = "rejected";
      state.error = error;
    },
  );
  return state;
}

describe("sleep", () => {
  it("1. resolves after the given time, not before", async () => {
    const state = track(sleep(1000, new AbortController().signal));

    await vi.advanceTimersByTimeAsync(999);
    expect(state.status).toBe("pending");

    await vi.advanceTimersByTimeAsync(1);
    expect(state.status).toBe("resolved");
  });

  it("2. rejects right away if the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await sleep(1000, controller.signal).catch((e: unknown) => e);

    expect(isAbortError(error)).toBe(true);
  });

  it("3. rejects as soon as the signal aborts mid-wait", async () => {
    const controller = new AbortController();
    const state = track(sleep(1000, controller.signal));

    await vi.advanceTimersByTimeAsync(300);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(state.status).toBe("rejected");
    expect(isAbortError(state.error)).toBe(true);
  });

  it("3. cancels the timer when aborted", async () => {
    const controller = new AbortController();
    sleep(1000, controller.signal).catch(() => {});

    controller.abort();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("4. stops listening to the signal after finishing", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");

    const done = sleep(10, controller.signal);
    await vi.advanceTimersByTimeAsync(10);
    await done;

    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("works with 0 ms", async () => {
    const state = track(sleep(0, new AbortController().signal));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.status).toBe("resolved");
  });
});
