// OKLab / OKLCH (Björn Ottosson, 2020) with sRGB gamut mapping and perceptual "taste" bounds.
import { hexToRgb, rgbToHex } from './convert';

const toLin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toGam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;

export function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
export function hexToOklch(hex: string): [number, number, number] {
  const [L, a, b] = hexToOklab(hex);
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI; if (h < 0) h += 360;
  return [L, C, h];
}
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
/** OKLCH → hex, reducing chroma (binary search) until the colour fits sRGB. */
export function oklchToHex(L: number, C: number, h: number): string {
  L = Math.max(0, Math.min(1, L));
  const hr = (h * Math.PI) / 180;
  let lo = 0, hi = Math.max(0, C);
  if (inGamut(oklabToLinear(L, hi * Math.cos(hr), hi * Math.sin(hr)))) lo = hi;
  else for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inGamut(oklabToLinear(L, mid * Math.cos(hr), mid * Math.sin(hr)))) lo = mid; else hi = mid; }
  const lin = oklabToLinear(L, lo * Math.cos(hr), lo * Math.sin(hr));
  return rgbToHex(lin.map((v) => Math.max(0, Math.min(255, Math.round(toGam(Math.max(0, Math.min(1, v))))))) as [number, number, number]);
}

/**
 * Perceptual taste bounds for "bold" colours. Saturation is capped per hue band. The cyan/aqua and
 * acid yellow-green bands read as neon on screen, so they get tight caps. Very light colours also lose chroma
 * (no highlighter pastels), and very dark ones keep a little for depth.
 */
export function maxTasteChroma(L: number, h: number): number {
  const hh = ((h % 360) + 360) % 360;
  let cap = 0.17;
  if (hh >= 170 && hh < 235) cap = 0.095;        // cyan / aqua: the garish band
  else if (hh >= 105 && hh < 170) cap = 0.12;    // acid greens
  else if (hh >= 85 && hh < 105) cap = 0.13;     // yellow-green / lemon
  else if (hh >= 235 && hh < 300) cap = 0.16;    // blues / violets
  else if (hh >= 20 && hh < 70) cap = 0.16;      // reds / oranges
  // lightness envelope: peak saturation around L≈0.55–0.7
  const env = L > 0.82 ? Math.max(0.25, 1 - (L - 0.82) * 4.5) : L < 0.3 ? Math.max(0.45, L / 0.3) : 1;
  return cap * env;
}
/** Build a colour inside both the sRGB gamut and the taste bounds. */
export function tasteful(L: number, C: number, h: number): string {
  const Lc = Math.max(0.18, Math.min(0.94, L));
  return oklchToHex(Lc, Math.min(C, maxTasteChroma(Lc, h)), h);
}
/** True if a hex lies inside the taste bounds (with a small tolerance). */
export function isTasteful(hex: string, tol = 0.012): boolean {
  const [L, C, h] = hexToOklch(hex);
  return C <= maxTasteChroma(L, h) + tol;
}
export const okDelta = (a: string, b: string) => { const x = hexToOklab(a), y = hexToOklab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
