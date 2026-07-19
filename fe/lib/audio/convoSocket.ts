import { AudioQueue } from "./audioQueue";
import type { ChatContext, Language } from "@/lib/types";

function asWebSocketUrl(base: string, path: string): string {
  return base.replace(/\/$/, "").replace(/^http/, "ws") + path;
}

async function resolveWebSocketUrl(apiBase: string, path: string): Promise<string> {
  const explicitBase = process.env.NEXT_PUBLIC_WS_BASE?.trim();
  if (explicitBase) return asWebSocketUrl(explicitBase, path);
  if (/^https?:\/\//i.test(apiBase)) return asWebSocketUrl(apiBase, path);

  // Vercel rewrites proxy HTTP but not WebSocket upgrades. This same-origin
  // endpoint exposes only the already-public backend origin so the browser can
  // connect directly without duplicating deployment configuration.
  try {
    const response = await fetch(`${apiBase}/api/runtime`, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json() as { websocket_base?: string };
      if (payload.websocket_base) return asWebSocketUrl(payload.websocket_base, path);
    }
  } catch {
    // Fall through for local setups that do support WebSocket proxying.
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return asWebSocketUrl(`${origin}${apiBase}`, path);
}

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Client for the grounded voice-conversation WebSocket (/ws/convo). */
export class ConvoSocket {
  private ws: WebSocket | null = null;
  ready = false;
  audioQ = new AudioQueue();

  onASR: ((text: string) => void) | null = null;
  onToken: ((text: string) => void) | null = null;
  onTurnDone: (() => void) | null = null;
  onInterrupted: (() => void) | null = null;
  onError: ((message: string) => void) | null = null;
  onClose: (() => void) | null = null;

  async open(apiBase: string, language: Language, context: ChatContext | null): Promise<void> {
    const url = await resolveWebSocketUrl(apiBase, "/ws/convo");
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "config", language, context }));
      };
      ws.onmessage = (e) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        switch (msg.type) {
          case "ready":
            this.ready = true;
            resolve();
            break;
          case "asr":
            this.onASR?.(msg.text as string);
            break;
          case "token":
            this.onToken?.(msg.text as string);
            break;
          case "audio":
            this.audioQ.push(msg.data as string, (msg.fmt as string) || "wav");
            break;
          case "turn_done":
            this.onTurnDone?.();
            break;
          case "interrupted":
            this.audioQ.clear();
            this.audioQ.reset();
            this.onInterrupted?.();
            break;
          case "skip":
            this.onTurnDone?.();
            break;
          case "error":
            this.onError?.(msg.message as string);
            break;
        }
      };
      ws.onclose = (e) => {
        if (!this.ready) reject(new Error(`WS closed before ready (${e.code})`));
        this.ready = false;
        this.onClose?.();
      };
      ws.onerror = () => {
        if (!this.ready) reject(new Error("WebSocket error"));
      };
    });
  }

  async sendAudio(blob: Blob) {
    if (!this.ready || !this.ws) return;
    const b64 = await blobToB64(blob);
    this.ws.send(JSON.stringify({ type: "speech_end", audio: b64 }));
  }

  interrupt() {
    if (!this.ready || !this.ws) return;
    this.audioQ.clear();
    this.audioQ.reset();
    this.ws.send(JSON.stringify({ type: "interrupt" }));
  }

  close() {
    this.ready = false;
    this.audioQ.clear();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
