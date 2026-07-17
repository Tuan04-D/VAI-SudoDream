"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { motion } from "motion/react";
import { ConvoSocket } from "@/lib/audio/convoSocket";
import { VADSession } from "@/lib/audio/vad";
import { CHATBOT_API_BASE } from "@/lib/api";
import type { ChatContext, Language } from "@/lib/types";

type ConvoState = "idle" | "listening" | "recording" | "processing" | "speaking";

const STATE_LABEL: Record<ConvoState, string> = {
  idle: "Sẵn sàng",
  listening: "Đang lắng nghe...",
  recording: "Đang ghi âm...",
  processing: "Đang xử lý...",
  speaking: "Đang trả lời...",
};

export default function VoiceChat({
  language,
  context,
  onTurnComplete,
}: {
  language: Language;
  context: ChatContext | null;
  onTurnComplete: (userText: string, assistantText: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [state, setState] = useState<ConvoState>("idle");
  const [level, setLevel] = useState(0);
  const [userPreview, setUserPreview] = useState("");
  const [aiPreview, setAiPreview] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const socketRef = useRef<ConvoSocket | null>(null);
  const vadRef = useRef<VADSession | null>(null);
  const aiTextRef = useRef("");
  const userTextRef = useRef("");
  const activeRef = useRef(false);

  useEffect(() => {
    return () => stop();
  }, []);

  async function start() {
    setErrorMsg(null);
    try {
      const socket = new ConvoSocket();
      socketRef.current = socket;

      socket.onASR = (text) => {
        userTextRef.current = text;
        setUserPreview(text);
        aiTextRef.current = "";
        setAiPreview("");
      };
      socket.onToken = (tok) => {
        aiTextRef.current += tok;
        setAiPreview(aiTextRef.current);
      };
      socket.audioQ.onEmpty = () => {
        if (activeRef.current) {
          setState("listening");
          setTimeout(() => activeRef.current && vadRef.current?.resume(), 700);
        }
      };
      socket.onTurnDone = () => {
        if (userTextRef.current && aiTextRef.current) {
          onTurnComplete(userTextRef.current, aiTextRef.current);
        }
        userTextRef.current = "";
        aiTextRef.current = "";
        if (!socket.audioQ.isPlaying && socket.audioQ.length === 0) {
          if (activeRef.current) {
            setState("listening");
            setTimeout(() => activeRef.current && vadRef.current?.resume(), 700);
          }
        } else {
          setState("speaking");
        }
      };
      socket.onInterrupted = () => {
        aiTextRef.current = "";
        setAiPreview("");
      };
      socket.onError = (msg) => {
        if (msg && !msg.includes("empty")) setErrorMsg(msg);
        if (activeRef.current) {
          setState("listening");
          setTimeout(() => activeRef.current && vadRef.current?.resume(), 400);
        }
      };
      socket.onClose = () => {
        if (activeRef.current) {
          setErrorMsg("Mất kết nối, hãy thử lại");
          stop();
        }
      };

      await socket.open(CHATBOT_API_BASE, language, context);

      const vad = new VADSession({ threshold: 0.015, silenceMs: 800, minSpeechMs: 500 });
      vadRef.current = vad;
      await vad.open(
        () => {
          if (socket.audioQ.isPlaying) socket.interrupt();
          setState("recording");
        },
        async (blob) => {
          if (!activeRef.current) return;
          if (!blob || blob.size < 12000) {
            setState("listening");
            return;
          }
          setState("processing");
          vad.pause();
          await socket.sendAudio(blob);
        },
        (rms) => setLevel(rms)
      );

      activeRef.current = true;
      setActive(true);
      setState("listening");
      setUserPreview("");
      setAiPreview("");
    } catch {
      setErrorMsg("Không thể kết nối micro hoặc máy chủ giọng nói");
      stop();
    }
  }

  function stop() {
    activeRef.current = false;
    setActive(false);
    setState("idle");
    vadRef.current?.close();
    vadRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    setUserPreview("");
    setAiPreview("");
  }

  const ringScale = 1 + Math.min(level * 6, 0.35);

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {errorMsg && <p className="text-sm text-risk-nguyhiem">{errorMsg}</p>}

      <motion.button
        type="button"
        onClick={() => (active ? stop() : start())}
        aria-label={active ? "Kết thúc trò chuyện" : "Bắt đầu trò chuyện bằng giọng nói"}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={clsx(
          "relative flex h-28 w-28 items-center justify-center rounded-full transition-colors",
          active ? "bg-primary text-primary-ink" : "bg-primary/10 text-primary"
        )}
      >
        {state === "listening" && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-primary/20"
              animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-primary/20"
              animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.9 }}
            />
          </>
        )}
        <motion.span
          className={clsx("absolute inset-0 rounded-full", state === "recording" && "bg-primary/25")}
          animate={{ scale: state === "recording" ? ringScale : 1 }}
          transition={{ duration: 0.1 }}
        />
        <MicIcon className="relative h-10 w-10" />
      </motion.button>

      <p className="text-sm font-medium text-ink-muted">
        {active ? STATE_LABEL[state] : "Chạm để bắt đầu hỏi bằng giọng nói"}
      </p>

      {(userPreview || aiPreview) && (
        <div className="w-full max-w-sm space-y-1.5 text-center">
          {userPreview && <p className="text-sm text-ink-muted">&ldquo;{userPreview}&rdquo;</p>}
          {aiPreview && <p className="text-sm font-medium text-ink">{aiPreview}</p>}
        </div>
      )}
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
