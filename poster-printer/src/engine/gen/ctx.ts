import { Rng } from '../rng';
import type { Params } from '../params';
import { num, str, bool } from '../params';
import type { SceneNode, TextNode, ImageNode, LayerKey, ModeKey, Shape, ImgFilter } from '../types';
import type { Palette } from '../color/palette';
import { textOn } from '../color/palette';
import { wcag, relLum } from '../color/contrast';
import type { Measurer, FontSpec } from '../text/measure';
import { breakLines, breakBalanced, breakWords, HANGING, isCJKChar, spaceHanLatin, widowKind } from '../text/breaker';
import type { FontSet, RoleKey, RoleFont, Lang } from '../typo';
import { applyCase, opticalTracking } from '../typo';
import type { Grid, Rect } from './grid';
import type { PickedTexts, PT } from './pick';
import { imageDrawRect } from '../render/svg';
import { OFF_PLAN, type DrawPlan } from './plan';
import type { IdeaPick } from './ideas';

export interface ImageAsset {
  id: string; src: string; thumb?: string; w: number; h: number;
  palette: string[]; lum?: number[]; lumW?: number; lumH?: number;
  focus?: { x: number; y: number }; cutout?: string | null; category?: string; title?: string; credit?: unknown; user?: boolean;
  /** pool tier: photo (own/CC0 contemporary), illus (original flat illustration), museum (public-domain art), proc (procedural abstract) */
  tier?: string;
  /** salient subject bbox (0..1 of the image) and a 16×16 detail map (0 calm … 1 busy); see scripts/analyze-images.py */
  subject?: { x: number; y: number; w: number; h: number }; detail?: number[];
  /** phase 9 layout-first pictures: declared safe-text zones (0..1), the picture's accent, mood, and whether the cut-out subject may cross the headline */
  zones?: { role: string; x: number; y: number; w: number; h: number }[]; accent?: string; mood?: string; interleave?: boolean;
}

/**
 * Subject-aware crop: the image covers `frame` (slice fit); returns the alignment fractions (fx, fy) that keep the salient
 * subject inside the frame, its focus near the frame's centre/upper third, with a little headroom above the subject.
 */
export function cropAlign(asset: Pick<ImageAsset, 'w' | 'h' | 'focus' | 'subject'>, frame: { w: number; h: number }, zoom = 1): { fx: number; fy: number } {
  const s = Math.max(frame.w / asset.w, frame.h / asset.h) * zoom;
  const dw = asset.w * s, dh = asset.h * s;
  const f = asset.focus ?? { x: 0.5, y: 0.45 };
  const sub = asset.subject;
  const axis = (len: number, d: number, fc: number, s0: number | undefined, s1: number | undefined, target: number, head: number) => {
    const slack = len - d; // ≤ 0
    if (slack > -0.5) return 0.5;
    // offset o (draw origin relative to frame) in [slack, 0]; focus lands at o + fc*d
    let o = target * len - fc * d;
    if (s0 !== undefined && s1 !== undefined) {
      const a = s0 * d, b = s1 * d; // subject span in draw coords
      if (b - a <= len * 0.96) {
        // keep the whole subject (with headroom on the leading edge)
        const lo = len - b - len * 0.02, hi = -a + len * head;
        if (o < lo) o = lo; if (o > hi) o = hi;
      } else {
        // subject larger than the frame: keep its leading edge (heads, roof lines) and give up the far end
        o = Math.min(o, -a + len * head);
      }
    }
    o = Math.max(slack, Math.min(0, o));
    return o / slack;
  };
  const fx = axis(frame.w, dw, f.x, sub?.x, sub ? sub.x + sub.w : undefined, 0.5, 0.03);
  const fy = axis(frame.h, dh, f.y, sub?.y, sub ? sub.y + sub.h : undefined, 0.45, 0.06);
  return { fx, fy };
}

export type Align = 'start' | 'middle' | 'end';

export class Ctx {
  nodes: SceneNode[] = [];
  private k = 0;
  W: number; H: number; S: number; u: number;
  comp = ''; // composition chosen for this draw
  plan: DrawPlan = OFF_PLAN; // art-direction plan (v2)
  idea: IdeaPick | null = null; // phase 7: the idea this draw realises
  occupied: Rect[] = []; // text boxes, for collision avoidance of decorations
  /** phase 16: params the user chose explicitly for this draw (GenInput.honor); compositions may respect them */
  honor: Set<string> = new Set();
  rd: Rng; // decoration stream (independent so 'new graphics' variants keep the layout)
  /** phase 17: layered layout streams. `rng` places pictures, panels and blocks (图位); `rt` sets the type: line breaks,
   *  alignment, which side / band the copy takes, which groups show (排字); `rg` draws the grid system (网格). Legacy
   *  posters (no layers) share one stream for all three, so they replay exactly as before. */
  rt: Rng;
  rg: Rng;
  /** layered streams are on (new posters): type variations that legacy posters never drew may draw from `rt` */
  layered = false;
  /** phase 22: the type layer was re-rolled on a v3 poster: set-ups that v2 kept fixed (a masthead's alignment, a foot
   *  band's group) may draw from `rt` too */
  typeV3 = false;
  /** phase 18: the layout kinds of the last draws (session variety inside the construction engine) */
  recent: string[] = [];
  forceKind?: string;
  /** phase 18: what a layer re-roll moves away from */
  avoid?: { kind?: string; constructions?: string[] };
  /** type choices that legacy posters drew from the decor stream (display face, accent use): the type layer on layered posters */
  get rtd(): Rng { return this.layered ? this.rt : this.rd; }
  constructor(
    public rng: Rng, public grid: Grid, public p: Params, public pal: Palette, public fonts: FontSet,
    public texts: PickedTexts, public images: ImageAsset[], public measure: Measurer,
    public modules: Record<LayerKey, boolean>, public modes: Set<ModeKey>,
  ) {
    this.rt = rng; this.rg = rng;
    this.rd = new Rng(rng.seed + '|decor|' + String(p.decorSalt ?? ''));
    this.W = grid.W; this.H = grid.H; this.S = Math.min(this.W, this.H); this.u = this.S / 100;
  }
  id(prefix: string) { return `${prefix}${++this.k}`; }
  on(l: LayerKey) { return this.modules[l] !== false; }
  add<T extends SceneNode>(n: T): T { if (this.on(n.layer)) this.nodes.push(n); return n; }
  num(k: string) { return num(this.p, k); }
  str(k: string) { return str(this.p, k); }
  bool(k: string) { return bool(this.p, k); }
  mode(m: ModeKey) { return this.modes.has(m); }

  role(rk: RoleKey, lang: Lang): RoleFont { return this.fonts[lang][rk]; }
  spec(rk: RoleKey, lang: Lang, size: number): FontSpec {
    const r = this.role(rk, lang);
    const other = this.fonts[lang === 'en' ? 'zh' : 'en'][rk];
    return { family: r.family, weight: r.weight, size, tracking: r.tracking, italic: r.italic, fallback: lang === 'en' ? other.family : undefined };
  }
  caseOf(rk: RoleKey, lang: Lang, t: string) {
    if (lang !== 'en') return t;
    const c = this.str('case');
    const rc = this.role(rk, lang).case;
    if (c !== 'auto') return applyCase(t, c as RoleFont['case']);
    return applyCase(t, rc);
  }
  /** base sizes (px) for roles at current canvas */
  size(kind: 'note' | 'meta' | 'smallSub' | 'bigSub' | 'smallMain'): number {
    const ss = this.num('smallScale') / 100;
    const u = this.u;
    switch (kind) {
      case 'meta': return Math.max(9, u * 0.95) * ss;
      case 'note': return Math.max(10, u * 1.05) * ss;
      case 'smallSub': return u * 1.35 * ss;
      case 'bigSub': return u * 2.1 * Math.sqrt(this.num('titleScale') / 100);
      case 'smallMain': return u * 3.6 * (this.num('smallRel') / 32) * Math.sqrt(this.num('titleScale') / 100);
    }
  }
  lineW(text: string, sp: FontSpec) { return this.measure.width(text, sp); }

  /**
   * Typeset text into a box. Returns node + used height. y is the top of box (cap-height aligned).
   * mode: 'balance' | 'greedy' | 'words' | 'single'
   */
  text(pt: PT, rk: RoleKey, box: Rect, o: {
    size: number; align?: Align; valign?: 'top' | 'bottom' | 'middle'; fill?: string; on?: string; layer?: LayerKey;
    mode?: 'balance' | 'greedy' | 'words' | 'single'; fit?: boolean; maxLines?: number; lines?: number; leading?: number; tracking?: number; weight?: number; family?: string; opacity?: number; clip?: Shape; noCase?: boolean; fitHeight?: boolean; id?: string; minSize?: number;
  }): { node: TextNode; w: number; h: number; size: number } {
    if (!pt || !pt.t) return { node: { kind: 'text', id: this.id('t0'), layer: 'text', role: rk, lang: 'en', lines: [], size: o.size, family: 'Inter', weight: 400, tracking: 0, fill: 'none', anchor: 'start', box: { x: box.x, y: box.y, w: 0, h: 0 }, raw: '' } as TextNode, w: 0, h: 0, size: o.size };
    const lang = pt.lang;
    const rf = this.role(rk, lang);
    const raw0 = o.noCase ? pt.t : this.caseOf(rk, lang, pt.t);
    const raw = lang === 'zh' ? spaceHanLatin(raw0) : raw0;
    let size = o.size * (rf.size / 100);
    const upper = lang === 'en' && /[A-Z]/.test(raw) && raw === raw.toUpperCase();
    const optical = this.p.opticalTracking !== false;
    const mkSpec = (s: number): FontSpec => {
      const base = this.spec(rk, lang, s);
      let tr = o.tracking !== undefined ? o.tracking : optical ? (base.tracking || 0) + opticalTracking(s / this.u, lang, upper) : base.tracking;
      if (lang === 'zh' && o.tracking === undefined) tr = Math.max(0, tr || 0); // Han type is never tracked negative (SPEC §15.2)
      return { ...base, tracking: tr, ...(o.weight ? { weight: o.weight } : {}), ...(o.family ? { family: o.family } : {}) };
    };
    const leading = o.leading ?? rf.leading;
    const minLast = lang === 'zh' && rk.startsWith('big.') && rk !== 'big.note' ? 3 : 2;
    const breakAt = (s: number) => {
      const sp = mkSpec(s);
      const wf = (t: string) => this.measure.width(t, sp);
      const maxW = box.w;
      switch (o.mode ?? 'balance') {
        case 'single': return raw.split('\n').map((l) => l);
        case 'greedy': return breakLines(raw, maxW, wf, { minLast });
        case 'words': {
          // phase 12: a forced k-line stack that strands a short last word re-stacks on k − 1 lines
          let ls = breakWords(raw, o.lines ?? 2, wf);
          for (let k = (o.lines ?? 2) - 1; k >= 2 && this.p.widowFix !== false && widowKind(ls, lang, wf); k--) { const l2 = breakWords(raw, k, wf); if (!widowKind(l2, lang, wf)) { ls = l2; break; } }
          return ls;
        }
        default: return breakBalanced(raw, maxW, wf, { minLast });
      }
    };
    let lines = breakAt(size);
    // trailing CJK comma / full stop hangs outside the measure (标点悬挂), so it doesn't count toward the fit width
    const hangW = (l: string, s: number) => { const c = l[l.length - 1]; return this.measure.width(c && HANGING.has(c) && isCJKChar(c) ? l.slice(0, -1) : l, mkSpec(s)); };
    const widest = (ls: string[], s: number) => Math.max(...ls.map((l) => hangW(l, s)));
    const m = this.measure.metrics(mkSpec(size));
    const capOf = (s: number) => (lang === 'zh' ? 0.84 : m.cap) * s;
    const heightOf = (ls: string[], s: number) => capOf(s) + (ls.length - 1) * s * leading + (lang === 'zh' ? 0.1 : 0.18) * s;
    if (o.fit !== false) {
      // shrink to fit width / maxLines / height
      for (let i = 0; i < 30; i++) {
        const w = widest(lines, size);
        const tooWide = w > box.w + 0.5;
        const tooMany = o.maxLines !== undefined && lines.length > o.maxLines;
        const tooTall = o.fitHeight && heightOf(lines, size) > box.h;
        if (!tooWide && !tooMany && !tooTall) break;
        size *= tooWide ? Math.max(0.6, Math.min(0.97, box.w / w)) : 0.93;
        if (o.minSize && size < o.minSize) { size = o.minSize; lines = breakAt(size); break; }
        lines = breakAt(size);
      }
    }
    // phase 12: widows / orphans (a stranded number, < 2 Han characters or one short word on the last line). First
    // re-break with balanced lines; then pull the text onto fewer lines by shrinking ≤ 8 % and tightening the tracking
    // ≤ 0.012 em (Latin only); otherwise leave it. Author line breaks (\n) and the deliberate one-word stacks
    // ('words' / 'single') are not touched.
    let trk: number | undefined;
    const wantFix = this.p.widowFix !== false && (o.mode ?? 'balance') !== 'words' && o.mode !== 'single' && !raw.includes('\n');
    const wfS = (l: string) => this.measure.width(l, mkSpec(size));
    if (wantFix && lines.length >= 2 && widowKind(lines, lang, wfS)) {
      const n0 = lines.length;
      const minS = Math.max(o.minSize ?? 0, size * 0.92);
      const bal = breakBalanced(raw, box.w, (t) => this.measure.width(t, mkSpec(size)), { minLast });
      // classic pull-down: the previous line gives its last word to the widow (Latin; Han is handled by minLast)
      const pd = (() => { if (lang !== 'en') return null; const ls = [...lines]; const pw = ls[ls.length - 2].trim().split(/\s+/); if (pw.length < 2) return null; ls[ls.length - 2] = pw.slice(0, -1).join(' '); ls[ls.length - 1] = pw[pw.length - 1] + ' ' + ls[ls.length - 1].trim(); return ls; })();
      if (bal.length <= n0 && !widowKind(bal, lang, wfS)) lines = bal;
      else if (pd && wfS(pd[pd.length - 1]) <= box.w + 0.5 && !widowKind(pd, lang, wfS)) lines = pd;
      else {
        let done = false;
        for (const f of [0.98, 0.96, 0.94, 0.92]) {
          for (const dt of lang === 'en' ? [0, -0.006, -0.012] : [0]) {
            const s2 = Math.max(minS, size * f);
            const base = mkSpec(s2); const sp2 = { ...base, tracking: (base.tracking || 0) + dt };
            const ls = breakBalanced(raw, box.w, (t) => this.measure.width(t, sp2), { minLast });
            if (ls.length < n0 && !widowKind(ls, lang, (t) => this.measure.width(t, sp2))) { size = s2; lines = ls; if (dt) trk = sp2.tracking; done = true; break; }
          }
          if (done) break;
        }
      }
    }
    const w = trk !== undefined ? Math.max(...lines.map((l) => this.measure.width(l, { ...mkSpec(size), tracking: trk }))) : widest(lines, size);
    const h = heightOf(lines, size);
    const align = o.align ?? 'start';
    const ax = align === 'start' ? box.x : align === 'middle' ? box.x + box.w / 2 : box.x + box.w;
    let top = box.y;
    if (o.valign === 'bottom') top = box.y + box.h - h;
    else if (o.valign === 'middle') top = box.y + (box.h - h) / 2;
    const cap = capOf(size);
    const tl = lines.map((l, i) => ({ text: l, x: ax, y: top + cap + i * size * leading }));
    const sp = trk !== undefined ? { ...mkSpec(size), tracking: trk } : mkSpec(size);
    const fill = o.fill ?? (o.on ? this.textColor(o.on, size) : this.pal.ink);
    const bx = align === 'start' ? box.x : align === 'middle' ? ax - w / 2 : ax - w;
    const node: TextNode = {
      kind: 'text', id: o.id ?? this.id('t'), layer: o.layer ?? 'text', role: rk, lang, lines: tl, size, family: sp.family, fallback: sp.fallback, weight: sp.weight, tracking: sp.tracking || 0, italic: sp.italic,
      fill, anchor: align, box: { x: bx, y: top, w, h }, raw, opacity: o.opacity, clip: o.clip,
    };
    this.add(node);
    if (node.layer === 'text' || node.layer === 'sidebar') this.occupied.push(node.box);
    return { node, w, h, size };
  }

  /** text color for a given fill */
  textColor(fill: string, size = 14, preferAccent = false) {
    const min = size > 36 ? 3 : this.num('minContrast');
    return textOn(fill, this.pal, min, preferAccent);
  }

  /** stacked title group: main + optional rule + sub + note. Returns bbox height. */
  group(g: { main: PT; sub?: PT; note?: PT }, kind: 'big' | 'small', box: Rect, o: { mainSize: number; align: Align; valign?: 'top' | 'bottom'; on: string; fill?: string; accentRule?: boolean; mode?: 'balance' | 'words' | 'greedy'; lines?: number; maxLines?: number; noteFirst?: boolean; subSize?: number; dry?: boolean; noFit?: boolean }) {
    const gap1 = this.num('mainBreath') * this.u / 12;
    const gap2 = this.num('subBreath') * this.u / 12 + 4;
    const subSize = o.subSize ?? (kind === 'big' ? this.size('bigSub') : this.size('smallSub'));
    const noteSize = this.size('note');
    if (g.note && !g.note.t) g = { ...g, note: undefined };
    if (g.sub && !g.sub.t) g = { ...g, sub: undefined };
    // measure pass (dry) to support bottom alignment
    const run = (y0: number, dry: boolean) => {
      const saved = this.nodes.length, savedOcc = this.occupied.length;
      let y = y0;
      const mainFill = o.fill ?? this.textColor(o.on, o.mainSize);
      const r1 = this.text(g.main, `${kind}.main`, { x: box.x, y, w: box.w, h: box.h }, { size: o.mainSize, align: o.align, on: o.on, fill: mainFill, mode: o.mode ?? 'balance', lines: o.lines, maxLines: o.maxLines ?? (kind === 'big' ? 4 : 3) });
      y += r1.h + gap1;
      if (o.accentRule && this.num('ruleWeight') > 0) {
        const rw = Math.max(1, this.u * 0.25 * this.num('ruleWeight') / 100);
        const rl = Math.min(box.w, this.u * (kind === 'big' ? 6 : 3.5));
        const rx = o.align === 'start' ? box.x : o.align === 'middle' ? box.x + box.w / 2 - rl / 2 : box.x + box.w - rl;
        this.add({ kind: 'rect', id: this.id('r'), layer: 'ornament', x: rx, y, w: rl, h: rw, fill: this.pal.accent !== o.on && wcag(this.pal.accent, o.on) > 1.8 ? this.pal.accent : mainFill });
        y += rw + gap1;
      }
      if (g.sub) {
        const r2 = this.text(g.sub, `${kind}.sub`, { x: box.x, y, w: Math.min(box.w, Math.max(box.w * 0.6, r1.w * 1.1)), h: box.h }, { size: subSize, align: o.align, on: o.on, mode: 'balance', maxLines: 3 });
        if (o.align !== 'start') r2.node.lines.forEach((l) => (l.x = o.align === 'middle' ? box.x + box.w / 2 : box.x + box.w));
        if (o.align !== 'start') r2.node.box.x = o.align === 'middle' ? box.x + box.w / 2 - r2.w / 2 : box.x + box.w - r2.w;
        y += r2.h + gap2 + subSize * 0.4;
      }
      if (g.note) {
        const r3 = this.text(g.note, `${kind}.note`, { x: box.x, y, w: Math.min(box.w, this.u * 26), h: box.h }, { size: noteSize, align: o.align, on: o.on, mode: 'greedy', fit: false, fill: this.textColor(o.on, noteSize) });
        if (o.align !== 'start') { r3.node.lines.forEach((l) => (l.x = o.align === 'middle' ? box.x + box.w / 2 : box.x + box.w)); r3.node.box.x = o.align === 'middle' ? box.x + box.w / 2 - r3.w / 2 : box.x + box.w - r3.w; }
        y += r3.h;
      }
      const h = y - y0;
      if (dry) { this.nodes.length = saved; this.occupied.length = savedOcc; }
      return h;
    };
    // fit the whole group into the box height (shrink main size, then drop the note)
    if (!o.noFit) {
      for (let i = 0; i < 6; i++) {
        const h = run(box.y, true);
        if (h <= box.h + 1) break;
        if (i >= 3 && g.note) { g = { ...g, note: undefined }; continue; }
        o = { ...o, mainSize: o.mainSize * Math.max(0.55, Math.min(0.95, (box.h / h) ** 0.9)) };
      }
    }
    if (o.valign === 'bottom') {
      const h = run(box.y, true);
      return o.dry ? h : run(box.y + box.h - h, false);
    }
    return run(box.y, !!o.dry);
  }

  /** place an image node */
  image(asset: ImageAsset, frame: Rect, o: { clip?: Shape; filter?: ImgFilter; overlay?: { color: string; opacity: number; blend?: string }; layer?: LayerKey; fx?: number; fy?: number; zoom?: number; cutout?: boolean; id?: string; opacity?: number } = {}): ImageNode {
    const zoom = (o.zoom ?? 1) * this.num('imageZoom') / 100;
    const sat = this.num('imgSat') / 100, ct = this.num('imgContrast') / 100;
    const filter: ImgFilter = { sat, contrast: ct, ...(o.filter || {}) };
    const n: ImageNode = {
      kind: 'image', id: o.id ?? this.id('i'), layer: o.layer ?? 'images', imageId: asset.id, src: o.cutout && asset.cutout ? asset.cutout : asset.src, iw: asset.w, ih: asset.h,
      x: frame.x, y: frame.y, w: frame.w, h: frame.h, ...this.align(asset, frame, zoom, o.fx, o.fy), zoom, filter, overlay: o.overlay, clip: o.clip, cutout: o.cutout, opacity: o.opacity,
    };
    return this.add(n);
  }

  /** crop alignment: explicit fx/fy win; otherwise subject-aware */
  align(asset: ImageAsset, frame: Rect, zoom: number, fx?: number, fy?: number) {
    const a = cropAlign(asset, frame, zoom);
    return { fx: fx ?? a.fx, fy: fy ?? a.fy };
  }
  /** estimate relative luminance of image under a region (0..1) */
  imageLum(asset: ImageAsset, frame: Rect, region: Rect, fx?: number, fy?: number): number {
    ({ fx, fy } = this.align(asset, frame, this.num('imageZoom') / 100, fx, fy));
    if (!asset.lum || !asset.lumW || !asset.lumH) return 0.35;
    const dr = imageDrawRect({ ...frame, iw: asset.w, ih: asset.h, fx, fy, zoom: this.num('imageZoom') / 100 });
    const gw = asset.lumW, gh = asset.lumH;
    let s = 0, c = 0;
    const x0 = Math.max(region.x, dr.x), x1 = Math.min(region.x + region.w, dr.x + dr.w);
    const y0 = Math.max(region.y, dr.y), y1 = Math.min(region.y + region.h, dr.y + dr.h);
    if (x1 <= x0 || y1 <= y0) return 0.35;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const px = x0 + ((i + 0.5) / 6) * (x1 - x0), py = y0 + ((j + 0.5) / 6) * (y1 - y0);
      const u = (px - dr.x) / dr.w, v = (py - dr.y) / dr.h;
      const gi = Math.min(gw - 1, Math.max(0, Math.floor(u * gw))), gj = Math.min(gh - 1, Math.max(0, Math.floor(v * gh)));
      s += asset.lum[gj * gw + gi]; c++;
    }
    return s / c;
  }

  /** legibility treatment for text over image region: returns {textColor, overlayOpacity, overlayColor} */
  legible(asset: ImageAsset, frame: Rect, region: Rect, size: number, preferLight = true) {
    const L = this.imageLum(asset, frame, region);
    const strength = this.num('legibility') / 100;
    const min = size > 36 ? 3 : 4.5;
    // light text: need bg lum <= (1.05/min) - 0.05
    const light = this.pal.light, dark = this.pal.dark;
    const target = 1.05 / min - 0.05;
    if (preferLight || L < 0.4) {
      const need = L <= target ? 0 : 1 - target / L;
      return { fill: light, opacity: Math.min(0.72, need * (0.6 + 0.6 * strength) + 0.08 * strength), color: dark, lum: L };
    }
    const tgt2 = min * 0.05 + 0.05 * min - 0.05; // dark text needs bg lum >= (min*(lt+0.05))-0.05
    const lt = relLum(dark);
    const needL = min * (lt + 0.05) - 0.05;
    const need = L >= needL ? 0 : (needL - L) / (1 - L);
    void tgt2;
    return { fill: dark, opacity: Math.min(0.7, need * (0.6 + 0.6 * strength) + 0.05 * strength), color: light, lum: L };
  }
}
