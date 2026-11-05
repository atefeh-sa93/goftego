// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createChatStore } from "@/lib/store/chat-store";
import { SSEHttpError } from "@/lib/sse/client";
import { fakeServer } from "./helpers/fake-chat-server";
import { createManualScheduler } from "./helpers/manual-scheduler";

function setup() {
  const server = fakeServer();
  const frames = createManualScheduler();
  let id = 0;
  const store = createChatStore({ streamSSE: server.streamSSE, scheduler: frames, createId: () => `m${++id}` });
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return { server, frames, store, state: () => store.getState(), tick };
}

describe("chat store", () => {
  it("send → thinking, with the user message and an empty reply", () => {
    const { store, state, server } = setup();

    store.getState().send("  سلام  ");

    expect(state().status).toBe("thinking");
    expect(state().messages).toEqual([
      { id: "m1", role: "user", content: "سلام" },
      { id: "m2", role: "assistant", content: "" },
    ]);
    expect(server.body.messages).toEqual([{ role: "user", content: "سلام" }]);
  });

  it("ignores an empty message", () => {
    const { store, state, server } = setup();

    store.getState().send("   ");

    expect(state().status).toBe("idle");
    expect(server.calls).toBe(0);
  });

  it("tokens of one frame land in one update, and the status goes to streaming", () => {
    const { store, state, server, frames } = setup();
    store.getState().send("hi");
    let updates = 0;
    store.subscribe(() => updates++);

    server.token("سل");
    server.token("ام");
    expect(state().messages[1]?.content).toBe("");

    frames.runFrame();
    expect(state().messages[1]?.content).toBe("سلام");
    expect(state().status).toBe("streaming");
    // one update for the status, one for the text
    expect(updates).toBe(2);
  });

  it("done flushes the last tokens and ends in done", async () => {
    const { store, state, server, tick } = setup();
    store.getState().send("hi");

    server.token("آخر");
    server.done();
    await tick();

    expect(state().messages[1]?.content).toBe("آخر");
    expect(state().status).toBe("done");
  });

  it("does not send a second message while busy", () => {
    const { store, server } = setup();
    store.getState().send("one");
    store.getState().send("two");

    expect(server.calls).toBe(1);
  });

  it("stop keeps the text so far, aborts the request and ends in aborted", async () => {
    const { store, state, server, frames, tick } = setup();
    store.getState().send("hi");
    server.token("نیمه");
    frames.runFrame();

    store.getState().stop();
    await tick();

    expect(state().status).toBe("aborted");
    expect(server.signal.aborted).toBe(true);
    expect(state().messages[1]?.content).toBe("نیمه");
  });

  it("stop while thinking removes the empty reply", async () => {
    const { store, state, tick } = setup();
    store.getState().send("hi");

    store.getState().stop();
    await tick();

    expect(state().status).toBe("aborted");
    expect(state().messages).toEqual([{ id: "m1", role: "user", content: "hi" }]);
  });

  it("an error event keeps the partial text and stores the error", async () => {
    const { store, state, server, tick } = setup();
    store.getState().send("hi");

    server.token("نیمه");
    server.errorEvent("Can't reach Ollama. Is it running?", true);
    await tick();

    expect(state().status).toBe("error");
    expect(state().error).toEqual({ message: "Can't reach Ollama. Is it running?", retryable: true });
    expect(state().messages[1]?.content).toBe("نیمه");
  });

  it("an HTTP 500 becomes a retryable error and removes the empty reply", async () => {
    const { store, state, server, tick } = setup();
    store.getState().send("hi");

    server.reject(new SSEHttpError(500, ""));
    await tick();

    expect(state().status).toBe("error");
    expect(state().error?.retryable).toBe(true);
    expect(state().messages).toHaveLength(1);
  });

  it("a stream that closes without done is an error", async () => {
    const { store, state, server, tick } = setup();
    store.getState().send("hi");

    server.token("x");
    server.closeEarly();
    await tick();

    expect(state().status).toBe("error");
  });

  it("a late token after done changes nothing", async () => {
    const { store, state, server, frames, tick } = setup();
    store.getState().send("hi");
    server.token("کامل");
    server.done();
    await tick();

    server.token(" جامانده");
    frames.runFrame();

    expect(state().status).toBe("done");
    expect(state().messages[1]?.content).toBe("کامل");
  });

  it("the next send includes the earlier conversation", async () => {
    const { store, server, tick } = setup();
    store.getState().send("اول");
    server.token("جواب");
    server.done();
    await tick();

    store.getState().send("دوم");

    expect(server.body.messages).toEqual([
      { role: "user", content: "اول" },
      { role: "assistant", content: "جواب" },
      { role: "user", content: "دوم" },
    ]);
  });
});
