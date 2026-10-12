import { hexToRgb } from './convert';

export function relLum(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function wcag(a: string, b: string) {
  const la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** APCA (0.0.98G-4g) lightness contrast Lc; positive = dark text on light bg. */
export function apca(text: string, bg: string) {
  const sRGB = (h: string) => {
    const [r, g, b] = hexToRgb(h).map((c) => (c / 255) ** 2.4);
    return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  };
  let Yt = sRGB(text), Yb = sRGB(bg);
  const clamp = (y: number) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);
  Yt = clamp(Yt); Yb = clamp(Yb);
  let S: number;
  if (Yb > Yt) { S = (Yb ** 0.56 - Yt ** 0.57) * 1.14; return S < 0.1 ? 0 : (S - 0.027) * 100; }
  S = (Yb ** 0.65 - Yt ** 0.62) * 1.14;
  return S > -0.1 ? 0 : (S + 0.027) * 100;
}
/** pick the candidate with the best contrast to bg; prefers candidates meeting min ratio in order */
export function bestText(bg: string, candidates: string[], min = 4.5): string {
  for (const c of candidates) if (wcag(c, bg) >= min) return c;
  let best = candidates[0] ?? '#000', bv = 0;
  for (const c of [...candidates, '#111111', '#ffffff']) { const v = wcag(c, bg); if (v > bv) { bv = v; best = c; } }
  return best;
}
export const isDark = (hex: string) => relLum(hex) < 0.18;
