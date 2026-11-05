import { describe, expect, it, vi } from "vitest";
import { createTokenBuffer } from "@/lib/store/token-buffer";
import { createManualScheduler } from "./helpers/manual-scheduler";

describe("createTokenBuffer", () => {
  it("hands over all tokens of one frame at once", () => {
    const frames = createManualScheduler();
    const flushed: string[] = [];
    const buffer = createTokenBuffer((t) => flushed.push(t), frames);

    buffer.push("سل");
    buffer.push("ام");
    buffer.push(" دنیا");
    expect(flushed).toEqual([]);

    frames.runFrame();
    expect(flushed).toEqual(["سلام دنیا"]);
  });

  it("schedules only one frame however many tokens arrive", () => {
    const frames = createManualScheduler();
    const buffer = createTokenBuffer(() => {}, frames);

    for (let i = 0; i < 100; i++) buffer.push("x");

    expect(frames.requested).toBe(1);
  });

  it("starts a new batch after each frame", () => {
    const frames = createManualScheduler();
    const flushed: string[] = [];
    const buffer = createTokenBuffer((t) => flushed.push(t), frames);

    buffer.push("a");
    frames.runFrame();
    buffer.push("b");
    buffer.push("c");
    frames.runFrame();

    expect(flushed).toEqual(["a", "bc"]);
  });

  it("flush() hands over immediately and cancels the frame", () => {
    const frames = createManualScheduler();
    const flushed: string[] = [];
    const buffer = createTokenBuffer((t) => flushed.push(t), frames);

    buffer.push("last words");
    buffer.flush();
    frames.runFrame();

    expect(flushed).toEqual(["last words"]);
  });

  it("dispose() drops buffered text", () => {
    const frames = createManualScheduler();
    const flushed: string[] = [];
    const buffer = createTokenBuffer((t) => flushed.push(t), frames);

    buffer.push("lost");
    buffer.dispose();
    frames.runFrame();

    expect(flushed).toEqual([]);
  });

  it("uses requestAnimationFrame by default", () => {
    const raf = vi.fn<(cb: FrameRequestCallback) => number>(() => 7);
    vi.stubGlobal("requestAnimationFrame", raf);

    createTokenBuffer(() => {}).push("x");

    expect(raf).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
