// Itten's contrasts as palette rules (phase 7). Each idea commits to ONE dominant contrast; the palette is built for
// it and the other contrasts are kept weak (few hues, few saturated colours). All in OKLCH.
import type { Rng } from '../rng';
import type { Palette } from './palette';
import { sat, ok, finish, monoPalette, clashPalette } from './strategy';
import { wcag } from './contrast';

export type Itten = 'lightdark' | 'hue' | 'coldwarm' | 'complement' | 'saturation' | 'extension' | 'simultaneous';
export const ITTEN: Itten[] = ['lightdark', 'hue', 'coldwarm', 'complement', 'saturation', 'extension', 'simultaneous'];

const WARM = [28, 40, 55, 70, 25];
const COLD = [215, 232, 250, 262, 200];

export function ittenPalette(kind: Itten, h: number, rng: Rng, src: string[] = []): Palette {
  const P = (bg: string, ink: string, accent: string, alt: string, light: string, dark: string) => finish(bg, ink, accent, alt, light, dark, [], `itten:${kind}`, src);
  switch (kind) {
    case 'lightdark': {
      // value is everything: near-white vs near-black, chroma ≤ 0.04; the accent is a mid value of the same hue
      const darkField = rng.chance(0.45);
      const paper = ok(rng.range(0.94, 0.975), rng.range(0.004, 0.02), h), ink = ok(rng.range(0.14, 0.2), rng.range(0.005, 0.025), h);
      const bg = darkField ? ink : paper, fg = darkField ? paper : ink;
      const accent = ok(darkField ? rng.range(0.62, 0.72) : rng.range(0.42, 0.52), rng.range(0.02, 0.045), h);
      return P(bg, fg, accent, ok(darkField ? 0.26 : 0.88, 0.015, h), paper, ink);
    }
    case 'hue': {
      // two hues ≥ 100° apart at similar lightness: the edge between them vibrates
      const L = rng.range(0.6, 0.72), h2 = h + rng.pick([-1, 1]) * rng.range(100, 140);
      const bg = sat(L, 0.17, h), accent = sat(L + rng.range(-0.06, 0.06), 0.17, h2);
      const shade = sat(0.18, 0.05, h), tint = sat(0.965, 0.02, h);
      return P(bg, wcag(shade, bg) >= wcag(tint, bg) ? shade : tint, accent, sat(L - 0.1, 0.12, h2), tint, shade);
    }
    case 'coldwarm': {
      // a cold field and a small warm hero (warm advances)
      const hc = rng.pick(COLD) + rng.range(-6, 6), hw = rng.pick(WARM) + rng.range(-5, 5);
      const darkField = rng.chance(0.55);
      const bg = darkField ? sat(rng.range(0.24, 0.34), rng.range(0.06, 0.1), hc) : sat(rng.range(0.86, 0.92), rng.range(0.03, 0.05), hc);
      const accent = darkField ? sat(rng.range(0.68, 0.76), 0.17, hw) : sat(rng.range(0.56, 0.64), 0.18, hw);
      const tint = sat(0.965, 0.015, hc), shade = sat(0.2, 0.05, hc);
      return P(bg, darkField ? tint : shade, accent, sat(darkField ? 0.4 : 0.78, 0.06, hc), tint, shade);
    }
    case 'complement':
      return clashPalette(h, rng, src);
    case 'saturation':
      // one hue; the field is quiet and the hero is the only saturated thing
      return monoPalette(h, rng.weighted({ light: 3, dark: 2, sat: 1 }), rng, src);
    case 'extension': {
      // neutral field ≥ 70%, one small loud accent (2–6% of the area, realisers keep it small)
      const darkField = rng.chance(0.35);
      const hn = rng.pick([60, 75, 85, 250]);
      const bg = darkField ? ok(rng.range(0.16, 0.22), 0.012, hn) : ok(rng.range(0.93, 0.965), rng.range(0.008, 0.02), hn);
      const ha = rng.pick([28, 25, 40, 262, 150, 85]);
      const accent = sat(darkField ? 0.7 : 0.6, 0.2, ha);
      const tint = ok(0.97, 0.01, hn), shade = ok(0.19, 0.012, hn);
      return P(bg, darkField ? tint : shade, accent, ok(darkField ? 0.3 : 0.86, 0.012, hn), tint, shade);
    }
    case 'simultaneous': {
      // a saturated field and a neutral grey element that the eye tints with the field's complement
      const L = rng.range(0.58, 0.68);
      const bg = sat(L, 0.18, h);
      const grey = ok(rng.chance(0.5) ? L + 0.16 : L - 0.2, 0.004, h);
      const shade = sat(0.17, 0.05, h), tint = sat(0.97, 0.015, h);
      return P(bg, wcag(shade, bg) >= wcag(tint, bg) ? shade : tint, grey, ok(L - 0.08, 0.004, h), tint, shade);
    }
  }
}
