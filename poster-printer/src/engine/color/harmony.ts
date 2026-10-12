// Palette harmony in OKLCH. Scores a palette's *roles* (bg / ink / accent / alt) the way a designer would:
// legible value structure, one saturation peak, a recognised hue relationship and no muddy mid-tones.
import { hexToOklch, oklchToHex, maxTasteChroma } from './oklch';
import { wcag } from './contrast';
import type { Palette } from './palette';

const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Mid-value, low-chroma browns and olives: the colours that make image palettes look "dirty". */
export function muddiness(hex: string): number {
  const [L, C, h] = hexToOklch(hex);
  if (C < 0.02 || C > 0.13) return 0; // neutrals and clear colours are fine
  if (h < 25 || h > 125) return 0; // only the brown → olive band
  const lw = L < 0.28 || L > 0.78 ? 0 : 1 - Math.abs(L - 0.52) / 0.26; // worst around L≈0.52
  const cw = C < 0.045 ? (C - 0.02) / 0.025 : C > 0.1 ? (0.13 - C) / 0.03 : 1;
  return Math.max(0, Math.min(1, lw * cw));
}

/**
 * Clean a muddy colour: either deepen it to a rich dark (espresso, forest) or lift it into a clear earth
 * (ochre, terracotta, sand) with more chroma. Clear colours pass through unchanged.
 */
export function demud(hex: string): string {
  const m = muddiness(hex);
  if (m < 0.35) return hex;
  const [L, C, h] = hexToOklch(hex);
  if (L < 0.5) return oklchToHex(Math.max(0.22, L * 0.72), Math.min(C * 1.15, 0.09), h); // deep & rich
  const hh = h > 95 ? h : h < 50 ? h : h - 6; // olive → warmer ochre
  const L2 = Math.min(0.8, L + 0.12);
  return oklchToHex(L2, Math.min(maxTasteChroma(L2, hh), Math.max(C * 1.6, 0.1)), hh);
}

/** Make an accent sing: push chroma toward the taste ceiling, keep a mid lightness so it reads on light and dark grounds. */
export function boostAccent(hex: string, bg: string): string {
  const [L, C, h] = hexToOklch(hex);
  if (C < 0.035) return hex; // a neutral accent is a deliberate choice
  const [Lb] = hexToOklch(bg);
  let L2 = Math.max(0.42, Math.min(0.78, L));
  if (Math.abs(L2 - Lb) < 0.14) L2 = Lb > 0.6 ? Math.max(0.36, Lb - 0.22) : Math.min(0.84, Lb + 0.24);
  const C2 = Math.min(maxTasteChroma(L2, h), Math.max(C * 1.3, 0.11));
  return oklchToHex(L2, C2, h);
}

export interface HarmonyReport { score: number; value: number; peak: number; hue: number; mud: number; relation: string }

/** 0..1 (≥0.7 good). */
export function harmonyScore(p: Pick<Palette, 'bg' | 'ink' | 'accent' | 'alt'>): HarmonyReport {
  const bg = hexToOklch(p.bg), ink = hexToOklch(p.ink), ac = hexToOklch(p.accent), alt = hexToOklch(p.alt);
  // value structure: ink must separate strongly from bg, accent and alt should separate from bg in L or C
  const vInk = Math.min(1, Math.abs(ink[0] - bg[0]) / 0.55) * (wcag(p.ink, p.bg) >= 4.5 ? 1 : 0.6);
  const sep = (c: number[]) => Math.min(1, Math.hypot((c[0] - bg[0]) / 0.18, (c[1] - bg[1]) / 0.08));
  const value = 0.6 * vInk + 0.25 * sep(ac) + 0.15 * sep(alt);
  // one saturation peak: the accent should be the most chromatic role, the ground calmer
  const peakC = Math.max(ac[1], alt[1]);
  const peak = ac[1] < 0.03 ? 0.75 : bg[1] > ac[1] * 0.95 && bg[1] > 0.08 ? 0.45 : alt[1] > ac[1] * 1.1 ? 0.75 : 1;
  // hue relationship among chromatic roles
  const chrom = [bg, ac, alt].filter((c) => c[1] > 0.04);
  let hue = 1, relation = 'neutral';
  if (chrom.length >= 2) {
    const ds: number[] = [];
    for (let i = 0; i < chrom.length; i++) for (let j = i + 1; j < chrom.length; j++) ds.push(hueDist(chrom[i][2], chrom[j][2]));
    const fit = (d: number) => {
      const targets: [number, string, number][] = [[0, 'analogous', 28], [180, 'complementary', 24], [150, 'split', 16], [120, 'triad', 16]];
      let best = 0, name = 'discordant';
      for (const [t, nm, tol] of targets) { const v = Math.max(0, 1 - Math.abs(d - t) / tol); if (v > best) { best = v; name = nm; } }
      return { v: 0.45 + 0.55 * best, name };
    };
    const fs = ds.map(fit);
    hue = fs.reduce((a, b) => a + b.v, 0) / fs.length;
    relation = fs[0].name;
  }
  const mud = Math.max(muddiness(p.bg), muddiness(p.accent) * 0.9, muddiness(p.alt) * 0.6);
  void peakC;
  const score = Math.max(0, Math.min(1, 0.35 * value + 0.2 * peak + 0.3 * hue + 0.15 * (1 - mud) - 0.25 * mud));
  return { score, value, peak, hue, mud, relation };
}
