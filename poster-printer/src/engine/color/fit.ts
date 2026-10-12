// Phase 11: palette fit. A palette can be valid by colour science (harmony, contrast) and still be wrong for THIS poster:
// fighting the photo, shouting at a quiet exhibition, a garish neon under a thin serif, or one of the combinations
// that never work (muddy low-contrast mid-tones; saturated complementary text that vibrates on its ground).
// Returns a 0..1 fit and named fails; generate() redraws the palette (image-derived first) when it fails.
import type { Palette } from './palette';
import { hexToOklch } from './oklch';
import { wcag } from './contrast';

export interface FitInput { palette: Palette; image?: { palette?: string[]; tier?: string } | null; display?: { family: string; weight: number }; copy?: string }
export interface FitReport { score: number; fails: string[]; notes: string[] }

const hd = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const QUIET = /exhibit|exhibition|gallery|museum|lecture|talk|reading|poetry|poem|book|library|tea|silence|quiet|archive|memorial|photograph|photo|展|讲座|诗|书|茶|静|默|博物|美术|摄影|论坛|读/i;
const LOUD = /festival|party|club|rave|live|music|night|sale|pop|neon|summer|sport|race|节|派对|音乐|夜|狂|潮|夏|赛/i;
const SERIFISH = /Serif|Song|Ming|Mincho|Garamond|Caslon|Bodoni|Didot|Cormorant|Newsreader|Fraunces|Playfair|Libre|Source Serif|Crimson|Lora|Spectral|EB |Prata|Gloock|Instrument Serif|Chiron Sung/i;

export function paletteFit(f: FitInput): FitReport {
  const p = f.palette;
  const fails: string[] = [], notes: string[] = [];
  let s = 1;
  const flat = [p.bg, p.accent, p.alt, ...p.fills.slice(0, 3)];
  const loud = flat.map(hexToOklch).filter(([L, C]) => C > 0.13 && L > 0.35);
  // 1. the photo: a loud flat hue 50–130° away from every chromatic hue of the picture fights it
  const imgC = (f.image?.palette ?? []).map(hexToOklch).filter(([, C]) => C > 0.05);
  if (imgC.length && f.image?.tier !== 'proc') {
    const fight = loud.filter(([, , h]) => imgC.every(([, , ih]) => { const d = hd(h, ih); return d > 50 && d < 130; }));
    if (fight.length) { s -= 0.25 * fight.length; notes.push(`${fight.length} loud colour(s) fight the picture`); if (fight.some(([, C]) => C > 0.15)) fails.push('fights-image'); }
  }
  // 2. mood: quiet copy under neon / very saturated grounds; festive copy in an all-grey palette
  const copy = f.copy ?? '';
  const meanC = flat.map(hexToOklch).reduce((a, [, C]) => a + C, 0) / flat.length;
  const neon = flat.map(hexToOklch).filter(([L, C]) => C > 0.2 && L > 0.6);
  const [bL, bC] = hexToOklch(p.bg);
  if (QUIET.test(copy) && !LOUD.test(copy)) {
    if (neon.length || (bC > 0.17 && bL > 0.55)) { s -= 0.35; fails.push('mood-quiet-vs-neon'); }
    else if (meanC > 0.16) { s -= 0.3; fails.push('mood-quiet-vs-neon'); }
    else if (meanC > 0.12) { s -= 0.15; notes.push('quiet copy, saturated palette'); }
  } else if (LOUD.test(copy) && meanC < 0.025 && !QUIET.test(copy)) { s -= 0.1; notes.push('festive copy, grey palette'); }
  // 3. font: a light / thin serif display over a neon ground or in neon ink reads cheap
  if (f.display && SERIFISH.test(f.display.family) && f.display.weight <= 400 && (neon.length || (bC > 0.2 && bL > 0.6))) { s -= 0.3; fails.push('thin-serif-neon'); }
  // 4. known-ugly combinations
  // 4a. muddy: a desaturated mid-tone ground with weak text contrast
  if (bL > 0.38 && bL < 0.66 && bC > 0.015 && bC < 0.07 && wcag(p.ink, p.bg) < 4.5) { s -= 0.35; fails.push('muddy-low-contrast'); }
  // 4b. vibrating: saturated ink / accent on a saturated ground of (near-)complementary hue and similar lightness
  for (const t of [p.ink, p.accent]) {
    const [tL, tC, th] = hexToOklch(t);
    if (tC > 0.13 && bC > 0.13 && hd(th, hexToOklch(p.bg)[2]) > 140 && Math.abs(tL - bL) < 0.18) { s -= 0.35; fails.push('vibrating-text'); break; }
  }
  // 5. several small misfits add up: a palette with too many notes is redrawn too
  if (!fails.length && s < 0.55) fails.push('poor-fit');
  return { score: Math.max(0, +s.toFixed(3)), fails, notes };
}
