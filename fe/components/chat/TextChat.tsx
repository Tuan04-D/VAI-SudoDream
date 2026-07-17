"use client";

import { useState } from "react";
import { CHATBOT_API_BASE } from "@/lib/api";
import { streamSSE } from "@/lib/sse";
import type { ChatContext, ChatMessage, Language } from "@/lib/types";

export default function TextChat({
  language,
  context,
  history,
  onTurnStart,
  onDelta,
  onTurnComplete,
  onError,
}: {
  language: Language;
  context: ChatContext | null;
  history: ChatMessage[];
  onTurnStart: (userText: string) => void;
  onDelta: (token: string) => void;
  onTurnComplete: (fullText: string) => void;
  onError: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    onTurnStart(text);

    let full = "";
    try {
      for await (const chunk of streamSSE(`${CHATBOT_API_BASE}/chat/message/text/stream`, {
        message: text,
        history,
        language,
        context,
      })) {
        if (chunk.type === "token") {
          full += chunk.text as string;
          onDelta(chunk.text as string);
        } else if (chunk.type === "error") {
          onError((chunk.message as string) || "Có lỗi xảy ra");
        }
      }
      onTurnComplete(full);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border bg-surface p-3">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        rows={1}
        placeholder="Nhập câu hỏi về thời tiết, mùa vụ..."
        className="max-h-28 flex-1 resize-none rounded-2xl border border-border bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus-visible:border-primary"
      />
      <button
        type="button"
        onClick={send}
        disabled={!input.trim() || busy}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-ink transition-transform hover:enabled:scale-105 active:enabled:scale-95 disabled:opacity-40"
        aria-label="Gửi"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
