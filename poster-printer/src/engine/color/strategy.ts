// Palette strategies for "art direction v2": single-hue saturated fields, deliberate two-hue clashes and a committed
// tonal key (dark / light / saturated mid). Everything is built in OKLCH so lightness steps read evenly across hues.
import type { Rng } from '../rng';
import type { Palette } from './palette';
import { hexToOklch, oklchToHex } from './oklch';
import { wcag, relLum } from './contrast';

export type Tone = 'dark' | 'light' | 'sat';
export const ok = (L: number, C: number, h: number) => oklchToHex(Math.max(0.05, Math.min(0.985, L)), Math.max(0, C), ((h % 360) + 360) % 360);
/** chroma ceiling per hue band so saturated fields stay "printed" rather than neon */
function cap(h: number, L: number) {
  const hh = ((h % 360) + 360) % 360;
  let c = 0.19;
  if (hh >= 175 && hh < 235) c = 0.11; // cyan
  else if (hh >= 120 && hh < 175) c = 0.15; // greens
  else if (hh >= 95 && hh < 120) c = 0.17; // chartreuse
  const env = L > 0.86 ? Math.max(0.2, 1 - (L - 0.86) * 6) : L < 0.25 ? Math.max(0.45, L / 0.25) : 1;
  return c * env;
}
export const sat = (L: number, C: number, h: number) => ok(L, Math.min(C, cap(h, L)), h);

/** pick the most chromatic hue of the source, or a curated field hue when the source is greyish */
export function fieldHue(src: string[], rng: Rng): number {
  const cs = src.map(hexToOklch).filter((c) => c[1] > 0.06).sort((a, b) => b[1] - a[1]);
  if (cs.length && rng.chance(0.7)) return cs[0][2];
  // saffron, coral, oxblood-red, chartreuse, olive, forest, teal, royal blue, ultramarine, plum, peach, terracotta
  return rng.pick([78, 35, 25, 112, 100, 150, 195, 262, 272, 330, 55, 45]) + rng.range(-6, 6);
}

export function finish(bg: string, ink: string, accent: string, alt: string, light: string, dark: string, extra: string[], source: string, srcCols: string[]): Palette {
  // body-text guarantee
  if (wcag(ink, bg) < 4.5) {
    const [L, C, h] = hexToOklch(ink);
    const up = relLum(bg) < 0.25;
    for (let k = 1; k < 30 && wcag(ink, bg) < 4.5; k++) ink = ok(up ? L + k * 0.02 : L - k * 0.02, C * (1 - k * 0.02), h);
    // mid-luminance fields: the preferred direction may not reach 4.5:1, so take the deepest shade / palest tint
    if (wcag(ink, bg) < 4.5) { let d = ok(0.16, Math.min(C, 0.04), h), t = ok(0.985, 0.01, h); if (Math.max(wcag(d, bg), wcag(t, bg)) < 4.5) { d = "#000000"; t = "#ffffff"; } ink = wcag(d, bg) >= wcag(t, bg) ? d : t; }
  }
  const inkSoft = ink;
  const fills = [accent, alt, ...extra].filter((f, i, a) => a.indexOf(f) === i && f !== bg);
  return { bg, ink, inkSoft, accent, alt, fills, light, dark, source, sourceColors: srcCols };
}

/** one hue: field, its tint and its shade (text in a tint or shade of the field) */
export function monoPalette(h: number, tone: Tone, rng: Rng, srcCols: string[] = []): Palette {
  let bgL: number, bgC: number;
  if (tone === 'dark') { bgL = rng.range(0.24, 0.34); bgC = rng.range(0.07, 0.13); }
  else if (tone === 'light') { bgL = rng.range(0.9, 0.945); bgC = rng.range(0.025, 0.05); }
  else { bgL = rng.range(0.56, 0.72); bgC = rng.range(0.13, 0.2); }
  const bg = sat(bgL, bgC, h);
  const darkBg = bgL < 0.5;
  const shade = sat(rng.range(0.17, 0.24), Math.min(0.09, bgC * 0.8), h);
  const tint = sat(rng.range(0.94, 0.975), 0.025, h);
  let ink = darkBg ? tint : shade;
  if (!darkBg && wcag(shade, bg) < 4.5 && wcag(tint, bg) > wcag(shade, bg)) ink = tint;
  // accent: same hue, a clear lightness step away (or a neighbour hue for a little life)
  const hA = h + (rng.chance(0.35) ? rng.pick([-28, 28]) : 0);
  const accent = darkBg ? sat(rng.range(0.7, 0.82), 0.15, hA) : bgL > 0.85 ? sat(rng.range(0.45, 0.58), 0.17, hA) : sat(bgL > 0.64 ? rng.range(0.32, 0.42) : rng.range(0.82, 0.9), bgL > 0.64 ? 0.13 : 0.08, hA);
  // tonal step of the field (geometry, tiles, tonal glyphs)
  const alt = sat(bgL + (darkBg ? 0.06 : -0.06), bgC * 0.95, h);
  return finish(bg, ink, accent, alt, tint, shade, [sat(bgL + (darkBg ? 0.12 : -0.12), bgC, h)], 'mono', srcCols);
}

/** deliberate two-hue clash: a saturated field against a far hue with a lightness gap */
export function clashPalette(h: number, rng: Rng, srcCols: string[] = []): Palette {
  const h2 = h + rng.range(150, 210);
  const groundDark = rng.chance(0.35);
  const bg = groundDark ? sat(rng.range(0.3, 0.4), 0.14, h) : sat(rng.range(0.6, 0.74), 0.19, h);
  const accent = groundDark ? sat(rng.range(0.78, 0.86), 0.17, h2) : sat(rng.range(0.36, 0.48), 0.19, h2);
  const shade = sat(0.19, 0.06, h), tint = sat(0.965, 0.02, h);
  const ink = wcag(shade, bg) >= wcag(tint, bg) ? shade : tint;
  const alt = sat(groundDark ? 0.5 : 0.84, 0.1, h2 + 20);
  return finish(bg, ink, accent, alt, tint, shade, [], 'clash', srcCols);
}

/**
 * Commit an existing palette to a tonal key: dark → deep ground, light → paper-white ground, sat → a confident
 * mid colour. Rejects the grey haze (mid lightness, almost no chroma) that reads as "muddy".
 */
export function commitTone(p: Palette, tone: Tone, rng: Rng): Palette {
  const [L, C, h] = hexToOklch(p.bg);
  let bg = p.bg;
  if (tone === 'dark' && L > 0.34) bg = sat(rng.range(0.18, 0.28), Math.min(0.1, Math.max(0.03, C)), h);
  else if (tone === 'light' && L < 0.88) bg = sat(rng.range(0.91, 0.955), Math.min(0.035, Math.max(0.012, C * 0.4)), h);
  else if (tone === 'sat' && (C < 0.09 || L < 0.42 || L > 0.86)) bg = sat(rng.range(0.56, 0.7), Math.max(0.12, Math.min(0.18, C * 2.2 + 0.06)), C < 0.03 ? rng.pick([35, 78, 262, 25, 150]) : h);
  if (bg === p.bg) return p;
  const darkBg = relLum(bg) < 0.2;
  const ink = darkBg ? (relLum(p.light) > 0.6 ? p.light : sat(0.96, 0.02, h)) : relLum(p.dark) < 0.08 ? p.dark : sat(0.2, 0.05, h);
  let accent = p.accent;
  if (wcag(accent, bg) < 2) { const [aL, aC, aH] = hexToOklch(accent); accent = sat(darkBg ? Math.max(aL, 0.74) : Math.min(aL, 0.45), Math.max(aC, 0.1), aH); }
  const alt = wcag(p.alt, bg) < 1.25 ? sat(L + (darkBg ? 0.08 : -0.08), C, h) : p.alt;
  return finish(bg, ink, accent, alt, p.light, p.dark, p.fills.filter((f) => f !== p.accent && f !== p.alt), p.source + '+' + tone, p.sourceColors);
}

/** a tonal step of `c` (±dL in OKLCH lightness), for tonal geometry and faint giant glyphs */
export function tonal(c: string, dL: number): string {
  const [L, C, h] = hexToOklch(c);
  const dir = L > 0.6 ? -1 : 1;
  return ok(L + dir * dL, C * (C > 0.02 ? 1.05 : 1), h);
}
