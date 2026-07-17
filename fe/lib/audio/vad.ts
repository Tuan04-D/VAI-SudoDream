import { encodeWAV, mergeFloat32 } from "./wav";

/**
 * Voice-activity-detection recording session: watches mic RMS level, starts
 * buffering on speech, flushes a WAV blob after a period of silence.
 * Ported from the original chatbot_agent_voice/ui/app.js VADSession.
 */
export class VADSession {
  private threshold: number;
  private silenceMs: number;
  private minSpeechMs: number;
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private samples: Float32Array[] = [];
  private speaking = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private speechStart = 0;
  private rafId: number | null = null;
  private active = false;
  private sampleRate = 44100;

  onSpeechStart: (() => void) | null = null;
  onSpeechEnd: ((blob: Blob) => void) | null = null;
  onLevel: ((rms: number) => void) | null = null;

  constructor(opts: { threshold?: number; silenceMs?: number; minSpeechMs?: number } = {}) {
    this.threshold = opts.threshold ?? 0.015;
    this.silenceMs = opts.silenceMs ?? 800;
    this.minSpeechMs = opts.minSpeechMs ?? 500;
  }

  async open(
    onSpeechStart: () => void,
    onSpeechEnd: (blob: Blob) => void,
    onLevel: (rms: number) => void
  ) {
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onLevel = onLevel;
    this.active = true;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    this.audioCtx = new AudioContext();
    this.sampleRate = this.audioCtx.sampleRate;
    const source = this.audioCtx.createMediaStreamSource(this.stream);

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);

    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
    this.processor.onaudioprocess = (e) => {
      if (this.speaking) {
        this.samples.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      }
    };

    this.tick();
  }

  private rms(): number {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  private tick = () => {
    if (!this.active) return;
    this.rafId = requestAnimationFrame(this.tick);
    const rms = this.rms();
    this.onLevel?.(rms);

    if (rms > this.threshold && !this.speaking) {
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
      this.speaking = true;
      this.samples = [];
      this.speechStart = Date.now();
      this.onSpeechStart?.();
    } else if (rms <= this.threshold && this.speaking) {
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null;
          this.speaking = false;
          const duration = Date.now() - this.speechStart;
          if (duration >= this.minSpeechMs) {
            const blob = this.flush();
            this.onSpeechEnd?.(blob);
          }
          this.samples = [];
        }, this.silenceMs);
      }
    } else if (rms > this.threshold && this.speaking && this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  };

  private flush(): Blob {
    const merged = mergeFloat32(this.samples);
    return new Blob([encodeWAV(merged, this.sampleRate)], { type: "audio/wav" });
  }

  pause() {
    this.active = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.speaking = false;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
    this.samples = [];
  }

  resume() {
    if (!this.active) {
      if (this.audioCtx?.state === "suspended") this.audioCtx.resume().catch(() => {});
      this.active = true;
      this.tick();
    }
  }

  close() {
    this.active = false;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
