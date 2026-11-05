/**
 * What /api/chat needs from a model backend. Ollama implements it now;
 * the mock provider (#7) implements the same thing, so the route never changes.
 */

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChatOptions {
  /** Aborts the upstream request to the model. */
  signal: AbortSignal;
  /** Called for every piece of text as it arrives. */
  onToken: (text: string) => void;
}

export interface ChatProvider {
  readonly name: string;
  /** Resolves with the model's finish reason once the reply is complete. */
  streamChat(messages: ProviderMessage[], options: StreamChatOptions): Promise<{ finishReason: string }>;
}

/** A failure the UI can explain; `retryable` decides whether to show Retry. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
