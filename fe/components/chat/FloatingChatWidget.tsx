"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { IconHistory, IconMessageCircle, IconX } from "@tabler/icons-react";
import { fetchChatContext, fetchChatHistory } from "@/lib/api";
import { useRole } from "@/lib/RoleProvider";
import type { ChatContext, ChatMessage, Language } from "@/lib/types";
import TextChat from "./TextChat";
import VoiceChat from "./VoiceChat";
import MessageBubble from "./MessageBubble";
import LanguageToggle from "./LanguageToggle";

type Mode = "voice" | "text";

export default function FloatingChatWidget({ communeId }: { communeId: string }) {
  const { resident } = useRole();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("voice");
  const [context, setContext] = useState<ChatContext | null>(null);
  const [language, setLanguage] = useState<Language>("vietnamese");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchChatContext(communeId)
      .then(setContext)
      .catch(() => setContext(null));
  }, [communeId, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  async function loadHistory() {
    if (!resident || historyBusy) return;
    setHistoryBusy(true);
    try {
      const history = await fetchChatHistory(resident.id);
      setMessages(history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })));
    } catch {
      // no history yet / offline — leave the current conversation as-is
    } finally {
      setHistoryBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-ink shadow-xl transition-transform hover:scale-105 lg:bottom-6"
        aria-label="Mở trợ lý hỏi đáp"
      >
        <IconMessageCircle className="h-6 w-6" stroke={1.8} />
      </button>
    );
  }

  return (
    <div className="card card-raised fixed bottom-20 right-4 z-40 flex h-[70vh] max-h-[600px] w-[min(92vw,380px)] flex-col overflow-hidden lg:bottom-6">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1">
          {resident && (
            <button
              type="button"
              onClick={loadHistory}
              disabled={historyBusy}
              className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50"
              aria-label="Xem lịch sử trò chuyện"
              title="Lịch sử trò chuyện"
            >
              <IconHistory className="h-4 w-4" stroke={2} />
            </button>
          )}
          <p className="text-sm font-semibold text-ink">Hỏi đáp thời tiết</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          aria-label="Đóng"
        >
          <IconX className="h-4 w-4" stroke={2} />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border py-1.5">
        <div className="inline-flex rounded-full border border-border bg-surface p-1 text-xs">
          {(
            [
              { key: "voice", label: "Giọng nói" },
              { key: "text", label: "Văn bản" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              className="relative rounded-full px-3 py-1 font-medium transition-colors"
            >
              {mode === opt.key && (
                <motion.span
                  layoutId="floating-chat-mode-active"
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className={clsx("relative z-10", mode === opt.key ? "text-primary-ink" : "text-ink-muted")}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
        <LanguageToggle value={language} onChange={setLanguage} />
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !streamingText && mode === "text" && (
          <p className="pt-8 text-center text-sm text-ink-muted">
            Hỏi tôi về thời tiết xã bạn — mưa, nắng, hay cần làm gì hôm nay.
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
        </AnimatePresence>
        {streamingText !== null && <MessageBubble message={{ role: "assistant", content: streamingText || "..." }} />}
        {error && <p className="text-center text-xs text-risk-3">{error}</p>}
        {mode === "voice" && (
          <VoiceChat
            language={language}
            context={context}
            onTurnComplete={(userText, assistantText) => {
              setError(null);
              setMessages((prev) => [
                ...prev,
                { role: "user", content: userText },
                { role: "assistant", content: assistantText },
              ]);
            }}
          />
        )}
      </div>

      {mode === "text" && (
        <TextChat
          language={language}
          context={context}
          history={messages}
          onTurnStart={(userText) => {
            setError(null);
            setMessages((prev) => [...prev, { role: "user", content: userText }]);
            setStreamingText("");
          }}
          onDelta={(tok) => setStreamingText((prev) => (prev ?? "") + tok)}
          onTurnComplete={(fullText) => {
            setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
            setStreamingText(null);
          }}
          onError={(msg) => {
            setError(msg);
            setStreamingText(null);
          }}
        />
      )}
    </div>
  );
}
