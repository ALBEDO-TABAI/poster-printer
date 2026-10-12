// Phase 8 typography module: semantic (phrase-aware) line breaking for CN / EN headlines, headline silhouettes,
// headline-as-shape (each line set to a common measure), and optical edge correction from real glyph ink when the
// measurer can report it (browser canvas). Geometry stays exact; these functions only decide lines, sizes and offsets.
import type { Measurer, FontSpec } from '../text/measure';
import { isCJKChar } from '../text/breaker';

const FN_EN = new Set(['a', 'an', 'the', 'of', 'and', '&', 'to', 'in', 'on', 'for', 'with', 'by', 'at', 'from', 'or', 'as', 'into', 'over', 'under', 'that', 'this', 'is', 'are', 'was', 'be', 'our', 'your', 'its', 'my', 'no.', 'vol.']);
// characters that close a phrase (a break after them is natural) / open one (a break before them is natural)
const ZH_AFTER = new Set(Array.from('的之与和及在了着过里上下中后前时·、，。：；！？）」』'));
const ZH_BEFORE = new Set(Array.from('与和及在从向把被对（「『'));
const PUNCT = /[，。、！？：；·,.!?:;/|—–-]/;

export interface Tok { t: string; kind: 'han' | 'lat' | 'num' | 'sp' | 'p' }
export function tokens(s: string): Tok[] {
  const out: Tok[] = [];
  for (const m of s.matchAll(/(\s+)|([\u3400-\u9fff\uf900-\ufaff])|([A-Za-z][A-Za-z'’.&]*)|(\d[\d.:,/–-]*)|([^\s])/g)) {
    if (m[1]) out.push({ t: m[1], kind: 'sp' });
    else if (m[2]) out.push({ t: m[2], kind: 'han' });
    else if (m[3]) out.push({ t: m[3], kind: 'lat' });
    else if (m[4]) out.push({ t: m[4], kind: 'num' });
    else out.push({ t: m[5], kind: PUNCT.test(m[5]) ? 'p' : 'lat' });
  }
  return out;
}

/** cost of breaking between token i-1 and i (Infinity = never) */
function breakCost(tk: Tok[], i: number, runStart: number[]): number {
  const a = tk[i - 1], b = tk[i];
  if (!a || !b) return Infinity;
  if (b.kind === 'p' && b.t !== '·' && b.t !== '/') return Infinity; // no punctuation at a line start (禁则)
  if (a.kind === 'sp') {
    const prev = tk[i - 2];
    if (prev && (prev.kind === 'han') !== (b.kind === 'han') && prev.kind !== 'p' && b.kind !== 'p') return 0.05; // 低频夜 | LOW: the script boundary is the phrase boundary
    if (prev && prev.kind === 'lat' && FN_EN.has(prev.t.toLowerCase())) return 6; // never leave "of" / "the" dangling
    if (b.kind === 'lat' && FN_EN.has(b.t.toLowerCase())) return 0.2;
    return 0.5;
  }
  if (a.kind === 'p') return 0.1;
  if (a.kind === 'han' && b.kind === 'han') {
    if (ZH_AFTER.has(a.t)) return 0.4;
    if (ZH_BEFORE.has(b.t)) return 0.6;
    // inside a Han run: two-character words dominate, so breaks at an even offset from the run start are cheaper
    const off = i - runStart[i];
    // a short closed Han run inside a longer line is a name / venue / unit (林知远): never split it
    let end = i; while (end < tk.length && tk[end].kind === 'han') end++;
    const runLen = end - runStart[i];
    if (runLen <= 4 && runLen < tk.filter((t) => t.kind !== 'sp').length) return 9;
    return off % 2 === 0 ? 1.6 : 4.5;
  }
  if ((a.kind === 'han') !== (b.kind === 'han')) return a.kind === 'num' || b.kind === 'num' ? 3 : 0.8; // Han ↔ Latin boundary
  return Infinity; // inside a Latin word / number
}

export interface BreakOpts { k: number; profile?: 'balanced' | 'descending' | 'ascending' | 'any'; width?: (s: string) => number }
/** best k-line semantic break of a headline (exhaustive over break points for k ≤ 4) */
export function semanticBreak(s: string, o: BreakOpts): string[] | null {
  const tk = tokens(s.replace(/\n/g, ' '));
  const n = tk.length;
  if (o.k <= 1) return [s.trim()];
  const runStart: number[] = []; let rs = 0;
  for (let i = 0; i < n; i++) { if (i === 0 || tk[i].kind !== 'han' || tk[i - 1].kind !== 'han') rs = i; runStart[i] = rs; }
  const cands: { i: number; c: number }[] = [];
  for (let i = 1; i < n; i++) { const c = breakCost(tk, i, runStart); if (Number.isFinite(c)) cands.push({ i, c }); }
  if (cands.length < o.k - 1) return null;
  const W = o.width ?? ((x: string) => Array.from(x).reduce((w, ch) => w + (isCJKChar(ch) ? 1 : ch === ' ' ? 0.3 : 0.58), 0));
  const join = (a: number, b: number) => tk.slice(a, b).map((t) => t.t).join('').trim();
  let best: { lines: string[]; cost: number } | null = null;
  const bi = /[\u3400-\u9fff]/.test(s) && /[A-Za-z]{2}/.test(s);
  const pick: number[] = [];
  const rec = (start: number, left: number) => {
    if (left === 0) {
      const cuts = [0, ...pick.map((p) => cands[p].i), n];
      const lines: string[] = [];
      for (let j = 0; j + 1 < cuts.length; j++) lines.push(join(cuts[j], cuts[j + 1]));
      if (lines.some((l) => !l)) return;
      const ws = lines.map(W); const mean = ws.reduce((x, y) => x + y, 0) / ws.length;
      let shape = 0;
      if (o.profile === 'descending') for (let j = 1; j < ws.length; j++) shape += Math.max(0, ws[j] - ws[j - 1]) / mean * 3;
      else if (o.profile === 'ascending') for (let j = 1; j < ws.length; j++) shape += Math.max(0, ws[j - 1] - ws[j]) / mean * 3;
      else if (o.profile !== 'any') shape = ws.reduce((x, w) => x + ((w - mean) / mean) ** 2, 0) * 4;
      // orphans: a one-character Han line or a one-letter word line reads as an accident
      let orphan = lines.reduce((x, l) => x + (Array.from(l.replace(/\s/g, '')).length <= 1 ? 8 : 0), 0);
      // phase 12: a lone number group, or a last line of one short Latin word under a multi-word line, is a widow
      orphan += lines.reduce((x, l) => x + (/^[\d.:,/–-]+$/.test(l) ? 8 : 0), 0);
      const lastL = lines[lines.length - 1];
      if (lines.length > 1 && /^[A-Za-z’'.-]{1,5}$/.test(lastL) && /\s/.test(lines[lines.length - 2])) orphan += 6;
      // bilingual headlines: a line that mixes scripts reads as a broken phrase
      const mixed = bi ? lines.reduce((x, l) => x + (/[\u3400-\u9fff]/.test(l) && /[A-Za-z]{2}/.test(l) ? 4 : 0), 0) : 0;
      const cost = pick.reduce((x, p) => x + cands[p].c, 0) + shape + orphan + mixed;
      if (!best || cost < best.cost) best = { lines, cost };
      return;
    }
    for (let p = start; p < cands.length; p++) { pick.push(p); rec(p + 1, left - 1); pick.pop(); }
  };
  if (cands.length > 40 && o.k > 3) return null;
  rec(0, o.k - 1);
  return (best as { lines: string[] } | null)?.lines ?? null;
}

export type Silhouette = 'stack' | 'block' | 'step' | 'cascade' | 'wedge' | 'bigsmall';
export interface SetLine { text: string; size: number; x: number; y: number; w: number; anchor: 'start' | 'middle' | 'end' }

/**
 * Lay out headline lines in a silhouette inside a box (x, y = top-left, w = measure). Returns per-line sizes and
 * baselines. `block` = headline-as-shape: every line is scaled to the full measure (sizes capped by maxRatio).
 */
export function silhouette(lines: string[], kind: Silhouette, box: { x: number; y: number; w: number; h: number }, spec: (size: number) => FontSpec, m: Measurer, o: { size: number; leading: number; cap: number; zh: boolean; maxRatio?: number; align?: 'start' | 'end' }): { lines: SetLine[]; h: number; w: number } {
  const n = lines.length;
  const width = (t: string, s: number) => m.width(t, spec(s));
  let sizes = lines.map(() => o.size);
  if (kind === 'block') {
    const base = lines.map((l) => box.w / Math.max(1, width(l, 100)) * 100);
    const lo = Math.min(...base);
    sizes = base.map((s) => Math.min(s, lo * (o.maxRatio ?? 2.4)));
  } else if (kind === 'wedge') sizes = lines.map((_, i) => o.size * (1 - 0.18 * i));
  else if (kind === 'bigsmall') sizes = lines.map((_, i) => (i === 0 ? o.size : o.size * 0.42));
  // fit the widest line into the measure
  const k = Math.min(1, ...lines.map((l, i) => box.w / Math.max(1, width(l, sizes[i]))));
  sizes = sizes.map((s) => s * k);
  // and the whole stack into the box height (a block shape can otherwise outgrow the page)
  const stackH = sizes.reduce((a, s, i) => a + (i === 0 ? o.cap * s : Math.max(sizes[i - 1], s) * o.leading * (kind === 'block' ? 0.92 : 1)), 0) + 0.2 * sizes[n - 1];
  if (box.h > 0 && stackH > box.h) sizes = sizes.map((s) => (s * box.h) / stackH);
  const out: SetLine[] = [];
  let y = box.y;
  const right = o.align === 'end';
  for (let i = 0; i < n; i++) {
    const s = sizes[i], w = width(lines[i], s);
    y += (i === 0 ? o.cap * s : Math.max(sizes[i - 1], s) * o.leading * (kind === 'block' ? 0.92 : 1));
    let x = right ? box.x + box.w - w : box.x;
    if (kind === 'step') x = box.x + (box.w - w) * (n > 1 ? i / (n - 1) : 0);
    else if (kind === 'cascade') x = i % 2 ? box.x + box.w - w : box.x;
    out.push({ text: lines[i], size: s, x, y, w, anchor: 'start' });
  }
  const h = y - box.y + (o.zh ? 0.1 : 0.2) * sizes[n - 1];
  return { lines: out, h, w: Math.max(...out.map((l) => l.x + l.w)) - Math.min(...out.map((l) => l.x)) };
}

/** choose a silhouette from the line-length profile (the content decides the shape) */
export function silhouetteFor(lines: string[], wf: (s: string) => number, r: () => number): Silhouette {
  if (lines.length === 1) return 'stack';
  const ws = lines.map(wf), mx = Math.max(...ws), mn = Math.min(...ws);
  const spread = (mx - mn) / mx;
  const desc = ws.every((w, i) => i === 0 || w <= ws[i - 1] * 1.05);
  if (spread > 0.45 && lines.length <= 3) return r() < 0.6 ? 'block' : desc ? 'wedge' : 'step'; // ragged → make it a shape
  if (spread < 0.15) return r() < 0.5 ? 'stack' : 'cascade';
  return r() < 0.4 ? 'step' : r() < 0.5 ? 'block' : 'stack';
}

/** optical side bearing: shift a line left by its ink inset so big type aligns on ink, not on the advance box */
export function opticalLeft(m: Measurer, text: string, f: FontSpec): number {
  const ink = (m as Measurer & { ink?: (t: string, f: FontSpec) => { left: number } | null }).ink?.(text, f);
  return ink ? ink.left : 0;
}

/** characters / words per line the headline would need at a given display size: capacity check for structure switching */
export function linesNeeded(s: string, zh: boolean, maxW: number, size: number, m: Measurer, f: FontSpec): number {
  const w = m.width(s, { ...f, size });
  return Math.ceil(w / Math.max(1, maxW) + (zh ? 0 : 0.15));
}
