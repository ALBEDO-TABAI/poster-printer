import { Rng } from '../rng';
import { hexToLch, lchToHex, adjust, deltaE } from './convert';
import { wcag, relLum } from './contrast';
import { hexToOklch, tasteful } from './oklch';

export type ColorMode = 'normal' | 'random' | 'experimental';
export type PaletteSource = 'image' | 'wada' | 'nice' | 'base';

export interface Palette {
  bg: string;
  ink: string; // main text
  inkSoft: string; // secondary text
  accent: string;
  alt: string; // secondary fill
  fills: string[]; // zone fills (ordered by preference)
  light: string;
  dark: string;
  source: string;
  sourceColors: string[];
}

export interface LibPalette { id: string; src: 'wada' | 'nice'; colors: string[]; names?: string[]; L: number; C: number; dL: number; light: string; chroma: string; contrast: string; tags: string[] }

const chroma = (h: string) => hexToLch(h)[1];
const light = (h: string) => hexToLch(h)[0];

function softify(h: string, k = 0.55) {
  const [L, C, H] = hexToLch(h);
  return lchToHex(L * 0.75 + 22, C * k, H);
}

/** Choose a text color for a fill: tinted near-black / near-white from palette for harmony. */
export function textOn(fill: string, p: Pick<Palette, 'ink' | 'light' | 'dark' | 'bg' | 'accent'>, min = 4.5, preferAccent = false): string {
  const cands = preferAccent ? [p.accent, p.ink, p.bg, p.light, p.dark] : [p.ink, p.bg, p.light, p.dark];
  for (const c of cands) if (c.toLowerCase() !== fill.toLowerCase() && wcag(c, fill) >= min) return c;
  return relLum(fill) > 0.2 ? p.dark : p.light;
}

function tintedNeutrals(hue: number, seedChroma: number) {
  const c = Math.min(8, seedChroma * 0.18 + 2);
  return { light: lchToHex(96, c * 0.6, hue), dark: lchToHex(12, c, hue) };
}

/** Assign roles from a set of source colors */
export function buildPalette(src: string[], mode: ColorMode, rng: Rng, opts: { soft?: boolean; source: string; baseBg?: string; bgPref?: 'light' | 'dark' | 'color' | 'auto' }): Palette {
  let cols = src.filter(Boolean);
  if (!cols.length) cols = ['#1d1d1f', '#f2efe9', '#c8102e'];
  const byChroma = cols.slice().sort((a, b) => chroma(b) - chroma(a));
  const domHue = hexToLch(cols[0])[2];
  const vivid = byChroma[0];
  const { light: lightN, dark: darkN } = tintedNeutrals(hexToLch(vivid)[2], chroma(vivid));
  let bg: string, accent: string, alt: string, fills: string[];
  const pref = opts.bgPref && opts.bgPref !== 'auto' ? opts.bgPref : rng.weighted({ light: 4, dark: 3, color: 4 });

  if (mode === 'experimental') {
    // bold clash, but built in OKLCH and kept inside perceptual "taste" bounds (no neon cyan / acid lime)
    const base = rng.pick(byChroma.slice(0, 3));
    const [, , H0] = hexToOklch(base);
    const rel = rng.weighted({ comp: 4, split: 3, triad: 2, near: 1 });
    const rot = rel === 'comp' ? rng.range(165, 195) : rel === 'split' ? rng.pick([150, 210]) + rng.range(-8, 8) : rel === 'triad' ? rng.pick([120, 240]) : rng.pick([40, -40]);
    const H1 = (H0 + rot + 360) % 360;
    // one deep/mid "ground" + one light-or-dark "hit", with a real lightness gap so they clash in hue, not in glare
    const groundDark = rng.chance(0.55);
    const a = tasteful(groundDark ? rng.range(0.34, 0.5) : rng.range(0.56, 0.68), rng.range(0.11, 0.2), H0);
    const b = tasteful(groundDark ? rng.range(0.78, 0.88) : rng.range(0.24, 0.36), rng.range(0.08, 0.17), H1);
    const c3 = tasteful(rng.range(0.2, 0.28), rng.range(0.02, 0.05), (H0 + rot / 2 + 360) % 360);
    bg = rng.chance(0.5) ? a : b;
    accent = bg === a ? b : a;
    alt = c3;
    fills = [accent, alt, ...byChroma.map((x) => { const [l, c, h] = hexToOklch(x); return tasteful(l, c * 1.25, h); })];
  } else if (mode === 'random') {
    const H = rng.range(0, 360);
    const L = rng.pick([92, 86, 70, 50, 30, 18]);
    bg = lchToHex(L, L > 80 ? rng.range(6, 22) : rng.range(18, 55), H);
    { const [l, c, h] = hexToOklch(bg); bg = tasteful(l, c, h); }
    accent = lchToHex(L > 55 ? rng.range(35, 55) : rng.range(70, 85), rng.range(40, 70), (H + rng.pick([30, 60, 120, 180, 200, 270])) % 360);
    { const [l, c, h] = hexToOklch(accent); accent = tasteful(l, c, h); }
    alt = lchToHex(rng.range(25, 85), rng.range(10, 40), (H + rng.range(-40, 40) + 360) % 360);
    fills = [alt, accent, ...cols];
  } else {
    // normal: harmonious roles from source colors
    const sorted = cols.slice().sort((a, b) => light(b) - light(a));
    const lightest = sorted[0], darkest = sorted[sorted.length - 1];
    if (opts.baseBg) bg = opts.baseBg;
    else if (pref === 'light') bg = light(lightest) > 82 && chroma(lightest) < 30 ? lightest : lchToHex(rng.range(90, 95), Math.min(14, chroma(cols[0]) * 0.35 + 3), domHue);
    else if (pref === 'dark') bg = light(darkest) < 22 ? darkest : lchToHex(rng.range(9, 16), Math.min(16, chroma(cols[0]) * 0.4 + 2), domHue);
    else {
      // a confident mid color from the source
      const mids = cols.filter((c) => light(c) > 25 && light(c) < 80 && chroma(c) > 12);
      bg = mids.length ? rng.pick(mids) : rng.pick(cols);
    }
    const others = byChroma.filter((c) => deltaE(c, bg) > 18);
    accent = others.find((c) => wcag(c, bg) >= 2.2) ?? (relLum(bg) > 0.3 ? lchToHex(40, 60, (hexToLch(bg)[2] + 180) % 360) : lchToHex(78, 50, (hexToLch(bg)[2] + 180) % 360));
    alt = others.find((c) => c !== accent && deltaE(c, accent) > 12) ?? adjust(accent, { dL: relLum(bg) > 0.3 ? -25 : 25, cMul: 0.6 });
    fills = [accent, alt, ...others.filter((c) => c !== accent && c !== alt), ...cols];
  }
  let dark = darkN, lt = lightN;
  if (opts.soft) {
    bg = softify(bg, 0.6); accent = softify(accent); alt = softify(alt); fills = fills.map((f) => softify(f));
    dark = adjust(dark, { L: 20 }); lt = adjust(lt, { L: 94 });
  }
  // ink: tinted near-black or near-white, whichever contrasts better with bg (prefer palette-darkest/ lightest if good)
  const darkCand = [cols.slice().sort((a, b) => light(a) - light(b))[0], dark].find((c) => wcag(c, bg) >= 7) ?? dark;
  const lightCand = [cols.slice().sort((a, b) => light(b) - light(a))[0], lt].find((c) => wcag(c, bg) >= 7) ?? lt;
  let ink = wcag(darkCand, bg) >= wcag(lightCand, bg) ? darkCand : lightCand;
  // guarantee WCAG AA for body text: deepen the neutral, then nudge the ground's lightness if needed
  if (wcag(ink, bg) < 4.5) {
    const [, , hh] = hexToLch(bg);
    const deep = lchToHex(5, 3, hh), pale = lchToHex(99, 2, hh);
    ink = wcag(deep, bg) >= wcag(pale, bg) ? deep : pale;
    const towardLight = relLum(ink) < 0.2;
    for (let k = 0; k < 30 && wcag(ink, bg) < 4.5; k++) bg = adjust(bg, { dL: towardLight ? 1.5 : -1.5 });
    if (ink === deep) dark = deep; else lt = pale;
  }
  const inkSoft = adjust(ink, { dL: relLum(bg) > 0.3 ? 18 : -18 });
  const uniq: string[] = [];
  for (const f of fills) if (!uniq.some((u) => deltaE(u, f) < 8) && deltaE(f, bg) > 10) uniq.push(f);
  return { bg, ink, inkSoft: wcag(inkSoft, bg) >= 4.5 ? inkSoft : ink, accent, alt, fills: uniq.slice(0, 6), light: lt, dark, source: opts.source, sourceColors: cols };
}

/** palette metrics used for library filtering */
export function paletteStats(cols: string[]) {
  const l = cols.map(hexToLch);
  const L = l.reduce((a, b) => a + b[0], 0) / l.length;
  const C = l.reduce((a, b) => a + b[1], 0) / l.length;
  const dL = Math.max(...l.map((x) => x[0])) - Math.min(...l.map((x) => x[0]));
  return { L, C, dL };
}

export const BASE_SWATCHES = ['#f7f5f0', '#1b1b1d', '#e9e9e6', '#f3d9d6', '#d6eadf', '#5b4b8a', '#7a4e32', '#1f2f4f', '#6d1f2a', '#1f3d2b', '#174a52', '#6b6a2e'];
