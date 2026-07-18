import { API_BASE, getJson } from "@/lib/api/client";
import type { ChatContext, ChatHistoryMessage } from "@/lib/types";


export function fetchChatContext(communeId: string): Promise<ChatContext> {
  return getJson(`${API_BASE}/api/chat/context/${communeId}`);
}

export function fetchChatHistory(residentId: string): Promise<ChatHistoryMessage[]> {
  return getJson(`${API_BASE}/api/chat/history/${residentId}`);
}
