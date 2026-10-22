import { Rng } from '../engine/rng';
import type { FontRecipe, FontSet } from '../engine/typo';
import { expandRecipe, ROLE_KEYS } from '../engine/typo';
import { PAIRINGS, MOOD_WEIGHTS, type Mood } from '../data/pairings';

export interface FontFile { url: string; weight: string; style: string; bytes: number; local?: string[] }
export interface FontEntry { family: string; slug: string; group: string; tags: string[]; cjk: boolean; license: string; source: string; wmin: number; wmax: number; weights: number[]; variable: boolean; files: FontFile[] }

let manifest: FontEntry[] = [];
const loaded = new Map<string, Promise<void>>();
export const ALWAYS = ['Sacramento', 'Great Vibes', 'Dancing Script', 'Pacifico', 'Anton', 'Bebas Neue', 'Oswald', 'Archivo Black', 'IBM Plex Mono', 'Instrument Serif', 'DM Serif Display', 'Playfair Display', 'Bodoni Moda', 'Source Han Sans CN', 'Source Han Serif CN'];

/**
 * Fonts whose licence forbids passing the files on. The app never ships them: an entry joins the library only
 * when the browser finds the copy installed on this machine (local() sources), so posters set in one render
 * here and fall back on machines without it.
 */
const michelangelus = (name: string, weight: string, style: string): FontFile =>
  ({ url: '', weight, style, bytes: 0, local: [`Michelangelus ${name}`, `Michelangelus-${name.replace(' ', '')}`] });
export const INSTALLED: FontEntry[] = [
  { family: 'Michelangelus', slug: 'michelangelus', group: 'classic-serif', tags: ['old-style', 'elegant', 'classical'], cjk: false,
    license: 'Microsoft EULA (installed locally, not bundled)', source: 'https://www.microsoft.com/en-us/download/details.aspx?id=108856',
    wmin: 400, wmax: 700, weights: [400, 700], variable: false,
    files: [michelangelus('Regular', '400', 'normal'), michelangelus('Italic', '400', 'italic'), michelangelus('Bold', '700', 'normal'), michelangelus('Bold Italic', '700', 'italic')] },
];
const fontSrc = (f: FontFile) => (f.local ? f.local.map((n) => `local("${n}")`).join(', ') : `url(${f.url}) format("woff2")`);
const isInstalled = (e: FontEntry) => new FontFace(e.family, fontSrc(e.files[0])).load().then(() => true, () => false);

export async function loadFontManifest(): Promise<FontEntry[]> {
  if (manifest.length) return manifest;
  const r = await fetch('/fonts/manifest.json');
  const shipped: FontEntry[] = await r.json();
  const found = await Promise.all(INSTALLED.map(isInstalled));
  manifest = [...shipped, ...INSTALLED.filter((_, i) => found[i])];
  return manifest;
}
export const fontList = () => manifest;
export const fontByFamily = (f: string) => manifest.find((m) => m.family === f);

export function ensureFont(family: string): Promise<void> {
  const ent = fontByFamily(family);
  if (!ent) return Promise.resolve();
  let p = loaded.get(family);
  if (!p) {
    p = Promise.all(
      ent.files.map(async (f) => {
        const ff = new FontFace(family, fontSrc(f), { weight: f.weight, style: f.style, display: 'block' });
        document.fonts.add(ff);
        try { await ff.load(); } catch (e) { console.warn('font load failed', family, e); }
      }),
    ).then(() => undefined);
    loaded.set(family, p);
  }
  return p;
}

export function familiesOf(fs: FontSet): string[] {
  const s = new Set<string>(ALWAYS);
  for (const lang of ['en', 'zh'] as const) for (const r of ROLE_KEYS) s.add(fs[lang][r].family);
  s.add(fs.glyph.family); s.add(fs.glyphZh.family);
  s.add('Noto Sans SC');
  return [...s];
}

export async function ensureFontSet(fs: FontSet) { await Promise.all(familiesOf(fs).map(ensureFont)); }

const b64cache = new Map<string, string>();
async function toDataUrl(url: string) {
  if (b64cache.has(url)) return b64cache.get(url)!;
  const blob = await (await fetch(url)).blob();
  const d = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob); });
  b64cache.set(url, d);
  return d;
}

/** @font-face CSS for given families, embedding woff2 as data URLs. Installed-only fonts stay local() references: their licence forbids embedding a copy. */
export async function fontFaceCss(families: string[]): Promise<string> {
  const parts: string[] = [];
  for (const fam of families) {
    const ent = fontByFamily(fam);
    if (!ent) continue;
    for (const f of ent.files) parts.push(`@font-face{font-family:"${fam}";src:${f.local ? fontSrc(f) : `url(${await toDataUrl(f.url)}) format("woff2")`};font-weight:${f.weight};font-style:${f.style};}`);
  }
  return parts.join('');
}

// ---------------- font "shake": draw a pairing

function wpick(rng: Rng, ent: FontEntry, want: 'heavy' | 'regular' | 'light'): number {
  const cands = ent.variable ? [ent.wmin, 300, 400, 500, 600, 700, 800, 900].filter((w) => w >= ent.wmin && w <= ent.wmax) : ent.weights.length ? ent.weights : [400];
  if (want === 'heavy') return rng.pick(cands.filter((w) => w >= 600).length ? cands.filter((w) => w >= 600) : [Math.max(...cands)]);
  if (want === 'light') return rng.pick(cands.filter((w) => w <= 400).length ? cands.filter((w) => w <= 400) : [Math.min(...cands)]);
  return cands.reduce((b, w) => (Math.abs(w - 400) < Math.abs(b - 400) ? w : b), cands[0]);
}

/**
 * Draw a font pairing. Pairings are curated by mood (src/data/pairings.ts) instead of combined at random:
 * the mood is drawn first, then one of its tested CN + EN pairings. `count` reduces the pairing to 1–3 families.
 */
export function shakeFonts(seed: string, count: number, mood?: Mood): { recipe: FontRecipe; set: FontSet; names: string[]; pairing: string; ratio: number } {
  const rng = new Rng('shake|' + seed);
  const avail = (f: string) => !manifest.length || !!fontByFamily(f);
  const pool = PAIRINGS.filter((p) => [p.recipe.display[0], p.recipe.text[0], p.recipe.caption[0], p.recipe.zhDisplay[0], p.recipe.zhText[0]].every(avail));
  const md: Mood = mood ?? rng.weighted(MOOD_WEIGHTS);
  const cands = pool.filter((p) => p.mood === md);
  const pk = rng.pick(cands.length ? cands : pool.length ? pool : PAIRINGS);
  const r = pk.recipe;
  let recipe: FontRecipe = { ...r };
  if (count <= 1) {
    const dEnt = fontByFamily(r.display[0]);
    const tw = dEnt ? wpick(rng, dEnt, 'light') : 400;
    recipe = { ...r, text: [r.display[0], tw], caption: [r.display[0], tw, { case: 'upper' }] };
  } else if (count === 2) recipe = { ...r, caption: [r.text[0], r.text[1], { case: 'upper' }] };
  return { recipe, set: expandRecipe(recipe), names: [...new Set([recipe.display[0], recipe.text[0], recipe.caption[0]])], pairing: pk.id, ratio: pk.ratio };
}
