"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";

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
        <IconPlayerPauseFilled className="h-3.5 w-3.5" />
      ) : (
        <IconPlayerPlayFilled className="h-3.5 w-3.5" />
      )}
      {label}
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} className="hidden" />
    </button>
  );
}
