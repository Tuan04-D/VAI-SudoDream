"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { API_BASE } from "@/lib/api";
import type { Language } from "@/lib/types";

export default function SpeakButton({
  text,
  language = "vietnamese",
  className,
}: {
  text: string;
  language?: Language;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleClick = async () => {
    if (status === "playing") {
      audioRef.current?.pause();
      setStatus("idle");
      return;
    }
    if (!text.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      if (!res.ok) throw new Error("tts_failed");
      const data = await res.json();
      const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
      audioRef.current = audio;
      audio.onended = () => setStatus("idle");
      audio.onerror = () => setStatus("error");
      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("error");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "loading"}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/5 active:scale-95 disabled:opacity-60",
        className
      )}
    >
      {status === "loading" ? (
        "Đang tải giọng đọc..."
      ) : status === "error" ? (
        "Không phát được, thử lại"
      ) : status === "playing" ? (
        <>
          <IconPlayerPauseFilled className="h-3.5 w-3.5" />
          Dừng
        </>
      ) : (
        <>
          <IconPlayerPlayFilled className="h-3.5 w-3.5" />
          Nghe
        </>
      )}
    </button>
  );
}
