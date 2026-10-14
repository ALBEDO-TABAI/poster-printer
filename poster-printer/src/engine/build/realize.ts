// Phase 18: realise a construction. Every length is a multiple of the base unit A, so a construction is laid out once
// at A = 1 and scaled exactly to its room (fitGroup). Mixed lines are set in runs: Han in the CJK face, Latin and
// figures in the Latin face of the same role, so a bilingual line keeps both voices.
import type { Ctx } from '../gen/ctx';
import type { RoleKey } from '../typo';
import type { TextNode, SceneNode } from '../types';
import type { FontSpec } from '../text/measure';
import type { Rect } from '../gen/grid';
import { semanticBreak } from '../p8/typeset';
import { breakWords } from '../text/breaker';
import { snapWeight } from './fontweights';
import { slotText, type Copy } from './copy';
import type { BoxNode, Construction, Frame, GNode, MarkLeaf, TextLeaf, Weight } from './types';

const HANRUN = /[　-〿㐀-鿿＀-￯⺀-⿟「」『』【】（）《》]/;
const WEIGHT: Record<Weight, number> = { black: 900, bold: 700, medium: 500, regular: 400, light: 300 };
const FACE_ROLE: Record<string, RoleKey> = { display: 'big.main', text: 'small.main', caption: 'small.note', mono: 'small.note' };

export interface Run { text: string; zh: boolean; family: string; weight: number; dx: number; w: number }
export interface PLine { runs: Run[]; w: number; base: number } // base: baseline offset from the item's top
export interface PText { kind: 'text'; x: number; y: number; w: number; h: number; size: number; track: number; lines: PLine[]; leaf: TextLeaf; dir?: 'v' | 'rot'; italic?: boolean; al?: 'center' | 'end' }
export interface PMark { kind: 'mark'; x: number; y: number; w: number; h: number; leaf: MarkLeaf }
export interface PFrame { kind: 'frame'; x: number; y: number; w: number; h: number; frame: Frame }
export type Placed = PText | PMark | PFrame;
export interface Layout { w: number; h: number; items: Placed[]; base: number; inverse?: boolean }

export interface RealizeEnv { ctx: Ctx; copy: Copy }

const textKey = (l: TextLeaf) => FACE_ROLE[l.face ?? (l.k >= 2.2 ? 'display' : 'text')];

function applyCase(t: string, c?: TextLeaf['case']) {
  if (!c) return t;
  if (c === 'upper') return t.toUpperCase();
  if (c === 'lower') return t.toLowerCase();
  return t.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** split a line into script runs (Han + full-width punctuation vs everything else) */
function runsOf(line: string): { text: string; zh: boolean }[] {
  const out: { text: string; zh: boolean }[] = [];
  for (const ch of Array.from(line)) {
    const zh = HANRUN.test(ch);
    const last = out[out.length - 1];
    if (last && (last.zh === zh || ch === ' ')) last.text += ch;
    else out.push({ text: ch, zh });
  }
  return out;
}

function fontsFor(env: RealizeEnv, leaf: TextLeaf) {
  const rk = textKey(leaf);
  const zh = env.ctx.role(rk, 'zh'), en = env.ctx.role(rk, 'en');
  const want = leaf.w ? WEIGHT[leaf.w] : null;
  const wz = snapWeight(zh.family, want ?? zh.weight), we = snapWeight(en.family, want ?? en.weight);
  return { zh: { family: zh.family, weight: wz }, en: { family: en.family, weight: we, italic: leaf.italic ?? en.italic } };
}

function measureLine(env: RealizeEnv, line: string, f: ReturnType<typeof fontsFor>, size: number, track: number): PLine {
  const runs: Run[] = [];
  let x = 0;
  for (const r of runsOf(line)) {
    const ff = r.zh ? f.zh : f.en;
    const sp: FontSpec = { family: ff.family, weight: ff.weight, size, tracking: track, italic: !r.zh && f.en.italic };
    const w = env.ctx.measure.width(r.text, sp);
    runs.push({ text: r.text, zh: r.zh, family: ff.family, weight: ff.weight, dx: x, w });
    x += w;
  }
  return { runs, w: x, base: 0 };
}

/** cap height of a line set in these fonts (Han glyphs read at ~0.86 em, Latin at the face's cap height) */
function capOf(env: RealizeEnv, line: PLine, size: number) {
  let c = 0;
  for (const r of line.runs) c = Math.max(c, r.zh ? 0.86 : env.ctx.measure.metrics({ family: r.family, weight: r.weight, size: 100 }).cap);
  return (c || 0.72) * size;
}

/** the ink below the last baseline: Latin descenders (g j p q y) reach ~0.2 em, Han glyphs ~0.1 em, caps and figures sit on it */
function descOf(line: string, size: number): number {
  if (/[gjpqy,;()（）]/.test(line)) return size * 0.2;
  if (HANRUN.test(line)) return size * 0.1;
  return size * 0.02;
}

function breakText(env: RealizeEnv, t: string, zh: boolean, leaf: TextLeaf, size: number, f: ReturnType<typeof fontsFor>, track: number): string[] {
  if (t.includes('\n')) return t.split('\n');
  const wf = (s: string) => measureLine(env, s, f, 100, track).w;
  if (leaf.wrap) {
    const max = leaf.wrap * size / leaf.k; // wrap is in units of A; size = k·A
    if (zh) {
      const out: string[] = []; let cur = '';
      for (const ch of Array.from(t)) { if (cur && measureLine(env, cur + ch, f, size, track).w > max) { out.push(cur); cur = ch.trim() ? ch : ''; } else cur += ch; }
      if (cur) out.push(cur);
      return out;
    }
    const words = t.split(/\s+/); const out: string[] = []; let cur = '';
    for (const w of words) { const c = cur ? cur + ' ' + w : w; if (cur && measureLine(env, c, f, size, track).w > max) { out.push(cur); cur = w; } else cur = c; }
    if (cur) out.push(cur);
    return out;
  }
  if (leaf.lines && leaf.lines > 1) {
    const n = zh ? Array.from(t.replace(/\s/g, '')).length : t.split(/\s+/).length;
    const k = zh ? Math.min(leaf.lines, Math.floor(n / 2.5)) : Math.min(leaf.lines, n);
    if (k <= 1) return [t];
    if (zh) return semanticBreak(t, { k, profile: 'balanced', width: wf }) ?? [t];
    return breakWords(t, k, wf);
  }
  return [t];
}

function layText(env: RealizeEnv, leaf: TextLeaf, A: number): PText | null {
  const p = slotText(env.copy, leaf.slot, leaf.idx ?? 0, leaf.lit);
  if (!p || !p.t.trim()) return null;
  let t = p.t.trim();
  const zh = p.lang === 'zh';
  if (leaf.max && Array.from(t).length > leaf.max) {
    // real copy: a fact (date, venue, price, programme line, subtitle) is shown whole or not here — never cut
    if (env.copy.custom && (env.copy.meta.some((m) => m.t === p.t) || env.copy.items.some((i) => i.main.t === p.t || i.note?.t === p.t) || env.copy.sub?.t === p.t || env.copy.date === p.t)) return null;
    // cut at a phrase or word boundary, never inside a word; nothing sensible fits → the leaf is empty
    const cut = zh ? t.slice(0, leaf.max).replace(/[，。、；：,.;: ][^，。、；：,.;: ]*$/, '') : t.slice(0, leaf.max + 1).replace(/\s+\S*$/, '');
    if (!cut || Array.from(cut).length < Math.min(4, leaf.max / 2)) return null;
    t = cut.replace(/[，、,;：:]$/, '').trim();
  }
  t = zh ? t : applyCase(t, leaf.case);
  const size = leaf.k * A;
  const display = leaf.face === 'display' || (!leaf.face && leaf.k >= 2.2);
  const track = (leaf.track ?? (display ? -30 : -10)) / 1000;
  const lead = leaf.lead ?? (display ? 0.95 : leaf.wrap ? 1.25 : 1.12);
  const f = fontsFor(env, leaf);
  if (leaf.dir === 'v') {
    // a vertical Han column: one character per line, advance = size · lead
    const chars = Array.from(t.replace(/\s/g, ''));
    const lines = chars.map((c) => ({ ...measureLine(env, c, f, size, 0), base: 0 }));
    const adv = size * Math.max(1, lead);
    lines.forEach((l, i) => (l.base = size * 0.88 + i * adv));
    return { kind: 'text', x: 0, y: 0, w: size, h: size * 0.94 + (chars.length - 1) * adv, size, track: 0, lines, leaf, dir: 'v' };
  }
  const raw = breakText(env, t, zh, leaf, size, f, track);
  const lines = raw.map((s) => measureLine(env, s, f, size, track));
  const cap = capOf(env, lines[0], size);
  lines.forEach((l, i) => (l.base = cap + i * size * lead));
  const w = Math.max(...lines.map((l) => l.w));
  const h = cap + (lines.length - 1) * size * lead + descOf(raw[raw.length - 1], size);
  if (leaf.dir === 'rot') return { kind: 'text', x: 0, y: 0, w: h, h: w, size, track, lines, leaf, dir: 'rot', italic: f.en.italic };
  return { kind: 'text', x: 0, y: 0, w, h, size, track, lines, leaf, italic: f.en.italic };
}

function layMark(leaf: MarkLeaf, A: number, colW: number): PMark {
  const s = leaf.k * A;
  if (leaf.m === 'rule') { const len = leaf.len === 'fill' ? colW : (leaf.len ?? 6) * A; return { kind: 'mark', x: 0, y: 0, w: len, h: Math.max(1, s), leaf }; }
  if (leaf.m === 'vrule') return { kind: 'mark', x: 0, y: 0, w: Math.max(1, A * 0.09), h: s, leaf };
  if (leaf.m === 'barcode') return { kind: 'mark', x: 0, y: 0, w: s * 2.6, h: s, leaf };
  if (leaf.m === 'arrow') return { kind: 'mark', x: 0, y: 0, w: s * 1.4, h: s, leaf };
  return { kind: 'mark', x: 0, y: 0, w: s, h: s, leaf };
}

const shift = (items: Placed[], dx: number, dy: number) => items.map((it) => ({ ...it, x: it.x + dx, y: it.y + dy }));

/** lay out a node at base unit A; null = a required slot is empty */
export function layNode(env: RealizeEnv, n: GNode, A: number, colW = 0): Layout | null {
  if (n.t === 'box' && n.dir === 'row' && n.fill && colW > 0) return layBox(env, n, A, colW);
  if (n.t === 'text') {
    const p = layText(env, n, A);
    if (!p) return null;
    return { w: p.w, h: p.h, items: [p], base: p.dir ? p.h : p.lines[0].base };
  }
  if (n.t === 'mark') { const m = layMark(n, A, colW); return { w: m.w, h: m.h, items: [m], base: m.h }; }
  return layBox(env, n, A);
}

function layBox(env: RealizeEnv, b: BoxNode, A: number, targetW = 0): Layout | null {
  // first pass: the children that do not depend on the column width
  const kids: { n: GNode; L: Layout | null }[] = [];
  for (const k of b.kids) {
    const lazy = (k.t === 'text' && !!k.fit) || (k.t === 'mark' && k.len === 'fill' && b.dir === 'col') || (k.t === 'box' && k.dir === 'row' && !!k.fill && b.dir === 'col') || (b.dir === 'row' && !!b.fill && k.t === 'mark' && k.len === 'fill');
    const L = lazy ? null : layNode(env, k, A);
    if (!lazy && !L) { if (k.opt || (k.t === 'box' && k.opt)) continue; return null; }
    kids.push({ n: k, L });
  }
  const gap = (b.gap ?? 0.5) * A;
  const pad = b.frame ? (b.frame.pad ?? 0.6) * A : 0;
  if (b.dir === 'col') {
    const W0 = Math.max(0, ...kids.filter((k) => k.L).map((k) => k.L!.w));
    // second pass: justified lines span the column; fill rules take its width
    for (const k of kids) {
      if (k.L) continue;
      if (k.n.t === 'text') {
        const L1 = layNode(env, { ...k.n, fit: undefined }, A);
        if (!L1) { k.L = null; continue; }
        if (k.n.fit === 'track' && W0 > L1.w) {
          // letterspace: the extra width spread over the gaps between characters (tracking is per character, in 1/1000 em)
          const p = L1.items[0] as PText; const n = Math.max(1, Math.max(...p.lines.map((l) => Array.from(l.runs.map((q) => q.text).join('')).length)) - 1);
          const extra = ((W0 - L1.w) / n / p.size) * 1000;
          // the leaf's effective tracking (its display / text default when unset) plus the spread
          k.L = layNode(env, { ...k.n, fit: undefined, track: p.track * 1000 + extra }, A);
        } else {
          const s = W0 > 0 ? W0 / L1.w : 1;
          k.L = layNode(env, { ...k.n, k: k.n.k * s, fit: undefined }, A);
        }
      } else k.L = layNode(env, k.n, A, W0);
    }
    const live = kids.filter((k) => k.L);
    if (!live.length) return null;
    // a child's indent (dx) widens the column: the stair's last step is inside the group's box
    const W = Math.max(...live.map((k) => k.L!.w + Math.max(0, ((k.n as BoxNode).dx ?? 0) * A)));
    let y = pad; const items: Placed[] = [];
    let base = 0;
    const stair = live.some((k) => ((k.n as BoxNode).dx ?? 0) > 0);
    const lone = (L: Layout) => (L.items.length === 1 && L.items[0].kind === 'text' && !(L.items[0] as PText).dir ? (L.items[0] as PText) : null);
    live.forEach((k, i) => {
      const L = k.L!;
      if (i > 0) {
        // two lines at one size (a broken title, a stack of small lines) keep their baseline step, size · lead: display
        // 0.9–1.0, information ~1.12–1.25, never closer than the ink gap asked for
        const P = lone(live[i - 1].L!), N = lone(L);
        if (P && N && Math.abs(P.size - N.size) <= 0.02 * N.size) {
          const lead = N.leaf.lead ?? (N.size >= 2.2 * A ? 0.95 : N.leaf.wrap ? 1.25 : 1.12);
          const prevTop = y - gap - live[i - 1].L!.h;
          const lastBase = prevTop + P.y + P.lines[P.lines.length - 1].base;
          y = Math.max(y, lastBase + N.size * lead - L.base);
        }
      }
      const dx = ((k.n as BoxNode).dx ?? 0) * A;
      // an indented column (a staircase) reads from its left edge: the indent replaces the alignment, and no child leaves the box
      const x = pad + Math.min(W - L.w, dx + (stair ? 0 : b.al === 'center' ? (W - L.w) / 2 : b.al === 'end' ? W - L.w : 0));
      if (i === 0) base = y + L.base;
      const its = (b.al === 'center' || b.al === 'end') && k.n.t === 'text' ? L.items.map((it) => (it.kind === 'text' ? { ...it, al: b.al as 'center' | 'end' } : it)) : L.items;
      items.push(...shift(its, x, y));
      y += L.h + (i < live.length - 1 ? gap : 0);
    });
    const out: Layout = { w: W + 2 * pad, h: y + pad, items, base };
    return frameIt(b.frame, out);
  }
  // row
  for (const k of kids) if (!k.L && !(k.n.t === 'mark' && k.n.len === 'fill')) k.L = layNode(env, k.n, A, 0);
  if (b.fill && targetW > 0) {
    const fixed = kids.filter((k) => k.L).reduce((a, k) => a + k.L!.w, 0) + gap * Math.max(0, kids.length - 1);
    for (const k of kids) if (!k.L && k.n.t === 'mark') k.L = layNode(env, { ...k.n, len: Math.max(0.5, (targetW - fixed) / A) }, A, 0);
  }
  // label lock: a locked column stands exactly as tall as the cap height of the row's biggest element
  const ref = Math.max(0, ...kids.filter((k) => k.L && !(k.n.t === 'box' && k.n.lock)).map((k) => k.L!.base));
  for (const k of kids) if (k.L && k.n.t === 'box' && k.n.lock && ref > 0 && k.L.h > 0) k.L = layNode(env, k.n, (A * ref) / k.L.h);
  const live = kids.filter((k) => k.L);
  if (!live.length) return null;
  const H = Math.max(...live.map((k) => k.L!.h));
  const B = Math.max(...live.map((k) => k.L!.base));
  let x = pad; const items: Placed[] = [];
  // a filling row without a rule spreads its cells: first flush-left, last flush-right, the rest evenly between
  const natural = live.reduce((a, k) => a + k.L!.w, 0) + gap * Math.max(0, live.length - 1);
  const spreadGap = b.fill && targetW > natural && live.length > 1 && !kids.some((k) => k.n.t === 'mark' && k.n.len === 'fill') ? gap + (targetW - natural) / (live.length - 1) : gap;
  const ys = live.map((k) => {
    const L = k.L!;
    const lockTop = k.n.t === 'box' && k.n.lock;
    const dy = ((k.n as { dy?: number }).dy ?? 0) * A;
    return pad + dy + (lockTop ? 0 : b.al === 'end' ? H - L.h : b.al === 'center' ? (H - L.h) / 2 : b.al === 'base' ? B - L.base : 0);
  });
  // a raised cell (dy < 0) lifts the row's top: everything moves down so the box holds it
  const lift = Math.max(0, pad - Math.min(...ys));
  live.forEach((k, i) => {
    const L = k.L!;
    items.push(...shift(L.items, x, ys[i] + lift));
    x += L.w + (i < live.length - 1 ? spreadGap : 0);
  });
  const bottom = Math.max(...live.map((k, i) => ys[i] + lift + k.L!.h));
  return frameIt(b.frame, { w: x + pad, h: bottom + pad, items, base: pad + B + lift });
}

function frameIt(fr: Frame | undefined, L: Layout): Layout {
  if (!fr) return L;
  if (fr.f === 'circle' || fr.f === 'disc') {
    const d = Math.max(L.w, L.h) * 1.12;
    const items = shift(L.items, (d - L.w) / 2, (d - L.h) / 2);
    return { w: d, h: d, items: [{ kind: 'frame', x: 0, y: 0, w: d, h: d, frame: fr }, ...items], base: L.base + (d - L.h) / 2, inverse: fr.f === 'disc' };
  }
  const f: PFrame = { kind: 'frame', x: 0, y: 0, w: L.w, h: L.h, frame: fr };
  return { ...L, items: [f, ...L.items], inverse: fr.f === 'pill' || fr.f === 'fill' };
}

/** realise a construction at base unit A */
export function realize(env: RealizeEnv, c: Construction, A: number): Layout | null {
  return c.root ? layBox(env, c.root, A) : null;
}

/** the smallest size (in units of A) the construction uses, to keep small text above the legible minimum */
export function minK(n: GNode | undefined): number {
  if (!n) return 1;
  if (n.t === 'text') return n.k;
  if (n.t === 'mark') return Infinity;
  return Math.min(...n.kids.map(minK));
}

export interface Fitted { A: number; L: Layout; c: Construction; fill: number }
/** the largest A at which the construction fits the room; null = it does not fit with legible small text */
export function fitGroup(env: RealizeEnv, c: Construction, room: { w: number; h: number }, minPx: number, maxA = Infinity): Fitted | null {
  const L1 = realize(env, c, 10);
  if (!L1 || L1.w <= 0 || L1.h <= 0) return null;
  const A = Math.min(maxA, (10 * room.w) / L1.w, (10 * room.h) / L1.h);
  const kmin = minK(c.root);
  if (A * kmin < minPx) return null;
  const L = realize(env, c, A);
  if (!L) return null;
  // the realised sizes (justified lines scale with their character count): every text stays legible
  const sizes = L.items.filter((it): it is PText => it.kind === 'text').map((it) => it.size);
  if (sizes.length && Math.min(...sizes) < minPx * 0.92) return null;
  return { A, L, c, fill: (L.w * L.h) / (room.w * room.h) };
}

export interface Paint { ink: string; accent: string; soft: string; on: string; onFill: string; fillCol: string }

/** emit the scene nodes of a realised layout with its top-left at (x, y) */
export function emit(ctx: Ctx, L: Layout, x0: number, y0: number, paint: Paint, role = 'big.main', idPrefix = 'tg'): { ids: string[]; box: Rect } {
  const ids: string[] = [];
  let inv = false;
  for (const it of L.items) {
    const X = x0 + it.x, Y = y0 + it.y;
    if (it.kind === 'frame') {
      const fr = it.frame; const col = fr.accent ? paint.accent : paint.ink;
      const add = (n: SceneNode) => { ctx.add(n); ids.push(n.id); };
      const sw = Math.max(1, it.h * 0.035);
      if (fr.f === 'circle') { add({ kind: 'circle', id: ctx.id(idPrefix + 'f'), layer: 'lines', cx: X + it.w / 2, cy: Y + it.h / 2, r: it.w / 2 - sw, fill: 'none', stroke: col, sw: sw * 1.2 }); continue; }
      if (fr.f === 'disc') { inv = true; add({ kind: 'circle', id: ctx.id(idPrefix + 'f'), layer: 'zones', cx: X + it.w / 2, cy: Y + it.h / 2, r: it.w / 2, fill: fr.accent ? paint.accent : paint.fillCol }); continue; }
      if (fr.f === 'hl') { add({ kind: 'rect', id: ctx.id(idPrefix + 'f'), layer: 'zones', x: X, y: Y + it.h * 0.08, w: it.w, h: it.h * 0.84, fill: paint.accent }); continue; }
      if (fr.f === 'fill' || fr.f === 'pill') { inv = true; add({ kind: 'rect', id: ctx.id(idPrefix + 'f'), layer: 'zones', x: X, y: Y, w: it.w, h: it.h, rx: fr.f === 'pill' ? it.h / 2 : 0, fill: fr.accent ? paint.accent : paint.fillCol }); }
      else if (fr.f === 'box') add({ kind: 'rect', id: ctx.id(idPrefix + 'f'), layer: 'lines', x: X, y: Y, w: it.w, h: it.h, fill: 'none', stroke: col, sw });
      else if (fr.f === 'under' || fr.f === 'over') add({ kind: 'line', id: ctx.id(idPrefix + 'f'), layer: 'lines', x1: X, y1: fr.f === 'under' ? Y + it.h : Y, x2: X + it.w, y2: fr.f === 'under' ? Y + it.h : Y, stroke: col, sw });
      else if (fr.f === 'side') add({ kind: 'line', id: ctx.id(idPrefix + 'f'), layer: 'lines', x1: X, y1: Y, x2: X, y2: Y + it.h, stroke: col, sw: sw * 2.2 });
      else if (fr.f === 'bracket' || fr.f === 'corner') {
        const t = Math.min(it.w, it.h) * 0.22;
        const d = fr.f === 'bracket' ? `M${X + t} ${Y}H${X}V${Y + t}M${X + it.w - t} ${Y + it.h}H${X + it.w}V${Y + it.h - t}` : `M${X} ${Y + t}V${Y}H${X + t}M${X + it.w - t} ${Y}H${X + it.w}V${Y + t}M${X + it.w} ${Y + it.h - t}V${Y + it.h}H${X + it.w - t}M${X + t} ${Y + it.h}H${X}V${Y + it.h - t}`;
        add({ kind: 'path', id: ctx.id(idPrefix + 'f'), layer: 'lines', d, fill: 'none', stroke: col, sw: sw * 1.4 });
      } else if (fr.f === 'paren') {
        const r = it.h * 0.5, k = Math.min(it.w * 0.12, it.h * 0.18);
        add({ kind: 'path', id: ctx.id(idPrefix + 'f'), layer: 'lines', d: `M${X + k} ${Y}Q${X - k * 0.4} ${Y + r} ${X + k} ${Y + it.h}M${X + it.w - k} ${Y}Q${X + it.w + k * 0.4} ${Y + r} ${X + it.w - k} ${Y + it.h}`, fill: 'none', stroke: col, sw: sw * 1.3 });
      }
      continue;
    }
    if (it.kind === 'mark') { ids.push(...emitMark(ctx, it, X, Y, it.leaf.accent ? paint.accent : inv ? paint.onFill : paint.ink, idPrefix)); continue; }
    const leaf = it.leaf;
    // the unit: the copy this text shows (a broken title's lines, a 2×2 block's characters, the halves of a split word all
    // read as one title); a literal of no slot is its own unit
    const src = leaf.slot !== 'lit' ? `${leaf.slot}:${leaf.idx ?? 0}` : leaf.of ? `${leaf.of}:${leaf.idx ?? 0}` : null;
    const unit = src ? 'u:' + src : ctx.id('u');
    const fill = leaf.accent ? paint.accent : inv ? paint.onFill : leaf.face === 'caption' ? paint.soft : paint.ink;
    const r = leaf.k >= 2.2 || leaf.face === 'display' ? role : leaf.face === 'caption' ? 'small.note' : 'small.main';
    if (it.dir === 'v') {
      const n: TextNode = { kind: 'text', id: ctx.id(idPrefix), layer: 'text', role: r, lang: 'zh', lines: it.lines.map((l) => ({ text: l.runs.map((q) => q.text).join(''), x: X + it.w / 2, y: Y + l.base })), size: it.size, family: it.lines[0].runs[0].family, weight: it.lines[0].runs[0].weight, tracking: 0, fill, anchor: 'middle', box: { x: X, y: Y, w: it.w, h: it.h }, raw: it.lines.map((l) => l.runs[0].text).join(''), vertical: true, unit };
      ctx.add(n); ids.push(n.id); continue;
    }
    if (it.dir === 'rot') {
      // rotated −90°: the line runs bottom to top along the box's right edge
      const l = it.lines[0];
      for (const q of l.runs) {
        // the svg renderer rotates about (box.x, box.y): the box sits on the text origin
        const ax = X + l.base, ay = Y + it.h - q.dx;
        const n: TextNode = { kind: 'text', id: ctx.id(idPrefix), layer: 'text', role: r, lang: q.zh ? 'zh' : 'en', lines: [{ text: q.text, x: ax, y: ay }], size: it.size, family: q.family, weight: q.weight, tracking: it.track, fill, anchor: 'start', box: { x: ax, y: ay, w: 1, h: 1 }, raw: q.text, rotate: -90, unit };
        ctx.add(n); ids.push(n.id);
      }
      continue;
    }
    for (const l of it.lines) {
      for (const q of l.runs) {
        const lx = X + alignOffset(it, l) + q.dx;
        const n: TextNode = { kind: 'text', id: ctx.id(idPrefix), layer: 'text', role: r, lang: q.zh ? 'zh' : 'en', lines: [{ text: q.text, x: lx, y: Y + l.base }], size: it.size, family: q.family, weight: q.weight, tracking: it.track, italic: !q.zh && it.italic ? true : undefined, fill: leaf.outline ? 'none' : fill, ...(leaf.outline ? { stroke: fill, sw: Math.max(1, it.size * 0.022) } : {}), anchor: 'start', box: { x: lx, y: Y + l.base - (it.lines[0].base), w: q.w, h: it.lines[0].base }, raw: q.text, unit };
        ctx.add(n); ids.push(n.id);
      }
    }
  }
  const box = { x: x0, y: y0, w: L.w, h: L.h };
  ctx.occupied.push(box);
  return { ids, box };
}

/** lines of a multi-line leaf share the leaf's alignment (start by default; centre / end when its column is aligned so) */
function alignOffset(it: PText, l: PLine): number {
  if (it.al === 'center') return (it.w - l.w) / 2;
  if (it.al === 'end') return it.w - l.w;
  return 0;
}

function emitMark(ctx: Ctx, it: PMark, X: number, Y: number, col: string, p: string): string[] {
  const m = it.leaf.m, w = it.w, h = it.h, cx = X + w / 2, cy = Y + h / 2, r = Math.min(w, h) / 2;
  const sw = Math.max(1, h * 0.09);
  const id = ctx.id(p + 'm');
  let n: SceneNode | null = null;
  switch (m) {
    case 'dot': n = { kind: 'circle', id, layer: 'ornament', cx, cy, r, fill: col }; break;
    case 'ring': n = { kind: 'circle', id, layer: 'ornament', cx, cy, r: r - sw / 2, fill: 'none', stroke: col, sw }; break;
    case 'square': n = { kind: 'rect', id, layer: 'ornament', x: X, y: Y, w, h, fill: col }; break;
    case 'tri': n = { kind: 'path', id, layer: 'ornament', d: `M${X} ${Y + h}L${cx} ${Y}L${X + w} ${Y + h}Z`, fill: col }; break;
    case 'rule': n = { kind: 'rect', id, layer: 'lines', x: X, y: Y, w, h, fill: col }; break;
    case 'vrule': n = { kind: 'rect', id, layer: 'lines', x: X, y: Y, w, h, fill: col }; break;
    case 'slash': n = { kind: 'line', id, layer: 'lines', x1: X + w * 0.15, y1: Y + h, x2: X + w * 0.85, y2: Y, stroke: col, sw }; break;
    case 'times': n = { kind: 'path', id, layer: 'ornament', d: `M${X + w * 0.15} ${Y + h * 0.15}L${X + w * 0.85} ${Y + h * 0.85}M${X + w * 0.85} ${Y + h * 0.15}L${X + w * 0.15} ${Y + h * 0.85}`, stroke: col, sw, fill: 'none' }; break;
    case 'plus': n = { kind: 'path', id, layer: 'ornament', d: `M${cx} ${Y}V${Y + h}M${X} ${cy}H${X + w}`, stroke: col, sw, fill: 'none' }; break;
    case 'star': { const d = [0, 60, 120].map((a) => { const q = (a * Math.PI) / 180, dx = Math.cos(q) * r, dy = Math.sin(q) * r; return `M${cx - dx} ${cy - dy}L${cx + dx} ${cy + dy}`; }).join(''); n = { kind: 'path', id, layer: 'ornament', d, stroke: col, sw: sw * 1.1, fill: 'none' }; break; }
    case 'hash': n = { kind: 'path', id, layer: 'ornament', d: `M${X + w * 0.38} ${Y}L${X + w * 0.28} ${Y + h}M${X + w * 0.72} ${Y}L${X + w * 0.62} ${Y + h}M${X + w * 0.08} ${Y + h * 0.34}H${X + w * 0.96}M${X + w * 0.04} ${Y + h * 0.66}H${X + w * 0.92}`, stroke: col, sw, fill: 'none' }; break;
    case 'arrow': n = { kind: 'path', id, layer: 'ornament', d: `M${X} ${cy}H${X + w}M${X + w - h * 0.4} ${cy - h * 0.38}L${X + w} ${cy}L${X + w - h * 0.4} ${cy + h * 0.38}`, stroke: col, sw, fill: 'none' }; break;
    case 'nosign': n = { kind: 'path', id, layer: 'ornament', d: `M${cx - r + sw / 2} ${cy}a${r - sw / 2} ${r - sw / 2} 0 1 0 ${2 * r - sw} 0a${r - sw / 2} ${r - sw / 2} 0 1 0 ${-(2 * r - sw)} 0M${cx - r * 0.62} ${cy + r * 0.62}L${cx + r * 0.62} ${cy - r * 0.62}`, stroke: col, sw, fill: 'none' }; break;
    case 'barcode': {
      let d = ''; let x = X; let i = 0;
      while (x < X + w) { const bw = (i % 3 === 0 ? 2.2 : i % 2 ? 0.8 : 1.4) * (w / 60); d += `M${x} ${Y}h${bw}v${h}h${-bw}Z`; x += bw + (i % 4 === 1 ? 1.6 : 1) * (w / 60); i++; }
      n = { kind: 'path', id, layer: 'ornament', d, fill: col }; break;
    }
  }
  if (!n) return [];
  ctx.add(n);
  return [n.id];
}

/** the copy a realised layout shows (so the aux bands do not repeat it) */
export function usedTexts(copy: Copy, L: Layout): Set<string> {
  const out = new Set<string>();
  for (const it of L.items) if (it.kind === 'text' && it.leaf.slot === 'lit' && it.leaf.of) { const p = slotText(copy, it.leaf.of, it.leaf.idx ?? 0); if (p) out.add(p.t); }
  for (const it of L.items) if (it.kind === 'text' && it.leaf.slot !== 'lit') { const p = slotText(copy, it.leaf.slot, it.leaf.idx ?? 0); if (p) out.add(p.t); if (it.leaf.slot === 'num' && copy.num) out.add(copy.num.v); if (it.leaf.slot === 'date' && copy.date) out.add(copy.date); }
  return out;
}
