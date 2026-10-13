// Phase 16 — two compositions on the Swiss modular grid.
//   modular    pictures of different sizes on fields of a modular grid, with white space (typology hero / flow /
//              steps / strip / blocks). Every picture spans whole fields chosen to match its own proportion; the
//              hero may bleed off its outer edges; type hangs from field tops on one baseline grid.
//   bleedgrid  the sheet is filled edge to edge: pictures butt-joined (or split by hairline seams) in a slicing tree
//              solved for the sheet's proportion, so they keep their own proportions; the type sits in its own cell.
// The copy is real copy: every item, note and meta label given is set (never padded, never invented).
import type { Ctx, ImageAsset } from '../gen/ctx';
import type { Rect } from '../gen/grid';
import type { PT } from '../gen/pick';
import type { TextNode } from '../types';
import { contentOf, typeled, exhibit, type Content } from '../p8/grammar';
import { semanticBreak, opticalLeft } from '../p8/typeset';
import { rawText, hair } from '../gen/comps2';
import { strong } from '../gen/comps3';
import { emptySem, unionBox, type SceneSemantics, type Role8 } from '../p8/semantic';
import { wcag, relLum } from '../color/contrast';
import { textOn } from '../color/palette';
import { modularLattice, writeGrid, spanRect, lattice, refine, type Lattice, type Span } from './lattice';
import { solve, mirrorX, type Leaf, type LeafCost, type Placed } from './solver';
import { templates, feasible, typologyWeights, placeType, TYPOLOGIES, type Typology, type BleedTypology, type TplIn } from './typologies';
import { solveFlex, layoutTree, randomTree, rowsTree, type MLeaf, type MNode, type MPlaced } from './mosaic';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- pictures
export interface Pic { a: ImageAsset; ar: number; imp: number; sub?: ImageAsset['subject'] }
/** the pictures of the draw in importance order (the first is the hero) */
export function picsOf(ctx: Ctx): Pic[] {
  if (!ctx.on('images') || ctx.plan.typeOnly) return [];
  return ctx.images.slice(0, 8).map((a, i) => ({ a, ar: clamp(a.w / Math.max(1, a.h), 0.2, 5), imp: i === 0 ? 1.6 : i === 1 ? 1.15 : 1, sub: a.subject }));
}
/** crop loss of covering a w×h frame with a picture of proportion ar (share of the picture that is cut away) */
export const cropLoss = (ar: number, w: number, h: number) => { const s = w / Math.max(1, h); return 1 - Math.min(s, ar) / Math.max(s, ar); };

// ---------------------------------------------------------------- type model
interface Piece { text: string; lang: 'zh' | 'en'; w100: number[] }
export interface TypeModel {
  c: Content; zh: boolean;
  fam: { family: string; weight: number }; tr: number; capR: number; lead: number;
  opts: { lines: string[]; w100: number }[];
  /** target display size (px) */
  T: number;
  sub: PT | null; subW100: number; subWithHead: boolean;
  items: { main: Piece; note: Piece | null; raw: { main: PT; note: PT } }[]; prose: Piece | null; meta: Piece[];
  hasInfo: boolean; heavy: boolean;
  /** info text size, explanation size, minimum reading measure (px) */
  s: number; expl: number; minMeasure: number;
  b: number; g: number;
}
const spec100 = (f: { family: string; weight: number }, tr = 0) => ({ family: f.family, weight: f.weight, size: 100, tracking: tr });

export function typeModel(ctx: Ctx, b: number, g: number, C: Rect): TypeModel {
  const { u } = ctx;
  const c = contentOf(ctx);
  const zh = c.zh;
  const lang = c.hl.lang;
  const rf = ctx.role('big.main', lang);
  const fam = { family: rf.family, weight: rf.weight };
  const tr = zh ? Math.max(0, rf.tracking || 0) : clamp(rf.tracking || 0, -0.04, 0.02);
  const capR = zh ? 0.86 : ctx.measure.metrics(spec100(fam, tr)).cap;
  const lead = zh ? 1.08 : 0.98;
  const text = ctx.caseOf('big.main', lang, c.hl.t);
  const wf = (s: string) => ctx.measure.width(s, spec100(fam, tr));
  const opts: TypeModel['opts'] = [];
  if (text.includes('\n')) { const ls = text.split('\n'); opts.push({ lines: ls, w100: Math.max(...ls.map(wf)) }); }
  else for (let k = 1; k <= 4; k++) {
    const ls = k === 1 ? [text] : semanticBreak(text, { k, profile: 'any', width: wf });
    if (!ls || ls.length !== k || ls.some((l) => !l.trim())) continue;
    // display lines: Han lines keep ≥ 2 characters (a title of ≤ 3 stays on one line), Latin lines keep ≥ 2 letters
    if (k > 1 && zh && (c.hlChars <= 3 || ls.some((l) => Array.from(l.replace(/[\s\p{P}]/gu, '')).length < 2))) continue;
    if (k > 1 && !zh && ls.some((l) => l.replace(/[^\p{L}\p{N}]/gu, '').length < 2)) continue;
    opts.push({ lines: ls, w100: Math.max(...ls.map(wf)) });
  }
  if (!opts.length) opts.push({ lines: [text], w100: wf(text) });
  const ss = (ctx.num('smallScale') || 100) / 100;
  const s = clamp(b / 1.36, u * 1.05 * ss, u * 2.6 * ss);
  const meas = (pt: PT | null | undefined, rk: 'small.main' | 'small.note' | 'big.sub'): Piece | null => {
    if (!pt?.t) return null;
    const f = ctx.role(rk, pt.lang);
    return { text: pt.t, lang: pt.lang, w100: pt.t.split('\n').map((l) => ctx.measure.width(l, spec100(f, f.tracking || 0))) };
  };
  const sub = c.sub?.t ? c.sub : null;
  const subP = meas(sub, 'big.sub');
  const subW100 = subP ? Math.max(...subP.w100) : 0;
  const subWithHead = !!sub && Array.from(sub.t).length <= 46;
  const items = c.items.map((it) => ({ main: meas(it.main, 'small.main')!, note: meas(it.note, 'small.note'), raw: it })).filter((x) => x.main);
  const prose = meas(c.prose, 'small.note');
  const meta = c.meta.map((m) => meas(m, 'small.note')).filter(Boolean) as Piece[];
  const hasInfo = items.length > 0 || !!prose || meta.length > 0 || (!!sub && !subWithHead);
  const heavy = items.length >= 4 || (!!prose && prose.w100.reduce((a, v) => a + v, 0) > 2400) || items.length + meta.length >= 6;
  const tm: TypeModel = { c, zh, fam, tr, capR, lead, opts, T: 0, sub, subW100, subWithHead, items, prose, meta, hasInfo, heavy, s, expl: u * 2.4, minMeasure: Math.max(u * 13, s * 11), b, g };
  // the display target: what the title reaches in a generous band (full measure × 30 % of the height), kept in a
  // poster range and scaled by the title-scale control
  const ideal = fitHead(tm, C.w, C.h * 0.3).size;
  tm.T = clamp(ideal * 0.8, u * 6.5, u * 22) * clamp((ctx.num('titleScale') || 100) / 100, 0.5, 1.8);
  return tm;
}

/** the largest display size at which the headline (+ its explanation) fits a w×h region */
export function fitHead(tm: TypeModel, w: number, h: number, withSub = tm.subWithHead): { size: number; opt: TypeModel['opts'][number] } {
  return fitHeadAll(tm, w, h, withSub).reduce((a, b) => (b.size > a.size ? b : a), { size: 0, opt: tm.opts[0] });
}
/** the size each line-break option reaches in a w×h region */
export function fitHeadAll(tm: TypeModel, w: number, h: number, withSub = tm.subWithHead): { size: number; opt: TypeModel['opts'][number] }[] {
  const all: { size: number; opt: TypeModel['opts'][number] }[] = [];
  for (const o of tm.opts) {
    const k = o.lines.length;
    let f = tm.capR + (k - 1) * tm.lead;
    let size = Math.min(w / Math.max(1e-6, o.w100 / 100), h / f);
    if (withSub && tm.sub) {
      // the explanation (≈ size / 3.4, one or two lines) and a gap ride on the headline's height
      for (let it = 0; it < 2; it++) {
        const es = clamp(size / 3.4, 0, size);
        const nl = Math.max(1, Math.ceil((tm.subW100 / 100) * es / Math.max(1, w)));
        f = tm.capR + (k - 1) * tm.lead + 0.42 + (nl * 1.3) / 3.4;
        size = Math.min(w / Math.max(1e-6, o.w100 / 100), h / f);
      }
    }
    all.push({ size, opt: o });
  }
  return all;
}

const linesOf = (p: Piece, size: number, w: number) => p.w100.reduce((s, v) => s + Math.max(1, Math.ceil(((v / 100) * size) / Math.max(1, w * 0.96))), 0);
/** sub-columns of an info region: as many as fit the reading measure, at most one per item */
function subCols(tm: TypeModel, w: number) {
  const n = Math.max(1, Math.min(Math.max(1, tm.items.length), Math.floor((w + tm.g) / (tm.minMeasure + tm.g))));
  return { n, cw: (w - (n - 1) * tm.g) / n };
}
/** height the info block needs at width w */
export function infoNeed(tm: TypeModel, w: number, withSub = !tm.subWithHead): number {
  const { b } = tm;
  let h = 0;
  if (withSub && tm.sub) h += Math.ceil((tm.subW100 / 100) * tm.expl / Math.max(1, w * 0.96)) * tm.expl * 1.25 + b;
  const { n, cw } = subCols(tm, w);
  if (tm.items.length) {
    const ih = tm.items.map((it) => (linesOf(it.main, tm.s * 1.12, cw) + (it.note ? linesOf(it.note, tm.s * 0.92, cw) : 0)) * b + b);
    let col = 0;
    for (let r = 0; r < ih.length; r += n) col += Math.max(...ih.slice(r, r + n));
    h += col;
  }
  if (tm.prose) h += linesOf(tm.prose, tm.s, Math.min(w, cw * 2 + tm.g)) * tm.s * 1.45 + b;
  if (tm.meta.length) h += Math.ceil(tm.meta.length / n) * b + b * 0.5;
  return h;
}

// ---------------------------------------------------------------- costs
function pictureCost(p: Pic, r: Rect, W: number, H: number, u: number, share?: number, hero = false) {
  const loss = cropLoss(p.ar, r.w, r.h), v = 1 - loss, s = r.w / Math.max(1, r.h);
  let c = p.imp * (loss <= 0.12 ? loss * 0.6 : 0.072 + (loss - 0.12) * 2.4) + (loss > 0.42 ? (loss - 0.42) * 10 : 0);
  if (p.sub) { const e = s > p.ar ? p.sub.h : p.sub.w; if (e > v * 0.96) c += p.imp * (e - v * 0.96) * 5; }
  if (share) c += 0.9 * Math.abs(Math.log(((r.w * r.h) / (W * H)) / share)) * (hero ? 1.2 : 0.8);
  if (Math.min(r.w, r.h) < u * 9) c += 4;
  return c;
}
/** height the headline block takes at the size it is set in a w×h region */
export function headUsed(tm: TypeModel, w: number, h: number, u: number, withSub = tm.subWithHead) {
  const f = fitHead(tm, w, h, withSub);
  const size = Math.min(f.size, u * 34, tm.T * 2.2);
  const k = f.opt.lines.length;
  const sub = withSub && tm.sub ? size * 0.42 + Math.max(1, Math.ceil((tm.subW100 / 100) * (size / 3.4) / Math.max(1, w))) * (size / 3.4) * 1.3 : 0;
  return { size, h: size * (tm.capR + (k - 1) * tm.lead) + sub, w: Math.min(w, (f.opt.w100 / 100) * size) };
}
function headCost(tm: TypeModel, w: number, h: number, u: number, H: number, withSub = tm.subWithHead) {
  const f = headUsed(tm, w, h, u, withSub);
  return 2.5 * Math.max(0, Math.log(tm.T / Math.max(1, f.size))) + (f.size < u * 4.5 ? 4 : 0) + 2 * Math.max(0, (h - f.h * 2) / H);
}
function infoCost(tm: TypeModel, w: number, h: number, H: number) {
  if (!tm.hasInfo) return 0;
  if (w < tm.minMeasure) return 6;
  const need = infoNeed(tm, w);
  const over = need / Math.max(1, h);
  return (over > 1 ? 1.5 + (over - 1) * 8 : 0) + 1.2 * Math.max(0, (h - need * 1.8) / H);
}

// ---------------------------------------------------------------- semantics
interface Out { sem: SceneSemantics; role(id: string, r: Role8): void }
function out(ctx: Ctx, strategy: string): Out {
  const sem = emptySem(); sem.strategy = strategy;
  (ctx as Ctx & { sem?: SceneSemantics }).sem = sem;
  return { sem, role: (id, r) => { sem.roles[id] = r; } };
}
/** run `f` without keeping what it adds (measure-only pass) */
function dry<T>(ctx: Ctx, f: () => T): T { const n = ctx.nodes.length, o = ctx.occupied.length; const r = f(); ctx.nodes.length = n; ctx.occupied.length = o; return r; }
/** move a text node so its first baseline sits at y */
function baselineTo(t: TextNode, y: number) { if (!t.lines.length) return; const dy = y - t.lines[0].y; t.lines = t.lines.map((l) => ({ ...l, y: l.y + dy })); t.box = { ...t.box, y: t.box.y + dy }; }
/** line advance on the baseline grid: whole or half baselines, never tighter than 1.08 */
const adv = (b: number, size: number, lead = 1.22) => Math.max(size * 1.08, Math.round((size * lead) / (b / 2)) * (b / 2));

// ---------------------------------------------------------------- type setting
function setHead(ctx: Ctx, o: Out, tm: TypeModel, R: Rect, anchor: 'top' | 'bottom', fill: string, on: string, withSub: boolean, align: 'start' | 'end' = 'start') {
  const { u } = ctx;
  let f = fitHead(tm, R.w, R.h, withSub);
  let k = 1;
  if (ctx.layered) {
    // the type layer: the line breaks within 14 % of the best size are all good settings; the headline may also be set
    // a step or two smaller (more air in its field), stand on the field's foot instead of hanging from its head, or
    // range right when it sits on the right half of the sheet
    const good = fitHeadAll(tm, R.w, R.h, withSub).filter((x) => x.size >= f.size * 0.86);
    if (good.length > 1) { const w = good.map((x) => (x.size / f.size) ** 3); let r = ctx.rt.next() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < good.length; i++) { r -= w[i]; if (r <= 0) { f = good[i]; break; } } }
    k = Number(ctx.rt.weighted({ '1': 3, '0.8': 1.5, '0.64': 0.8 }));
    if (f.size * k < u * 6) k = Math.min(1, (u * 6) / f.size);
    if (ctx.rt.chance(0.3)) anchor = anchor === 'top' ? 'bottom' : 'top';
    if (align === 'start' && R.x > ctx.W * 0.45 && ctx.rt.chance(0.3)) align = 'end';
  }
  const size = Math.min(f.size * k, u * 34, tm.T * 2.2);
  const lines = f.opt.lines;
  const blockH = tm.capR * size + (lines.length - 1) * tm.lead * size;
  const expl = clamp(size / 3.4, u * 1.8, u * 4.2);
  tm.expl = expl;
  const subGap = size * 0.42;
  const subSet = (y: number) => ctx.text(tm.sub!, 'big.sub', { x: R.x, y, w: R.w, h: R.h }, { size: expl, on, align, mode: 'balance', maxLines: 3, leading: adv(tm.b, expl, 1.25) / expl });
  const subH = withSub && tm.sub ? dry(ctx, () => subSet(R.y).h) : 0;
  const total = blockH + (subH ? subGap + subH : 0);
  const top = anchor === 'top' ? R.y : R.y + R.h - total;
  // one text node for the whole headline (it is read as one string); big type aligns each line on its ink
  const sp = { family: tm.fam.family, weight: tm.fam.weight, size, tracking: tm.tr };
  const x0 = align === 'start' ? R.x : R.x + R.w;
  const n = rawText(ctx, { id: ctx.id('g16h'), role: 'big.main', text: lines.join('\n'), lang: tm.zh ? 'zh' : 'en', x: x0, y: top + tm.capR * size, size, family: tm.fam.family, weight: tm.fam.weight, fill, tracking: tm.tr, anchor: align, leading: tm.lead });
  if (align === 'start' && size > u * 6) {
    const dxs = n.lines.map((l) => -opticalLeft(ctx.measure, l.text, sp));
    n.lines = n.lines.map((l, i) => ({ ...l, x: l.x + dxs[i] }));
    const mn = Math.min(...dxs); n.box = { ...n.box, x: n.box.x + mn };
  }
  o.role(n.id, 'headline');
  const ids = [n.id];
  if (subH) { const r = subSet(top + blockH + subGap); o.role(r.node.id, 'explanation'); o.sem.relations.push({ type: 'align', a: ids[0], b: r.node.id, edge: align === 'start' ? 'left' : 'right' }); }
  const box = unionBox(ids.map((id) => (ctx.nodes.find((n) => n.id === id) as TextNode).box));
  o.sem.groups.push({ id: 'headline', role: 'headline', members: ids, order: 'stack', box });
  return { box, size, ids };
}

/** the info block: explanation, items in sub-columns on lattice columns, prose, meta; hangs from the region top */
function setInfo(ctx: Ctx, o: Out | null, tm: TypeModel, R: Rect, on: string, withSub: boolean, cols?: Rect[]) {
  const { u } = ctx;
  const b = tm.b;
  // small reading text keeps a margin over 4.5:1 (anti-aliased strokes sample a little lower than their colour)
  const ink = textOn(on, ctx.pal, 6), soft = textOn(on, ctx.pal, 5.2);
  const run = (scale: number, withProse: boolean, rec: boolean) => {
    const ids: string[] = [];
    const role = (id: string, r: Role8) => { if (rec && o) o.role(id, r); };
    const s = tm.s * scale, a = adv(b, s * 1.12, 1.25) * (scale < 1 ? 1 : 1);
    let y = R.y;
    if (withSub && tm.sub) {
      const es = Math.min(tm.expl, u * 3) * scale;
      const r = ctx.text(tm.sub, 'big.sub', { x: R.x, y, w: Math.min(R.w, u * 56), h: R.h }, { size: es, on, mode: 'balance', maxLines: 3, leading: adv(b, es, 1.25) / es });
      role(r.node.id, 'explanation'); ids.push(r.node.id);
      y += r.h + b;
    }
    // sub-columns: on the lattice columns when given, else an even split of the region
    const sc = subCols(tm, R.w);
    let cs: { x: number; w: number }[];
    if (cols && cols.length >= sc.n && sc.n > 1) { const per = Math.floor(cols.length / sc.n); cs = Array.from({ length: sc.n }, (_, j) => { const a0 = cols[j * per], a1 = cols[Math.min(cols.length, (j + 1) * per) - 1]; return { x: a0.x, w: a1.x + a1.w - a0.x }; }); }
    else cs = Array.from({ length: sc.n }, (_, j) => ({ x: R.x + j * (sc.cw + tm.g), w: sc.cw }));
    const n = cs.length;
    for (let r0 = 0; r0 < tm.items.length; r0 += n) {
      let rowB = y;
      tm.items.slice(r0, r0 + n).forEach((it, j) => {
        const c = cs[j];
        const m = ctx.text(it.raw.main, 'small.main', { x: c.x, y, w: c.w, h: 999 }, { size: s * 1.12, on, fill: ink, mode: 'greedy', fit: true, minSize: s, leading: a / (s * 1.12) });
        (m.node as TextNode & { grp?: string }).grp = 'info'; role(m.node.id, 'info'); ids.push(m.node.id);
        let last = m.node.lines[m.node.lines.length - 1]?.y ?? y;
        if (it.note && it.raw.note.t) {
          const nn = ctx.text(it.raw.note, 'small.note', { x: c.x, y, w: c.w, h: 999 }, { size: s * 0.92, on, fill: soft, mode: 'greedy', fit: false, leading: a / (s * 0.92) });
          baselineTo(nn.node, last + a);
          (nn.node as TextNode & { grp?: string }).grp = 'info'; role(nn.node.id, 'info'); ids.push(nn.node.id);
          last = nn.node.lines[nn.node.lines.length - 1]?.y ?? last;
        }
        rowB = Math.max(rowB, last + a * 0.35);
      });
      y = rowB + b;
    }
    if (withProse && tm.prose && ctx.texts.prose[0]?.t) {
      const pw = Math.min(R.w, n > 1 ? cs[1].x + cs[1].w - cs[0].x : R.w, u * 60);
      const pa = adv(b, s, 1.45);
      const p = ctx.text(ctx.texts.prose[0], 'small.note', { x: R.x, y, w: pw, h: 999 }, { size: s, on, fill: soft, mode: 'greedy', fit: false, leading: pa / s });
      role(p.node.id, 'info'); ids.push(p.node.id);
      y += p.h + b;
    }
    if (tm.meta.length) {
      // meta: one per sub-column on a row, rows as needed
      const ms = s * 0.92;
      for (let k = 0; k < tm.meta.length; k += n) {
        tm.meta.slice(k, k + n).forEach((_, j) => {
          const pt = tm.c.meta[k + j];
          const mt = ctx.text(pt, 'small.note', { x: cs[j].x, y, w: cs[j].w, h: 999 }, { size: ms, on, fill: ink, mode: 'greedy', fit: true, minSize: ms * 0.8, leading: a / ms });
          role(mt.node.id, 'action'); ids.push(mt.node.id);
        });
        y += a;
      }
    }
    return { y, ids };
  };
  for (const [scale, prose] of [[1, true], [0.92, true], [0.85, true], [0.85, false], [0.78, false]] as [number, boolean][]) {
    const h = dry(ctx, () => run(scale, prose, false).y) - R.y;
    if (h <= R.h + 1 || (scale === 0.78 && !prose)) {
      if (!o) return { y: R.y + h, ids: [] as string[] };
      const r = run(scale, prose, true);
      if (r.ids.length) o.sem.groups.push({ id: 'info', role: 'info', members: r.ids, order: 'grid', box: unionBox(r.ids.map((id) => (ctx.nodes.find((x) => x.id === id) as TextNode).box)) });
      return r;
    }
  }
  return { y: R.y, ids: [] as string[] };
}

// ---------------------------------------------------------------- choice
/** softmax pick among the cheapest candidates (variety without accepting poor fits) */
function choose<T extends { cost: number }>(ctx: Ctx, cands: T[], tau = 0.45, window = 1.2, rng = ctx.rng): T | null {
  const ok = cands.filter((c) => Number.isFinite(c.cost)).sort((a, b) => a.cost - b.cost);
  if (!ok.length) return null;
  const top = ok.filter((c) => c.cost <= ok[0].cost + window).slice(0, 4);
  const w = top.map((c) => Math.exp(-(c.cost - top[0].cost) / tau));
  let r = rng.next() * w.reduce((s, v) => s + v, 0);
  for (let i = 0; i < top.length; i++) { r -= w[i]; if (r <= 0) return top[i]; }
  return top[0];
}

/** white space (share of the type area that is empty fields or unused parts of the text regions) and picture
 *  coverage (share of the sheet) each typology aims at */
/** a layout this cheap is a good fit: no need to compare it with the other typologies */
const GOOD_FIT = 1.6;
const WS: Record<Typology, [number, number]> = { hero: [0.12, 0.45], flow: [0.22, 0.58], steps: [0.3, 0.66], strip: [0.15, 0.48], blocks: [0.12, 0.45] };
const COVER: Record<Typology, number> = { hero: 0.36, flow: 0.24, steps: 0.24, strip: 0.28, blocks: 0.36 };
function globalCost(ps: Placed[], ty: Typology, L: Lattice, pics: Pic[], tm: TypeModel, u: number, leadAsked = false) {
  let c = 0;
  const imgs = ps.filter((p) => p.leaf.kind === 'img');
  if (imgs.length < pics.length) c += 50;
  const area = (p: Placed) => p.rect.w * p.rect.h;
  const typeArea = (L.W - L.m.l - L.m.r) * (L.H - L.m.t - L.m.b);
  const cover = imgs.reduce((s, p) => s + area(p), 0) / (L.W * L.H);
  if (cover < COVER[ty]) c += (COVER[ty] - cover) * 8;
  // pictures count inside the type area only (the bleed beyond the margin is not white space either way)
  const T = { x: L.m.l, y: L.m.t, w: L.W - L.m.l - L.m.r, h: L.H - L.m.t - L.m.b };
  const inT = (r: Rect) => Math.max(0, Math.min(r.x + r.w, T.x + T.w) - Math.max(r.x, T.x)) * Math.max(0, Math.min(r.y + r.h, T.y + T.h) - Math.max(r.y, T.y));
  let used = imgs.reduce((s, p) => s + inT(p.rect), 0);
  for (const p of ps) {
    if (p.leaf.kind === 'head') used += p.rect.w * Math.min(p.rect.h, headUsed(tm, p.rect.w, p.rect.h, u).h);
    if (p.leaf.kind === 'info' && tm.hasInfo) used += p.rect.w * Math.min(p.rect.h, infoNeed(tm, p.rect.w));
  }
  const ws2 = 1 - used / typeArea;
  const [wlo, whi] = WS[ty];
  if (ws2 < wlo) c += (wlo - ws2) * 5; else if (ws2 > whi) c += (ws2 - whi) * 5;
  c += deadBands(fieldUse(ps, L, tm, u), L);
  if ((ty !== 'strip' || leadAsked) && imgs.length > 1) {
    const hero = imgs.find((p) => p.leaf.i === 0);
    const maxO = Math.max(...imgs.filter((p) => p.leaf.i !== 0).map(area));
    // the first picture is the hero: in hero / steps layouts never smaller than a satellite, ideally ≥ 1.8×
    if (hero) { const r = area(hero) / maxO; const lead = ty === 'hero' || ty === 'steps' || leadAsked; if (r < 1) c += lead ? 4 + 3 * (1 - r) : 1.5 * (1 - r) + 0.5; else if (lead && r < 1.8) c += 0.6 * (1.8 - r); }
  }
  return c;
}

/** which fields carry something: a picture, or the part of a text region its copy actually fills */
function fieldUse(ps: Placed[], L: Lattice, tm: TypeModel, u: number): Uint8Array {
  const use = new Uint8Array(L.nc * L.nr);
  const mark = (c0: number, c1: number, r0: number, r1: number) => { for (let r = Math.max(0, r0); r < Math.min(L.nr, r1); r++) for (let c = c0; c < c1; c++) use[r * L.nc + c] = 1; };
  const rows = (h: number) => Math.max(1, Math.ceil((h + L.g) / (L.fh + L.g) - 0.15));
  for (const p of ps) {
    const s = p.span;
    if (p.leaf.kind === 'img') mark(s.c0, s.c1, s.r0, s.r1);
    else if (p.leaf.kind === 'head') { const k = rows(headUsed(tm, p.rect.w, p.rect.h, u).h); if ((p.leaf.anchor ?? 'top') === 'top') mark(s.c0, s.c1, s.r0, s.r0 + k); else mark(s.c0, s.c1, s.r1 - k, s.r1); }
    else if (p.leaf.kind === 'info' && tm.hasInfo) mark(s.c0, s.c1, s.r0, s.r0 + rows(infoNeed(tm, p.rect.w)));
  }
  return use;
}
/** empty bands across the whole sheet: an interior band reads as a gap in the composition (rows or columns with
 *  nothing between two that carry something); open space at one edge is fine up to about a quarter of the sheet */
function deadBands(use: Uint8Array, L: Lattice): number {
  const rowUsed = Array.from({ length: L.nr }, (_, r) => { for (let c = 0; c < L.nc; c++) if (use[r * L.nc + c]) return true; return false; });
  const colUsed = Array.from({ length: L.nc }, (_, c) => { for (let r = 0; r < L.nr; r++) if (use[r * L.nc + c]) return true; return false; });
  const score = (u: boolean[], k: number) => {
    const first = u.indexOf(true), last = u.lastIndexOf(true);
    if (first < 0) return 10;
    let interior = 0;
    for (let i = first; i <= last; i++) if (!u[i]) interior++;
    const edge = first + (u.length - 1 - last);
    return interior * (k / u.length) * 1.4 + Math.max(0, edge / u.length - 0.25) * 6;
  };
  return score(rowUsed, 8) + score(colUsed, 6);
}

// ---------------------------------------------------------------- modular
export function modular(ctx: Ctx, noBleed = false): void {
  const { W, H, u, pal } = ctx;
  const pics = picsOf(ctx);
  if (!pics.length) return typeled(ctx);
  const wide = W / H > 1.5;
  const n = pics.length;
  const ss = (ctx.num('smallScale') || 100) / 100;
  const b0 = Math.round(u * 1.9 * ss);
  // the major lattice (the typologies are judged on it); strips and large block sets use its compound fine grid
  const asked = String(ctx.p.gridLayout ?? 'auto') as Typology | 'auto';
  // phase 17: a lead layout that was asked for (hero / steps) keeps its lead picture when it falls back to another typology
  const leadAsked = ctx.layered && (asked === 'hero' || asked === 'steps');
  const mHon = ctx.honor.has('margin') ? Math.round(Math.min(W, H) * ctx.num('margin') / 100) : undefined;
  const major = modularLattice(W, H, ctx.rg, { gutter: ctx.honor.has('gutter') && ctx.num('gutter') > 0 ? ctx.num('gutter') : b0, margin: mHon ?? Math.round(b0 * ctx.rg.pick([1.5, 2, 2.5])), cols: ctx.num('cols') || undefined, rows: ctx.num('rows') || undefined });
  const fineL = !ctx.num('cols') && major.nc <= 12 ? refine(major, b0) : major;
  // finer proportion steps where many pictures share the sheet
  const latticeFor = (t: Typology) => (t === 'strip' || (t === 'blocks' && n >= 5) || (t === 'hero' && n >= 4) ? fineL : major);
  const ars = pics.map((p) => p.ar);
  const tw = typologyWeights(n, wide);
  // typology: the control when it fits; else a first draw by count and format (the cost may still move it below)
  let ty: Typology;
  if (asked !== 'auto' && (TYPOLOGIES as string[]).includes(asked) && feasible(asked, n, major, ars)) ty = asked;
  else ty = ctx.rng.weighted<Typology>(TYPOLOGIES.map((t) => [t, feasible(t, n, major, ars) ? tw[t] : 0] as [Typology, number]));
  if (!feasible(ty, n, major, ars)) ty = 'hero';
  writeGrid(major, ctx.grid);
  const C = ctx.grid.content;
  const tm = typeModel(ctx, major.b, major.g, C);
  const shortHead = tm.opts[0].w100 / 100 < 5;
  const tplFor = (Lt: Lattice) => {
    const colsSpan = (wpx: number) => Math.max(1, Math.ceil((wpx + Lt.g) / (Lt.cw + Lt.g)));
    return {
      L: Lt, n, rng: ctx.rng, hasInfo: tm.hasInfo,
      headMinC: Math.min(Lt.nc, colsSpan(shortHead ? C.w * 0.3 : C.w * 0.45)),
      infoMinC: Math.min(Lt.nc, colsSpan(tm.minMeasure)),
      heroShare: n === 1 ? 0.42 : n <= 3 ? 0.36 : 0.3,
      satShare: n > 1 ? clamp((0.6 - (n <= 3 ? 0.36 : 0.3)) / (n - 1), 0.025, 0.12) : 0.05,
      ars,
    };
  };
  // leaf costs depend on the leaf and the span's pixel size only (translation does not change them)
  const caches = new Map<Leaf, Map<number, number>>();
  const cost: LeafCost = (lf: Leaf, _s: Span, r: Rect) => {
    let m = caches.get(lf);
    if (!m) { m = new Map(); caches.set(lf, m); }
    const key = Math.round(r.w) * 8192 + Math.round(r.h);
    let v = m.get(key);
    if (v === undefined) { v = costRaw(lf, r); m.set(key, v); }
    return v;
  };
  const costRaw = (lf: Leaf, r: Rect): number => {
    switch (lf.kind) {
      case 'img': return pics[lf.i!] ? pictureCost(pics[lf.i!], r, W, H, u, lf.share, lf.tag === 'hero') : Infinity;
      case 'head': return headCost(tm, r.w, r.h, u, H);
      case 'info': return infoCost(tm, r.w, r.h, H);
      default: return 0;
    }
  };
  // every feasible typology is solved; the draw chooses among the ones whose best fit is close to the overall best
  // (the typology weights keep the variety, the cost keeps poor fits out). An asked-for typology is kept as is.
  // the first draw is kept when it fits well; otherwise every feasible typology is solved and compared
  // an asked-for typology that cannot be built falls back to the others
  const others = TYPOLOGIES.filter((t) => t !== ty && feasible(t, n, major, ars) && tw[t] > 0);
  const pool = asked !== 'auto' && ty === asked ? [ty, ...others] : [ty, ...others];
  const keepAsked = asked !== 'auto' && ty === asked;
  const byTy = new Map<Typology, { name: string; cost: number; ps: Placed[]; L: Lattice }[]>();
  for (const t of pool) {
    if (t !== ty && byTy.has(ty) && (keepAsked || Math.min(...byTy.get(ty)!.map((c) => c.cost)) <= GOOD_FIT)) break;
    const Lt = latticeFor(t);
    const full: Span = { c0: 0, c1: Lt.nc, r0: 0, r1: Lt.nr };
    const list: { name: string; cost: number; ps: Placed[]; L: Lattice }[] = [];
    // on the fine grid a draw tries a seeded subset of the templates (the selector's candidates cover the rest)
    const all = templates(t, tplFor(Lt));
    const tried = Lt !== major && all.length > 5 ? ctx.rng.shuffle(all).slice(0, 5) : all;
    for (const cd of tried) {
      const ps = cd.tree ? solve(Lt, cd.tree, full, cost)?.placed ?? null : cd.explicit!(cost);
      if (!ps) continue;
      list.push({ name: cd.name, cost: ps.reduce((s, p) => s + p.cost, 0) + globalCost(ps, t, Lt, pics, tm, u, leadAsked), ps, L: Lt });
    }
    if (list.length) byTy.set(t, list);
  }
  const bestOf = (t: Typology) => Math.min(...(byTy.get(t) ?? []).map((c) => c.cost));
  const best = Math.min(...[...byTy.keys()].map(bestOf));
  const okTy = [...byTy.keys()].filter((t) => bestOf(t) <= best + 1.6);
  if (okTy.length) {
    const want = byTy.has(ty) && okTy.includes(ty) && ctx.rng.chance(0.55) ? ty : ctx.rng.weighted<Typology>(okTy.map((t) => [t, tw[t] * Math.exp(-(bestOf(t) - best) / 0.8)] as [Typology, number]));
    ty = want;
  }
  const cands = byTy.get(ty) ?? [];
  const pick = choose(ctx, cands);
  if (!pick) return n >= 2 && !noBleed ? bleedgrid(ctx, true) : exhibit(ctx);
  const Lp = pick.L;
  if (Lp !== major) writeGrid(Lp, ctx.grid);
  const ps0 = ctx.rng.chance(0.4) ? mirrorX(Lp, pick.ps) : pick.ps;
  // phase 17: on layered posters the type layer places the headline and the info block among the fields the pictures
  // leave (the template's own arrangement is one of the options); the pictures stay where the placement layer put them
  const tchoice = ctx.layered ? retype(ctx, Lp, ps0, ty, tplFor(Lp), cost, pics, tm, u) : { ps: ps0, name: 'template' };
  const ps = tchoice.ps;
  const o = out(ctx, `grid:${ty}`);
  o.sem.vars.typeset = { kind: 'free', value: tchoice.name };
  o.sem.vars.typology = { kind: 'free', value: ty };
  o.sem.vars.template = { kind: 'free', value: pick.name };
  o.sem.vars.fit = { kind: 'coupled', value: [...byTy.keys()].map((t) => `${t}:${bestOf(t).toFixed(2)}`).join(' '), from: 'cost' };
  o.sem.vars.lattice = { kind: 'coupled', value: `${Lp.nc}x${Lp.nr}`, from: 'format' };
  const on = pal.bg;
  // ---- one colour field (a quiet Swiss accent) in an empty field run, when the accent reads on the ground
  if (ctx.on('zones') && ctx.rng.chance(0.22) && wcag(pal.accent, on) > 1.6) {
    // a near-square run of empty fields (a sliver reads as a mistake, a slab as a second picture)
    const textSpans = ps.filter((p) => p.leaf.kind === 'head' || p.leaf.kind === 'info').map((p) => p.span);
    const hitsText = (a: Span) => textSpans.some((b) => a.c0 < b.c1 && b.c0 < a.c1 && a.r0 < b.r1 && b.r0 < a.r1);
    const empties = ps0.filter((p) => p.leaf.kind === 'void' && !hitsText(p.span) && (p.span.c1 - p.span.c0) * (p.span.r1 - p.span.r0) >= 2 && p.rect.w / p.rect.h > 0.55 && p.rect.w / p.rect.h < 1.9 && (p.rect.w * p.rect.h) / (W * H) > 0.025 && (p.rect.w * p.rect.h) / (W * H) < 0.1);
    const e = empties.sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h)[0];
    if (e) { const r = ctx.add({ kind: 'rect', id: ctx.id('g16c'), layer: 'zones', ...e.rect, fill: pal.accent }); o.role(r.id, 'ornament'); }
  }
  // ---- pictures
  const treat = ctx.rng.weighted({ natural: 8, mono: 1, heroColour: 0.8 });
  for (const p of ps.filter((x) => x.leaf.kind === 'img')) {
    const pic = pics[p.leaf.i!];
    const gray = treat === 'mono' || (treat === 'heroColour' && p.leaf.i !== 0);
    const node = ctx.image(pic.a, p.rect, gray ? { filter: { grayscale: true, contrast: 1.06 } } : {});
    o.role(node.id, 'image');
    o.sem.crops.push({ node: node.id, protect: pic.sub });
    if (p.bleed.l || p.bleed.r || p.bleed.t || p.bleed.b) o.sem.breaks.push({ kind: 'bleed', nodes: [node.id], reason: 'the picture runs from its field edge to the trim' });
    ctx.occupied.push(p.rect);
  }
  // ---- type
  const head = ps.find((p) => p.leaf.kind === 'head');
  const info = ps.find((p) => p.leaf.kind === 'info');
  const fill = strong(ctx, on);
  let hb: Rect | null = null;
  if (head) {
    const accent = wcag(pal.accent, on) >= 3 && ctx.rt.chance(0.22) ? pal.accent : fill;
    hb = setHead(ctx, o, tm, head.rect, head.leaf.anchor ?? 'top', accent, on, tm.subWithHead).box;
  }
  if (info) {
    const cols: Rect[] = [];
    for (let c = info.span.c0; c < info.span.c1; c++) cols.push(spanRect(Lp, { c0: c, c1: c + 1, r0: info.span.r0, r1: info.span.r1 }));
    // a hairline on the info region's top edge (a Swiss column rule), sometimes
    if (ctx.on('lines') && ctx.rt.chance(0.45) && tm.hasInfo) hair(ctx, info.rect.x, info.rect.y - Lp.g / 2, info.rect.x + info.rect.w, info.rect.y - Lp.g / 2, 0.75, fill);
    setInfo(ctx, o, tm, info.rect, on, !tm.subWithHead, cols);
    if (hb) o.sem.relations.push({ type: 'align', a: 'headline', b: 'info', edge: 'left' });
  }
  if (ty === 'flow' && head && pick.name.startsWith('flow-hang') && ctx.on('lines') && ctx.rt.chance(0.55)) {
    // the flowline itself, drawn as a rule across the type area
    const y = head.rect.y + head.rect.h + Lp.g / 2;
    hair(ctx, Lp.x0, y, W - Lp.m.r, y, 0.8, fill);
  }
  o.sem.layers = ['ground', 'image', 'headline', 'info'];
}

/** the type layer of a modular layout: head / info placements around the fixed pictures, chosen by the type stream */
function retype(ctx: Ctx, L: Lattice, ps: Placed[], ty: Typology, tpl: TplIn, cost: LeafCost, pics: Pic[], tm: TypeModel, u: number): { ps: Placed[]; name: string } {
  const imgs = ps.filter((p) => p.leaf.kind === 'img');
  const score = (all: Placed[]) => all.reduce((s, p) => s + p.cost, 0) + globalCost(all, ty, L, pics, tm, u);
  const variants: { ps: Placed[]; cost: number; name: string; sig: string }[] = [];
  const sigOf = (all: Placed[]) => all.filter((p) => p.leaf.kind === 'head' || p.leaf.kind === 'info').map((p) => `${p.leaf.kind}${p.span.c0},${p.span.c1},${p.span.r0},${p.span.r1}${p.leaf.anchor ?? ''}`).sort().join('|');
  const add = (all: Placed[], name: string) => { const sig = sigOf(all); if (!variants.some((v) => v.sig === sig)) variants.push({ ps: all, cost: score(all), name, sig }); };
  add(ps, 'template');
  const fixed = imgs.map((p) => ({ leaf: p.leaf, span: p.span }));
  for (const anchor of ['top', 'bottom'] as const) for (const side of ['left', 'right'] as const) for (const infoFar of [false, true]) {
    const r = placeType(tpl, fixed, cost, anchor, { side, infoFar });
    if (r) add([...imgs, ...r.filter((p) => p.leaf.kind !== 'img')], `${anchor}-${side}${infoFar ? '-apart' : ''}`);
  }
  const pick = choose(ctx, variants, 1.0, 2.2, ctx.rt) ?? variants[0];
  return { ps: pick.ps, name: pick.name };
}

// ---------------------------------------------------------------- bleed grid
export function bleedgrid(ctx: Ctx, fromModular = false): void {
  const { W, H, u, pal } = ctx;
  const pics = picsOf(ctx);
  if (pics.length < 2) return fromModular ? exhibit(ctx) : modular(ctx, true);
  const ss = (ctx.num('smallScale') || 100) / 100;
  const b0 = Math.round(u * 1.9 * ss);
  const asked = String(ctx.p.gridLayout ?? 'auto');
  const ty: BleedTypology = asked === 'rows' ? 'rows' : asked === 'mosaic' ? 'mosaic' : ctx.rng.chance(0.62) ? 'mosaic' : 'rows';
  const seamKind = ctx.rg.weighted({ none: 3, hair: 2.4, gap: 1.2 });
  const seam = ctx.honor.has('gutter') ? ctx.num('gutter') : seamKind === 'none' ? 0 : seamKind === 'hair' ? Math.max(2, Math.round(u * 0.4)) : Math.round(u * 1.4);
  const frame = seamKind === 'gap' && ctx.rg.chance(0.6) ? seam : seamKind === 'hair' && ctx.rg.chance(0.25) ? seam : 0;
  const R = { x: frame, y: frame, w: W - 2 * frame, h: H - 2 * frame };
  // the snapping lattice (for the grid view and snap lines): a fine full-sheet grid on the baseline unit
  const L = lattice(W, H, Math.max(4, Math.round(W / (u * 8.5))), Math.max(4, Math.round(H / (u * 8.5))), seam, b0, { t: frame, r: frame, b: frame, l: frame });
  writeGrid(L, ctx.grid);
  const tm = typeModel(ctx, L.b, Math.max(seam, b0), { x: u * 4, y: u * 4, w: W * 0.5, h: H * 0.5 });
  const pad = Math.max(u * 3.2, b0 * 1.5);
  const infoCell = tm.heavy;
  const leaves: MLeaf[] = pics.map((p, i) => ({ t: 'leaf', kind: 'img', i, ar: p.ar, tag: i === 0 ? 'hero' : 'sat' }));
  const headLeaf: MLeaf = { t: 'leaf', kind: 'head', ar: 1.4, flex: [0.45, 4.2] };
  const infoLeaf: MLeaf | null = infoCell ? { t: 'leaf', kind: 'info', ar: 1, flex: [0.4, 2.6] } : null;
  const items = [...leaves, headLeaf, ...(infoLeaf ? [infoLeaf] : [])];
  const rng = ctx.rng.fork('bleed');
  const trees: MNode[] = [];
  if (ty === 'mosaic') {
    for (let k = 0; k < 56; k++) {
      const shuffled = rng.shuffle(items);
      // a third of the trees isolate the hero at the root: it then takes a whole side
      if (k % 3 === 0) {
        const rest = shuffled.filter((x) => x !== leaves[0]);
        const sub = randomTree(rest, rng);
        trees.push({ t: rng.chance(0.5) ? 'h' : 'v', kids: rng.chance(0.5) ? [leaves[0], sub] : [sub, leaves[0]] });
      } else trees.push(randomTree(shuffled, rng));
    }
  } else {
    const nIt = items.length;
    const axis: 'v' | 'h' = W / H > 1.3 ? (rng.chance(0.7) ? 'h' : 'v') : rng.chance(0.85) ? 'v' : 'h';
    for (let k = 0; k < 40; k++) {
      const nRows = clamp(Math.round(Math.sqrt(nIt * (axis === 'v' ? H / W : W / H)) + rng.range(-0.6, 0.6)), 2, Math.min(5, nIt));
      const rows: number[] = []; let left = nIt;
      for (let r = nRows; r > 0; r--) { const v = r === 1 ? left : clamp(Math.round(left / r + rng.range(-1, 1)), 1, left - (r - 1)); rows.push(v); left -= v; }
      // the hero sits in the row with the fewest items (the tallest row): a gallery wall still has a lead picture
      const rest = rng.shuffle(items.filter((x) => x !== leaves[0]));
      const r0 = rows.indexOf(Math.min(...rows));
      const seq: MLeaf[] = []; let it = 0;
      rows.forEach((cnt, r) => { const slot = r === r0 ? (rng.chance(0.5) ? 0 : cnt - 1) : -1; for (let j = 0; j < cnt; j++) seq.push(j === slot ? leaves[0] : rest[it++]); });
      trees.push(rowsTree(seq, rows, axis));
    }
  }
  // hero structures (mosaic): the first picture takes a whole side, the satellites share a row / column / small grid,
  // the type takes its own cell beside them; orders are drawn (a mosaic is still a hierarchy)
  if (ty === 'mosaic') {
    const sats = leaves.slice(1);
    const textNode = (): MNode => (infoLeaf ? { t: rng.chance(0.5) ? 'v' : 'h', kids: [headLeaf, infoLeaf] } : headLeaf);
    const grid = (axis: 'h' | 'v'): MNode => { if (sats.length <= 3) return sats.length === 1 ? sats[0] : { t: axis, kids: rng.shuffle(sats) }; const k = Math.ceil(sats.length / 2); const sh = rng.shuffle(sats); const inner = axis === 'h' ? 'h' : 'v'; return { t: axis === 'h' ? 'v' : 'h', kids: [{ t: inner, kids: sh.slice(0, k) }, { t: inner, kids: sh.slice(k) }] }; };
    const ord = (a: MNode, b: MNode): MNode[] => (rng.chance(0.5) ? [a, b] : [b, a]);
    for (let k = 0; k < 4; k++) {
      trees.push({ t: 'v', kids: ord(leaves[0], { t: 'h', kids: ord(textNode(), grid('h')) }) });
      trees.push({ t: 'v', kids: ord({ t: 'h', kids: ord(leaves[0], textNode()) }, grid('h')) });
      trees.push({ t: 'h', kids: ord(leaves[0], { t: 'v', kids: ord(grid('v'), textNode()) }) });
      trees.push({ t: 'v', kids: [textNode(), ...ord(leaves[0], grid('h'))] });
    }
  }
  // structured candidates: the type takes a whole side (a column on long sheets, a band on tall ones) and the
  // pictures fill the rest as a mosaic: a proper type cell is always among the options
  for (let k = 0; k < 14; k++) {
    const imgsTree = ty === 'rows' ? rowsTree(rng.shuffle(leaves), splitRows(leaves.length, rng), W / H > 1.3 ? 'h' : 'v') : randomTree(rng.shuffle(leaves), rng);
    const textNode: MNode = infoLeaf ? { t: rng.chance(0.5) ? 'v' : 'h', kids: [headLeaf, infoLeaf] } : headLeaf;
    const axis = rng.chance(W / H > 1.2 ? 0.8 : 0.3) ? 'h' : 'v';
    trees.push({ t: axis, kids: rng.chance(0.5) ? [textNode, imgsTree] : [imgsTree, textNode] });
  }
  // every structure also gets a version with the hero swapped into its largest picture slot
  const swapHero = (tree: MNode): MNode | null => {
    const t = solveFlex(tree, R.w / R.h);
    const mp = layoutTree(tree, R, t, 1, W, H).filter((p) => p.leaf.kind === 'img');
    const big = mp.reduce((m, p) => (p.rect.w * p.rect.h > m.rect.w * m.rect.h ? p : m), mp[0]);
    if (!big || big.leaf.i === 0) return null;
    const other = big.leaf;
    const clone = (n: MNode): MNode => (n.t === 'leaf' ? (n === leaves[0] ? other : n === other ? leaves[0] : n) : { t: n.t, kids: n.kids.map(clone) });
    return clone(tree);
  };
  for (const tr of trees.slice()) { const sw = swapHero(tr); if (sw) trees.push(sw); } // a snapshot: the loop appends
  const unit = b0;
  const cands: { cost: number; mp: MPlaced[]; tree: MNode }[] = [];
  for (const tree of trees) {
    const t = solveFlex(tree, R.w / R.h);
    const mp = layoutTree(tree, R, t, unit, W, H).map((p) => ({ ...p, rect: insetSeam(p, seam, W, H, frame) }));
    let c = 0;
    const imgs = mp.filter((p) => p.leaf.kind === 'img');
    for (const p of imgs) {
      const pic = pics[p.leaf.i!];
      c += pictureCost(pic, p.rect, W, H, u);
      if (Math.min(p.rect.w, p.rect.h) < u * 11) c += 3;
      if ((p.rect.w * p.rect.h) / (W * H) < 0.03) c += 2;
    }
    const hd = mp.find((p) => p.leaf.kind === 'head')!;
    const inner = (r: Rect) => ({ w: Math.max(1, r.w - 2 * pad), h: Math.max(1, r.h - 2 * pad) });
    const hi = inner(hd.rect);
    const reserve = infoLeaf ? 0 : tm.hasInfo ? infoNeed(tm, hi.w) + tm.b : 0;
    c += headCost(tm, hi.w, Math.max(1, hi.h - reserve), u, H) + (reserve > hi.h * 0.7 ? 4 : 0);
    const hs = (hd.rect.w * hd.rect.h) / (W * H);
    if (hs > 0.28) c += (hs - 0.28) * 10; if (hs < 0.07) c += 2;
    const ar = hd.rect.w / hd.rect.h; if (ar < 0.42 || ar > 4.5) c += 2;
    if (infoLeaf) { const ip = mp.find((p) => p.leaf.kind === 'info')!; const ii = inner(ip.rect); c += infoCost(tm, ii.w, ii.h, H) + ((ip.rect.w * ip.rect.h) / (W * H) > 0.22 ? 1.5 : 0); }
    const area = (p: MPlaced) => p.rect.w * p.rect.h;
    // the first picture is the hero: in a mosaic it is clearly the largest; in justified rows it is at least not smaller
    const hero = imgs.find((p) => p.leaf.i === 0)!, maxO = Math.max(...imgs.filter((p) => p.leaf.i !== 0).map(area));
    if (hero && area(hero) < maxO) c += ty === 'mosaic' ? 4 + 3 * (1 - area(hero) / maxO) : 0.8 + 1.5 * (1 - area(hero) / maxO);
    else if (ty === 'mosaic' && hero && area(hero) < maxO * 1.5) c += 0.8 * (1.5 - area(hero) / maxO);
    cands.push({ cost: c, mp, tree });
  }
  const pick = choose(ctx, cands, 0.4, 1.0);
  if (!pick) return fromModular ? exhibit(ctx) : modular(ctx, true);
  const o = out(ctx, `bleed:${ty}`);
  o.sem.vars.typology = { kind: 'free', value: ty };
  o.sem.vars.seam = { kind: 'free', value: seam };
  // ground under the seams: the paper (or the ink, when seams are wide on a dark ground)
  for (const p of pick.mp.filter((x) => x.leaf.kind === 'img')) {
    const pic = pics[p.leaf.i!];
    const node = ctx.image(pic.a, p.rect);
    o.role(node.id, 'image');
    o.sem.crops.push({ node: node.id, protect: pic.sub });
    if (p.edges.l || p.edges.r || p.edges.t || p.edges.b) o.sem.breaks.push({ kind: 'bleed', nodes: [node.id], reason: 'edge-to-edge picture field' });
    ctx.occupied.push(p.rect);
  }
  // the type cell(s): paper, accent or ink
  const accOK = (bg: string) => wcag(bg, strong(ctx, bg)) >= 4.5;
  const fillKind = ctx.rt.weighted({ paper: 4.5, accent: wcag(pal.accent, pal.bg) > 1.3 && accOK(pal.accent) ? 3 : 0, ink: 2 });
  const cellFill = fillKind === 'paper' ? pal.bg : fillKind === 'accent' ? pal.accent : relLum(pal.bg) > 0.4 ? pal.dark : pal.light;
  const hd = pick.mp.find((p) => p.leaf.kind === 'head')!;
  const ip = pick.mp.find((p) => p.leaf.kind === 'info');
  const cell = (r: Rect, f: string) => { if (f === pal.bg) return; const n = ctx.add({ kind: 'rect', id: ctx.id('g16cell'), layer: 'zones', ...r, fill: f }); o.role(n.id, 'ornament'); };
  cell(hd.rect, cellFill);
  const infoFill = ip ? (ctx.rt.chance(0.5) ? cellFill : pal.bg) : cellFill;
  if (ip) cell(ip.rect, infoFill);
  const inR = (r: Rect): Rect => ({ x: r.x + pad, y: r.y + pad, w: Math.max(1, r.w - 2 * pad), h: Math.max(1, r.h - 2 * pad) });
  const hr = inR(hd.rect);
  const anchor = ctx.rt.chance(0.55) ? 'top' : 'bottom';
  if (!ip && tm.hasInfo) {
    // head and info share the cell: the head takes what the info leaves
    const need = dry(ctx, () => setInfo(ctx, null, tm, { ...hr, h: hr.h * 2 }, cellFill, !tm.subWithHead).y - hr.y);
    const hh = Math.max(u * 6, hr.h - need - tm.b * 2);
    // head above, info at the foot of the cell (or the info first, the head standing on the cell's foot)
    const headR = anchor === 'top' ? { ...hr, h: hh } : { ...hr, y: hr.y + hr.h - hh, h: hh };
    const infoR = anchor === 'top' ? { ...hr, y: hr.y + hr.h - need, h: need } : { ...hr, h: need };
    setHead(ctx, o, tm, headR, anchor, strong(ctx, cellFill), cellFill, tm.subWithHead);
    setInfo(ctx, o, tm, infoR, cellFill, !tm.subWithHead);
  } else {
    setHead(ctx, o, tm, hr, anchor, strong(ctx, cellFill), cellFill, tm.subWithHead);
    if (ip) setInfo(ctx, o, tm, inR(ip.rect), infoFill, !tm.subWithHead);
  }
  o.sem.layers = ['ground', 'image', 'cell', 'headline', 'info'];
}

/** a split of n items into 2–3 justified rows */
function splitRows(n: number, rng: { next(): number }): number[] {
  if (n <= 2) return [n];
  const r = n >= 5 && rng.next() < 0.5 ? 3 : 2;
  const out: number[] = []; let left = n;
  for (let k = r; k > 0; k--) { const v = k === 1 ? left : Math.max(1, Math.round(left / k + (rng.next() - 0.5))); out.push(v); left -= v; }
  return out.filter((v) => v > 0);
}

/** seams: interior edges give up half a seam each; with a frame the outer edges are already inset */
function insetSeam(p: MPlaced, seam: number, W: number, H: number, frame: number): Rect {
  if (seam <= 0) return p.rect;
  const r = p.rect, h = seam / 2;
  const l = r.x <= frame + 0.5 ? 0 : h, t = r.y <= frame + 0.5 ? 0 : h;
  const rr = r.x + r.w >= W - frame - 0.5 ? 0 : h, bb = r.y + r.h >= H - frame - 0.5 ? 0 : h;
  return { x: r.x + l, y: r.y + t, w: r.w - l - rr, h: r.h - t - bb };
}
