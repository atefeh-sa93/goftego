/**
 * Collects tokens and hands them over at most once per animation frame,
 * so a fast stream causes one store update (and one render) per frame
 * instead of one per token.
 */

export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export const animationFrameScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export interface TokenBuffer {
  push(text: string): void;
  /** Hands over whatever is buffered right now, e.g. before done or stop. */
  flush(): void;
  /** Drops the buffer and any scheduled frame. */
  dispose(): void;
}

export function createTokenBuffer(
  onFlush: (text: string) => void,
  scheduler: FrameScheduler = animationFrameScheduler,
): TokenBuffer {
  let pending = "";
  let frame: number | null = null;

  function flush() {
    if (frame !== null) {
      scheduler.cancel(frame);
      frame = null;
    }
    if (pending === "") return;
    const text = pending;
    pending = "";
    onFlush(text);
  }

  return {
    push(text) {
      pending += text;
      frame ??= scheduler.request(() => {
        frame = null;
        flush();
      });
    },
    flush,
    dispose() {
      if (frame !== null) scheduler.cancel(frame);
      frame = null;
      pending = "";
    },
  };
}
