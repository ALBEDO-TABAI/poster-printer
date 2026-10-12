// Multi-page decks: a sequence of pages that share one style (fonts, parameters, palette, copy set) and one
// grid (type + density + margins), while each page is drawn independently from its own seeds.
import { create } from 'zustand';
import { useStore, buildInput, type State } from '../store';
import { generate, type Seeds, type GenResult } from '../engine/generate';
import type { Palette } from '../engine/color/palette';
import { newSeed } from '../engine/rng';
import { compSize, type PlacedComponent } from '../engine/components';

export interface DeckPage { id: string; seeds: Seeds; comp: string; attempt?: number }
export interface DeckState {
  pages: DeckPage[]; cur: number;
  palette: Palette | null; grid: { type: string; density: string } | null; textSet: string | null;
  folio: boolean; noRepeat: boolean;
  set<K extends keyof DeckState>(k: K, v: DeckState[K]): void;
  start(n?: number): void;
  addPage(after?: number): void;
  duplicate(i: number): void;
  remove(i: number): void;
  move(i: number, d: number): void;
  drawPage(i: number): void;
  drawAll(): void;
  setComp(i: number, comp: string): void;
  recolor(): void;
}
const LS_KEY = 'rea.deck.v1';
const seeds = (): Seeds => ({ layout: newSeed(), text: newSeed(), color: newSeed(), image: newSeed() });
const pid = () => 'p' + Math.random().toString(36).slice(2, 8);
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } };
const saved = typeof localStorage !== 'undefined' ? load() : null;

export const useDeck = create<DeckState>((set, get) => {
  const persist = () => { const d = get(); try { localStorage.setItem(LS_KEY, JSON.stringify({ pages: d.pages, cur: d.cur, palette: d.palette, grid: d.grid, textSet: d.textSet, folio: d.folio, noRepeat: d.noRepeat })); } catch { /* quota */ } };
  const upd = (p: Partial<DeckState>) => { set(p); persist(); };
  return {
    pages: saved?.pages ?? [], cur: saved?.cur ?? 0, palette: saved?.palette ?? null, grid: saved?.grid ?? null, textSet: saved?.textSet ?? null,
    folio: saved?.folio ?? true, noRepeat: saved?.noRepeat ?? true,
    set(k, v) { upd({ [k]: v } as Partial<DeckState>); },
    /** start a deck from the current poster: it becomes the cover and fixes palette, grid and copy set */
    start(n = 6) {
      const s = useStore.getState();
      const r = s.result;
      const cover: DeckPage = { id: pid(), seeds: { ...s.seeds }, comp: r?.picked.comp ?? 'auto', attempt: r?.picked.attempt };
      const pages = [cover, ...Array.from({ length: n - 1 }, () => ({ id: pid(), seeds: { ...seeds(), color: s.seeds.color }, comp: 'auto' }))];
      upd({ pages, cur: 0, palette: r?.picked.palette ?? null, grid: r ? { type: r.picked.grid.type, density: r.picked.grid.density } : null, textSet: r?.picked.texts.set ?? null });
    },
    addPage(after) {
      const d = get(); const i = (after ?? d.pages.length - 1) + 1;
      const pages = [...d.pages]; pages.splice(i, 0, { id: pid(), seeds: seeds(), comp: 'auto' });
      upd({ pages, cur: i });
    },
    duplicate(i) { const d = get(); const pages = [...d.pages]; pages.splice(i + 1, 0, { ...d.pages[i], id: pid() }); upd({ pages, cur: i + 1 }); },
    remove(i) { const d = get(); if (d.pages.length <= 1) return; const pages = d.pages.filter((_, k) => k !== i); upd({ pages, cur: Math.min(d.cur, pages.length - 1) }); },
    move(i, dlt) { const d = get(); const j = i + dlt; if (j < 0 || j >= d.pages.length) return; const pages = [...d.pages]; [pages[i], pages[j]] = [pages[j], pages[i]]; upd({ pages, cur: j }); },
    drawPage(i) { const d = get(); upd({ pages: d.pages.map((p, k) => (k === i ? { ...p, seeds: { ...seeds(), color: p.seeds.color }, attempt: undefined } : p)) }); },
    drawAll() { const d = get(); upd({ pages: d.pages.map((p, k) => (k === 0 ? p : { ...p, seeds: { ...seeds(), color: p.seeds.color }, attempt: undefined })) }); },
    setComp(i, comp) { const d = get(); upd({ pages: d.pages.map((p, k) => (k === i ? { ...p, comp, attempt: undefined } : p)) }); },
    /** new shared palette: take it from a fresh colour draw of the cover */
    recolor() {
      const s = useStore.getState(); const d = get();
      if (!d.pages.length) return;
      const st: State = { ...s, seeds: { ...d.pages[0].seeds, color: newSeed() }, result: null, placed: [] };
      const r = generate(buildInput(st, {}, { textSet: d.textSet ?? 'auto' }));
      upd({ palette: r.picked.palette });
    },
  };
});

/** Render every page of the deck with the shared style. Pure w.r.t. the two stores' current state. */
export function renderDeck(s: State, d: Pick<DeckState, 'pages' | 'palette' | 'grid' | 'textSet' | 'folio' | 'noRepeat'>): GenResult[] {
  const used = new Set<string>();
  const out: GenResult[] = [];
  const n = d.pages.length;
  d.pages.forEach((pg, i) => {
    const all = [...s.presetImages, ...s.userImages];
    const pool = d.noRepeat ? all.filter((a) => !used.has(a.id)) : all;
    const sc = s.scene;
    const placed: PlacedComponent[] = [];
    if (d.folio && sc) {
      const z = compSize('folio', 1, sc.w, sc.h);
      const m = Math.min(sc.w, sc.h) * 0.025;
      placed.push({ id: 'folio', type: 'folio', x: (sc.w - z.w - m) / sc.w, y: (sc.h - z.h - m * 0.6) / sc.h, scale: 1, salt: 'f', color: 'auto', text: `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}` });
    }
    const st: State = { ...s, seeds: pg.seeds, result: null, placed, imgPick: [], imgCat: 'all', presetImages: pool.length >= 3 ? pool.filter((a) => !a.user) : s.presetImages, userImages: pool.length >= 3 ? pool.filter((a) => a.user) : s.userImages, locks: { text: false, color: false, image: false, images: false } };
    const patch: Record<string, string> = { composition: pg.comp };
    if (d.grid) { patch.gridType = d.grid.type; patch.density = d.grid.density; }
    if (d.textSet) patch.textSet = d.textSet;
    const inp = buildInput(st, {}, patch);
    inp.lockedPalette = d.palette ?? undefined;
    if (pg.attempt !== undefined) inp.forceAttempt = pg.attempt;
    inp.budgetMs = 60;
    const r = generate(inp);
    r.picked.imageIds.forEach((x) => used.add(x));
    out.push(r);
  });
  return out;
}
