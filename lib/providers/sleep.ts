/**
 * Waits `ms` milliseconds, unless `signal` aborts first.
 * The mock provider uses it between tokens so a replay feels like a real
 * model, and so Stop interrupts the replay right away.
 */

/**
 * Rules:
 * 1. Return a Promise that resolves (with no value) after `ms` milliseconds.
 * 2. If `signal` is already aborted, reject right away with `signal.reason`.
 * 3. If `signal` aborts while waiting, reject right away with `signal.reason`,
 *    and cancel the timer so it never fires later.
 * 4. When the wait finishes normally, stop listening to `signal`.
 *
 * Tools you need:
 * - new Promise((resolve, reject) => { ... })
 * - setTimeout(fn, ms) returns an id; clearTimeout(id) cancels it
 * - signal.aborted, signal.reason
 * - signal.addEventListener("abort", fn, { once: true }) and removeEventListener
 *
 * `signal.reason` is a DOMException named "AbortError" when someone calls
 * controller.abort() without an argument — that is what the rest of the app
 * checks for with isAbortError().
 */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timer = setTimeout(() => {
      resolve();
      signal.removeEventListener("abort", onAbort);
    }, ms);
    
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    }

    signal.addEventListener('abort', onAbort, { once: true });

  })
}
