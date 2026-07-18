/** Synthesized (no external audio files) short alert tones, one shape per
 * hazard type — landslide/thunder get a low rumble, flash flood a filtered
 * noise "rush", frost a soft chime, etc. Web Audio API only. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AudioCtor();
  }
  return ctx;
}

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playTone(
  context: AudioContext,
  freq: number,
  duration: number,
  startTime: number,
  type: OscillatorType = "sine",
  gainPeak = 0.25
) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain).connect(context.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function playNoiseBurst(
  context: AudioContext,
  duration: number,
  startTime: number,
  filterFreq: number,
  gainPeak = 0.2
) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, duration);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.6;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.15);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(startTime);
  source.stop(startTime + duration);
}

export function playAlertSound(hazardType: string | null): void {
  const context = getCtx();
  if (context.state === "suspended") context.resume();
  const now = context.currentTime + 0.05;

  switch (hazardType) {
    case "landslide":
      playTone(context, 60, 3.2, now, "sawtooth", 0.22);
      playNoiseBurst(context, 3.2, now, 130, 0.14);
      break;
    case "flash_flood":
      playNoiseBurst(context, 4, now, 900, 0.2);
      playNoiseBurst(context, 3.5, now + 0.3, 1600, 0.14);
      break;
    case "thunderstorm":
    case "thunderstorm_hail":
      playNoiseBurst(context, 0.35, now, 3200, 0.32);
      playTone(context, 55, 2.8, now + 0.2, "sawtooth", 0.18);
      break;
    case "strong_wind":
      playNoiseBurst(context, 3, now, 650, 0.18);
      break;
    case "frost":
      playTone(context, 1200, 0.4, now, "sine", 0.14);
      playTone(context, 1600, 0.5, now + 0.4, "sine", 0.14);
      playTone(context, 2000, 0.6, now + 0.9, "sine", 0.1);
      break;
    case "heavy_rain":
    case "moderate_rain":
      playNoiseBurst(context, 3.2, now, 2500, 0.14);
      break;
    default:
      playTone(context, 660, 0.3, now, "sine", 0.18);
      playTone(context, 880, 0.3, now + 0.35, "sine", 0.18);
  }
}
