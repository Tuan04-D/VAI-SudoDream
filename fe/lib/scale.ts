function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

// Cool indigo -> warm ochre -> deep red: ties the temperature ramp to the brand palette
const TEMP_STOPS = ["#3E5C9A", "#8FAEDB", "#E7C36B", "#D98A3D", "#B0452F"];
// Pale mist -> deep chàm indigo: ties the rainfall ramp to the indigo-dye motif
const PRECIP_STOPS = ["#EEF1EA", "#B9C6E0", "#7C93C9", "#4A5FA0", "#2A3B73"];

function sampleStops(stops: string[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const segments = stops.length - 1;
  const pos = clamped * segments;
  const idx = Math.min(segments - 1, Math.floor(pos));
  const localT = pos - idx;
  return lerpColor(stops[idx], stops[idx + 1], localT);
}

export function tempColor(value: number, domain: [number, number]): string {
  const [lo, hi] = domain;
  const t = hi === lo ? 0.5 : (value - lo) / (hi - lo);
  return sampleStops(TEMP_STOPS, t);
}

export function precipColor(value: number, domain: [number, number]): string {
  const [lo, hi] = domain;
  const t = hi === lo ? 0.5 : (value - lo) / (hi - lo);
  return sampleStops(PRECIP_STOPS, t);
}

export function buildMapLibreStops(stops: string[]): (string | number)[] {
  const out: (string | number)[] = [];
  stops.forEach((color, i) => {
    out.push(i / (stops.length - 1), color);
  });
  return out;
}

export const TEMP_MAPLIBRE_STOPS = TEMP_STOPS;
export const PRECIP_MAPLIBRE_STOPS = PRECIP_STOPS;
