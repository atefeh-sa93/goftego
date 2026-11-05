import type { FrameScheduler } from "@/lib/store/token-buffer";

/** A frame scheduler for tests: frames run only when the test calls runFrame(). */
export function createManualScheduler() {
  let nextHandle = 1;
  const callbacks = new Map<number, () => void>();
  let requested = 0;

  const scheduler: FrameScheduler & { runFrame(): void; readonly requested: number } = {
    request(callback) {
      requested++;
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    },
    cancel(handle) {
      callbacks.delete(handle);
    },
    runFrame() {
      const due = [...callbacks.values()];
      callbacks.clear();
      for (const callback of due) callback();
    },
    get requested() {
      return requested;
    },
  };
  return scheduler;
}
