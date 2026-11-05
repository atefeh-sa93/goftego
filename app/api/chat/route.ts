import { createChatHandler } from "@/lib/chat/handler";
import { getProvider } from "@/lib/providers";

export const POST = createChatHandler(getProvider);
