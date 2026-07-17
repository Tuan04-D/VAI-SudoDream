"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "motion/react";
import { fetchChatContext } from "@/lib/api";
import type { ChatContext, ChatMessage, Commune, Language } from "@/lib/types";
import LanguageToggle from "./LanguageToggle";
import TextChat from "./TextChat";
import VoiceChat from "./VoiceChat";
import MessageBubble from "./MessageBubble";
import CommunePicker from "@/components/forecast/CommunePicker";

type Mode = "voice" | "text";

export default function ChatView({
  communes,
  defaultCommuneId,
}: {
  communes: Commune[];
  defaultCommuneId: string;
}) {
  const [communeId, setCommuneId] = useState(defaultCommuneId);
  const [context, setContext] = useState<ChatContext | null>(null);
  const [language, setLanguage] = useState<Language>("vietnamese");
  const [mode, setMode] = useState<Mode>("voice");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchChatContext(communeId)
      .then(setContext)
      .catch(() => setContext(null));
  }, [communeId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  const commune = communes.find((c) => c.id === communeId) ?? communes[0];

  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] max-w-3xl flex-col lg:h-[calc(100dvh-4.5rem)] lg:border-x lg:border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Dữ liệu xã:</span>
          <CommunePicker communes={communes} value={communeId} onChange={setCommuneId} />
        </div>
        <LanguageToggle value={language} onChange={setLanguage} />
      </div>

      <div className="flex justify-center border-b border-border py-2">
        <div className="inline-flex rounded-full border border-border bg-surface p-1 text-sm">
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
              className="relative rounded-full px-4 py-1.5 font-medium transition-colors"
            >
              {mode === opt.key && (
                <motion.span
                  layoutId="chat-mode-active"
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
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 lg:px-8">
        {messages.length === 0 && !streamingText && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-muted">
            <div className="bg-contour mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ChatMark />
            </div>
            <p className="font-display text-base font-semibold text-ink">
              Hỏi tôi về thời tiết {commune?.name}
            </p>
            <p className="max-w-xs text-sm">
              Dự báo 5 ngày tới, mùa vụ, chăn nuôi hay cách phòng tránh thiên tai — bằng tiếng Việt hoặc
              tiếng H&apos;Mông.
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
        </AnimatePresence>
        {streamingText !== null && (
          <MessageBubble message={{ role: "assistant", content: streamingText || "..." }} />
        )}
        {error && <p className="text-center text-sm text-risk-nguyhiem">{error}</p>}
      </div>

      {mode === "text" ? (
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
      ) : (
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
  );
}

function ChatMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-7 w-7">
      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
    </svg>
  );
}
