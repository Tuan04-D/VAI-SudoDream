export function playAudioB64(b64: string, fmt: string = "wav"): Promise<void> {
  return new Promise((resolve) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([new Uint8Array(bytes)], { type: `audio/${fmt}` });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.play().catch(() => resolve());
  });
}

/** Plays base64 audio chunks strictly in arrival order (sentence-level TTS). */
export class AudioQueue {
  private q: { b64: string; fmt: string }[] = [];
  private playingFlag = false;
  private stopped = false;
  onEmpty: (() => void) | null = null;

  push(b64: string, fmt: string = "wav") {
    if (this.stopped) return;
    this.q.push({ b64, fmt });
    if (!this.playingFlag) this.drain();
  }

  private async drain() {
    this.playingFlag = true;
    while (this.q.length > 0 && !this.stopped) {
      const item = this.q.shift();
      if (!item) break;
      await playAudioB64(item.b64, item.fmt);
    }
    this.playingFlag = false;
    if (!this.stopped) this.onEmpty?.();
  }

  clear() {
    this.q = [];
    this.stopped = true;
  }

  reset() {
    this.q = [];
    this.stopped = false;
    this.playingFlag = false;
  }

  get isPlaying() {
    return this.playingFlag;
  }

  get length() {
    return this.q.length;
  }
}
