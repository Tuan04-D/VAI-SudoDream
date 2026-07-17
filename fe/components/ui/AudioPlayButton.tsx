"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

export default function AudioPlayButton({
  src,
  label = "Nghe cảnh báo",
  className,
}: {
  src: string | null;
  label?: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  if (!src) {
    return (
      <span className={clsx("inline-flex items-center gap-2 text-sm text-ink-muted", className)}>
        <span className="h-2 w-2 rounded-full bg-ink-muted/50" />
        Âm thanh đang chuẩn bị
      </span>
    );
  }

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      el.currentTime = 0;
      setPlaying(false);
    } else {
      el.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-ink transition-transform hover:brightness-110 active:scale-95",
        className
      )}
    >
      {playing ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M8 5v14l11-7Z" />
        </svg>
      )}
      {label}
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} className="hidden" />
    </button>
  );
}
