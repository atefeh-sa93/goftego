import { act, fireEvent, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { describe, expect, it } from "vitest";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ChatStoreProvider } from "@/components/chat/ChatStoreContext";
import { createChatStore } from "@/lib/store/chat-store";
import { fakeServer } from "./helpers/fake-chat-server";
import { createManualScheduler } from "./helpers/manual-scheduler";

function setup() {
  const server = fakeServer();
  const frames = createManualScheduler();
  let id = 0;
  const store = createChatStore({ streamSSE: server.streamSSE, scheduler: frames, createId: () => `m${++id}` });
  let renders = 0;
  render(
    <ChatStoreProvider store={store}>
      <Profiler id="chat" onRender={() => renders++}>
        <ChatPanel />
      </Profiler>
    </ChatStoreProvider>,
  );
  const textbox = () => screen.getByRole("textbox", { name: "پیام" });
  const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));
  return {
    server,
    store,
    textbox,
    settle,
    runFrame: () => act(() => frames.runFrame()),
    rendersSoFar: () => renders,
    type: (text: string) => fireEvent.change(textbox(), { target: { value: text } }),
  };
}

describe("ChatPanel", () => {
  it("starts empty with a disabled send button", () => {
    setup();
    expect(screen.getByText("چه کمکی از دستم برمی‌آید؟")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ارسال" })).toBeDisabled();
  });

  it("send button sends, clears the box, and shows thinking", () => {
    const { server, textbox, type } = setup();

    type("سلام");
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));

    expect(server.body.messages).toEqual([{ role: "user", content: "سلام" }]);
    expect(textbox()).toHaveValue("");
    expect(screen.getByText("سلام")).toBeInTheDocument();
    expect(screen.getAllByText("در حال فکر کردن…")).toHaveLength(2); // header + message
    expect(screen.getByRole("button", { name: "توقف" })).toBeInTheDocument();
  });

  it("streams text with a caret, then ends in done", async () => {
    const { server, runFrame, settle, type } = setup();
    type("hi");
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));

    server.token("سلام");
    runFrame();
    expect(screen.getByText("سلام")).toBeInTheDocument();
    expect(screen.getByTestId("caret")).toBeInTheDocument();
    expect(screen.getByText("در حال پاسخ…")).toBeInTheDocument();

    server.done();
    await settle();
    expect(screen.queryByTestId("caret")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ارسال" })).toBeInTheDocument();
  });

  it("Stop keeps the text and shows the stopped label", async () => {
    const { server, runFrame, settle, type } = setup();
    type("hi");
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));
    server.token("نیمه");
    runFrame();

    fireEvent.click(screen.getByRole("button", { name: "توقف" }));
    await settle();

    expect(server.signal.aborted).toBe(true);
    expect(screen.getByText("نیمه")).toBeInTheDocument();
    expect(screen.getAllByText("متوقف شد").length).toBeGreaterThan(0);
  });

  it("Stop before any text does not mark the previous reply as stopped", async () => {
    const { server, settle, type } = setup();
    type("اول");
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));
    server.token("جواب اول");
    server.done();
    await settle();

    type("دوم");
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));
    fireEvent.click(screen.getByRole("button", { name: "توقف" }));
    await settle();

    // Only the header says "stopped"; the first reply has no label.
    expect(screen.getAllByText("متوقف شد")).toHaveLength(1);
    expect(screen.getByText("جواب اول")).toBeInTheDocument();
  });

  it("allows typing while busy but does not send", () => {
    const { server, textbox, type } = setup();
    type("اول");
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));

    type("دوم");
    fireEvent.submit(textbox().closest("form")!);

    expect(server.calls).toBe(1);
    expect(textbox()).toHaveValue("دوم");
  });

  it("shows the error message", async () => {
    const { server, settle, type } = setup();
    type("hi");
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));

    server.errorEvent("Can't reach Ollama. Is it running?", true);
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach Ollama. Is it running?");
  });

  it("50 tokens in one frame cause one render, not 50", () => {
    const { server, runFrame, rendersSoFar, type } = setup();
    type("hi");
    fireEvent.click(screen.getByRole("button", { name: "ارسال" }));
    server.token("first");
    runFrame();
    const before = rendersSoFar();

    act(() => {
      for (let i = 0; i < 50; i++) server.token(" word");
    });
    runFrame();

    expect(rendersSoFar() - before).toBe(1);
  });

  // These use YOUR composerKeyAction.
  it("Enter sends", () => {
    const { server, textbox, type } = setup();
    type("با اینتر");

    fireEvent.keyDown(textbox(), { key: "Enter" });

    expect(server.calls).toBe(1);
  });

  it("Shift+Enter does not send", () => {
    const { server, textbox, type } = setup();
    type("خط اول");

    fireEvent.keyDown(textbox(), { key: "Enter", shiftKey: true });

    expect(server.calls).toBe(0);
  });
});
