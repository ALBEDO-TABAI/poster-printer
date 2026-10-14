// Phase 18: auxiliary / decorative info (辅助信息编排). Decorative info fills the secondary space — usually a band at the
// top or bottom edge, a corner or a side strip — and adds point / line / plane elements; its content barely matters, but
// with real copy nothing is invented: the texture paragraph is made of the copy itself (the programme joined by dots, the
// subtitle, the meta). Rules from the reference study (findings/micro.md, findings/wangzhihong.md):
// - a band holds 3–6 elements on a 4–5 column pitch with one pitch left empty (tension, never an even spread);
// - every element shares an axis: the band's top line, its bottom line or a column edge; mirrored neighbours;
// - at most 3 sizes per band (anchor, label, tiny); a tiny paragraph is a line element sized so its block is 1.0–1.3×
//   as tall as the label beside it; numbers become anchors 2–4 label lines tall;
// - role leaders (name——role), a dot or a ® as the point, a rule only when it separates or connects.
import type { Ctx } from '../gen/ctx';
import type { Rect } from '../gen/grid';
import type { PT } from '../gen/pick';
import type { Copy } from './copy';
import { realize, emit, type Paint, type Layout } from './realize';
import type { BoxNode, Construction, GNode, TextLeaf } from './types';

export interface AuxEnv { ctx: Ctx; copy: Copy; paint: Paint; tiny: number; used: Set<string>; /** the page grid's column starts */ xs?: number[] }
export type AuxKind = 'columns' | 'pairs' | 'handle' | 'corners' | 'leaders' | 'centred' | 'edge';

// the aux copy pool: what the main group did not show
function pool(env: AuxEnv) {
  const c = env.copy;
  const free = (p: PT | null | undefined) => !!p && !!p.t && !env.used.has(p.t);
  // one appearance per string across the pool's sources (sample copy repeats words between items and meta)
  const seen = new Set<string>();
  const once = (t: string) => (seen.has(t) ? false : (seen.add(t), true));
  const items = c.items.filter((i) => free(i.main) && once(i.main.t)).map((i) => ({ main: i.main, note: i.note && once(i.note.t) ? i.note : null }));
  const meta = c.meta.filter((m) => free(m) && once(m.t));
  const sub = free(c.sub) ? c.sub : null;
  const para = free(c.para) ? c.para : null;
  // texture: real copy only — the paragraph, else the programme, else the subtitle
  const texture: PT | null = para ?? (items.length >= 3 ? { t: items.map((i) => i.main.t).join(' · '), lang: items[0].main.lang } : null) ?? sub;
  // the Latin line (never the title itself), else the copy's signature word (a real brand / author line)
  const sig = env.ctx.texts.facts?.signature || null;
  const en = c.en && c.en !== c.title.t && !env.used.has(c.en) ? c.en : sig && !env.used.has(sig) ? sig : null;
  return { items, meta, sub, texture, num: c.num && !env.used.has(c.num.v) ? c.num : null, date: c.date && !env.used.has(c.date) ? c.date : null, year: c.year, en };
}

/** a literal text leaf (aux text is pre-chosen, so it travels as 'lit') */
const L = (t: string, k: number, o: Partial<TextLeaf> = {}): TextLeaf => ({ t: 'text', slot: 'lit', lit: t, k, ...o });
const col = (kids: GNode[], o: Partial<BoxNode> = {}): BoxNode => ({ t: 'box', dir: 'col', al: 'start', gap: 0.35, kids, ...o });
const row = (kids: GNode[], o: Partial<BoxNode> = {}): BoxNode => ({ t: 'box', dir: 'row', al: 'start', gap: 0.6, kids, ...o });
const asC = (root: BoxNode): Construction => ({ id: 'aux', zh: '辅助', en: 'aux', needs: [], shape: 'band', root });

let BAND: Rect | null = null;
function lay(env: AuxEnv, root: BoxNode): Layout | null {
  const L = realize({ ctx: env.ctx, copy: env.copy }, asC(root), env.tiny);
  if (!L || !BAND) return L;
  const k = Math.min(1, BAND.h / L.h, BAND.w / L.w);
  if (k >= 1) return L;
  if (k < 0.82) return null;
  return realize({ ctx: env.ctx, copy: env.copy }, asC(root), env.tiny * k);
}
/** the y of a block in a band: bottom bands sit on their bottom line, top bands hang from their top line */
const yIn = (r: Rect, h: number, ctx: Ctx) => (r.y + r.h / 2 > ctx.H * 0.55 ? r.y + r.h - h : r.y + r.h / 2 < ctx.H * 0.45 ? r.y : r.y + (r.h - h) / 2);
function put(env: AuxEnv, Lo: Layout, x: number, y: number) {
  // what a band shows is used: the next band does not repeat it
  for (const it of Lo.items) if (it.kind === 'text' && it.leaf.lit) env.used.add(it.leaf.lit);
  return emit(env.ctx, Lo, x, y, env.paint, 'small.main', 'ax').box;
}

/** tiny paragraph lines so its block stands 1.0–1.3× as tall as a label of k units */
function paraFor(t: string, labelK: number, maxChars = 140): TextLeaf {
  const s = t.length > maxChars ? t.slice(0, maxChars).replace(/\s+\S*$/, '') : t;
  const lines = Math.max(2, Math.min(5, Math.round((labelK * 1.15) / 1.15)));
  const zh = /[㐀-鿿]/.test(s);
  // a measure (in A) that yields about `lines` lines for this text
  const wrap = Math.max(10, Math.ceil((zh ? Array.from(s).length * 1.0 : s.length * 0.52) / lines));
  return L(s, 1, { wrap, w: 'medium', lead: 1.15, track: zh ? 20 : 0 });
}

/** a band of decorative info inside r; returns the boxes it occupies */
export function auxBand(env: AuxEnv, r: Rect, kind: AuxKind, rng: { chance(p: number): boolean; pick<T>(a: T[]): T; int(a: number, b: number): number }): Rect[] {
  if (r.h <= 0 || r.w <= 0) return [];
  BAND = r;
  try { return auxBandIn(env, r, kind, rng); } finally { BAND = null; }
}
function auxBandIn(env: AuxEnv, r: Rect, kind: AuxKind, rng: { chance(p: number): boolean; pick<T>(a: T[]): T; int(a: number, b: number): number }): Rect[] {
  const P = pool(env);
  const out: Rect[] = [];
  const labelK = rng.pick([1.5, 1.8, 2.2]);
  const cap = (s: string) => (/[A-Za-z]/.test(s) && !/[㐀-鿿]/.test(s) ? 'upper' : undefined);
  if (kind === 'columns') {
    // 3–5 groups on a pitch of w/4 or w/5, one pitch empty before the last group, which is flush right
    const groups: BoxNode[] = [];
    for (const it of P.items.slice(0, 3)) groups.push(col([L(it.main.t, labelK * 0.75, { w: 'bold', case: cap(it.main.t), max: 18 }), ...(it.note ? [L(it.note.t, 1, { max: 40, wrap: 13 })] : [])], { gap: 0.3 }));
    for (const m of P.meta.slice(0, Math.max(0, 3 - groups.length))) groups.push(col([L(m.t, 1, { w: 'medium', max: 36, wrap: 14 })]));
    if (P.year && groups.length < 4) groups.push(col([L(P.year, labelK * 0.75, { w: 'bold' })]));
    if (!groups.length) return out;
    const layouts = groups.map((g) => lay(env, g)).filter((x): x is Layout => !!x);
    if (!layouts.length) return out;
    const top = yIn(r, Math.max(...layouts.map((l) => l.h)), env.ctx);
    // the pitch: the page grid's column starts inside the band (every k-th, so 4–5 positions), else w/4 or w/5
    const inBand = (env.xs ?? []).filter((x) => x >= r.x - 1 && x < r.x + r.w - env.tiny * 4);
    const want = layouts.length >= 3 ? 5 : 4;
    const step = Math.max(1, Math.round(inBand.length / want));
    const grid = inBand.length >= 4 ? inBand.filter((_, i) => i % step === 0) : [];
    const pos = grid.length >= Math.min(layouts.length, 3) ? grid : Array.from({ length: want }, (_, i) => r.x + (i * r.w) / want);
    layouts.forEach((Lo, i) => {
      const last = i === layouts.length - 1 && layouts.length >= 2;
      if (!last && i >= pos.length) return;
      const x = last ? r.x + r.w - Lo.w : pos[i];
      const room = last ? Infinity : (pos[i + 1] ?? r.x + r.w) - pos[i];
      if (Lo.w > room * 0.95 && !last) return;
      // the flush-right group never runs into the group before it
      const prev = out[out.length - 1];
      if (last && prev && x < prev.x + prev.w + env.tiny * 1.5) return;
      out.push(put(env, Lo, x, top));
    });
    return out;
  }
  if (kind === 'pairs') {
    // a number anchor at one end, then label / value pairs top-aligned to it
    const kids: GNode[] = [];
    const n = P.date ?? P.num?.v ?? null;
    if (n) kids.push(L(n, labelK * 2, { w: 'bold', track: -30, face: 'display' }));
    for (const m of P.meta.slice(0, 2)) kids.push(col([L(m.t, 1, { max: 30, wrap: 16, w: 'medium' })], { gap: 0.2 }));
    if (!P.meta.length) for (const it of P.items.slice(0, 2)) kids.push(col([L(it.main.t, 1, { w: 'bold', max: 18 }), ...(it.note ? [L(it.note.t, 1, { max: 28 })] : [])], { gap: 0.2 }));
    if (kids.length < 2) return out;
    const Lo = lay(env, row(kids, { gap: 2.2, al: 'start' }));
    if (!Lo) return out;
    out.push(put(env, Lo, r.x, yIn(r, Lo.h, env.ctx)));
    if (rng.chance(0.4) && Lo.w < r.w * 0.6) {
      const bc = lay(env, row([{ t: 'mark', m: 'barcode', k: Math.min(Lo.h / env.tiny, 3) }]));
      if (bc) out.push(put(env, bc, r.x + r.w - bc.w, yIn(r, bc.h, env.ctx)));
    }
    return out;
  }
  if (kind === 'handle') {
    // a label beside a tiny paragraph as tall as the label (the paragraph is a line element)
    const label = P.en ?? P.meta[0]?.t ?? P.year;
    if (!label || !P.texture) return out;
    const lk = labelK * 1.3;
    const Lo = lay(env, row([L(label, lk, { w: 'bold', case: cap(label), max: 20 }), paraFor(P.texture.t, lk)], { gap: 1.6, al: 'center' }));
    if (!Lo) return out;
    const right = rng.chance(0.4);
    out.push(put(env, Lo, right ? r.x + r.w - Lo.w : r.x, yIn(r, Lo.h, env.ctx)));
    return out;
  }
  if (kind === 'leaders') {
    // role leaders: value ——— label, stacked, the rules' ends aligned
    const lines: GNode[] = [];
    for (const it of P.items.slice(0, 3)) lines.push(row([L(it.main.t, 1.2, { w: 'medium', max: 16 }), { t: 'mark', m: 'rule', k: 0.06, len: 3.2 }, ...(it.note ? [L(it.note.t, 0.9, { max: 14 })] : [])], { gap: 0.4, al: 'center' }));
    for (const m of P.meta.slice(0, Math.max(0, 3 - lines.length))) lines.push(L(m.t, 1.1, { max: 30 }));
    if (!lines.length) return out;
    const Lo = lay(env, col(lines, { gap: 0.5 }));
    if (!Lo) return out;
    out.push(put(env, Lo, rng.chance(0.5) ? r.x : r.x + r.w - Lo.w, yIn(r, Lo.h, env.ctx)));
    return out;
  }
  if (kind === 'corners') {
    // mirrored corner groups sharing the band's top line; the middle stays empty
    const left: GNode[] = [];
    if (P.en) left.push(L(P.en, labelK, { w: 'bold', case: 'upper', max: 22 }));
    for (const m of P.meta.slice(0, 2)) left.push(L(m.t, 1, { max: 28 }));
    const rightK: GNode[] = [];
    if (P.date ?? P.year) rightK.push(L((P.date ?? P.year)!, labelK, { w: 'bold' }));
    for (const it of P.items.slice(0, 2)) rightK.push(L(it.main.t, 1, { max: 22 }));
    const A1 = left.length ? lay(env, col(left, { gap: 0.3 })) : null;
    const B1 = rightK.length ? lay(env, col(rightK, { gap: 0.3, al: 'end' })) : null;
    const top = yIn(r, Math.max(A1?.h ?? 0, B1?.h ?? 0), env.ctx);
    if (A1) out.push(put(env, A1, r.x, top));
    if (B1) out.push(put(env, B1, r.x + r.w - B1.w, top));
    return out;
  }
  if (kind === 'centred') {
    // a centred label + paragraph stack, flanked by twin marks
    if (!P.texture) return out;
    const label = P.en ?? P.year ?? P.meta[0]?.t;
    const kids: GNode[] = [];
    if (label) kids.push(L(label, labelK, { w: 'bold', case: cap(label), max: 22 }));
    kids.push({ ...paraFor(P.texture.t, labelK), wrap: Math.min(34, Math.max(18, Math.round(r.w / env.tiny / 2.4))) });
    const Lo = lay(env, col(kids, { gap: 0.6, al: 'center' }));
    if (!Lo) return out;
    out.push(put(env, Lo, r.x + (r.w - Lo.w) / 2, yIn(r, Lo.h, env.ctx)));
    if (rng.chance(0.6) && Lo.w < r.w * 0.6) {
      for (const side of [0, 1]) {
        const dot = lay(env, row([{ t: 'mark', m: 'dot', k: 0.9 }]));
        if (dot) out.push(put(env, dot, side ? r.x + r.w - dot.w : r.x, r.y + r.h / 2 - dot.h / 2));
      }
    }
    return out;
  }
  return out;
}

/** a vertical strip of rotated Latin (or upright Han) along a side edge: an edge transition */
export function auxEdge(env: AuxEnv, r: Rect, side: 'left' | 'right'): Rect[] {
  const P = pool(env);
  const t = P.en ?? P.meta[0]?.t ?? P.year;
  if (!t) return [];
  const zh = /[㐀-鿿]/.test(t);
  const root = zh ? col([L(t, 1.6, { dir: 'v', max: 8 })]) : col([L(t, 1.3, { dir: 'rot', case: 'upper', track: 120, max: 30 })]);
  const Lo = lay(env, root);
  if (!Lo || Lo.h > r.h) return [];
  return [put(env, Lo, side === 'left' ? r.x : r.x + r.w - Lo.w, r.y)];
}
