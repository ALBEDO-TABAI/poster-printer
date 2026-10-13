// Phase 16: the Swiss modular grid engine (src/engine/swiss/) and its two compositions.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rng } from '../src/engine/rng';
import { generate } from '../src/engine/generate';
import { modularLattice, spanRect, lattice } from '../src/engine/swiss/lattice';
import { solve, leaf, H, V } from '../src/engine/swiss/solver';
import { solveFlex, aspectOf, layoutTree, type MLeaf, type MNode } from '../src/engine/swiss/mosaic';
import type { ImageNode, SceneNode, TextNode } from '../src/engine/types';
import { input, RATIOS } from './p8util';

const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8')) as { id: string; w: number; h: number; tier?: string; cutout?: unknown }[];
const flat = (ns: SceneNode[], out: SceneNode[] = []): SceneNode[] => { for (const n of ns) { if (n.kind === 'group') flat(n.children, out); else out.push(n); } return out; };
const inter = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** a set of photos with mixed proportions (portrait, landscape, square, panorama) */
const photos = images.filter((a) => a.tier === 'photo' && !a.cutout);
const mixed = (k: number, seed: string) => new Rng(seed).sample(photos, k).map((a) => a.id);

describe('swiss lattice', () => {
  it('fields + gutter are whole baselines and spans tile the type area', () => {
    for (const [W, H] of [[1200, 1600], [1200, 2133], [1200, 1200], [1600, 1200], [2133, 1200], [2800, 1200]]) {
      const L = modularLattice(W, H, new Rng('L' + W + H));
      expect(Math.abs((L.fh + L.g) / L.b - L.lines)).toBeLessThan(1e-6);
      const all = spanRect(L, { c0: 0, c1: L.nc, r0: 0, r1: L.nr });
      expect(all.x).toBeCloseTo(L.m.l, 6); expect(all.y).toBeCloseTo(L.m.t, 6);
      expect(all.x + all.w).toBeCloseTo(W - L.m.r, 6); expect(all.y + all.h).toBeCloseTo(H - L.m.b, 6);
      // a bleeding span reaches the trim
      const b = spanRect(L, { c0: 0, c1: 1, r0: 0, r1: 1 }, { l: true, t: true });
      expect(b.x).toBe(0); expect(b.y).toBe(0);
    }
  });
});

describe('template solver', () => {
  it('fits each picture span to its proportion and keeps leaves disjoint', () => {
    const L = lattice(1200, 1600, 12, 16, 20, 20, { t: 40, r: 40, b: 40, l: 40 });
    const ars = [1.5, 0.66, 1];
    const tree = V(leaf('head', { min: [6, 2] }), H(...ars.map((_, i) => leaf('img', { i }))), leaf('void'));
    const res = solve(L, tree, { c0: 0, c1: 12, r0: 0, r1: 16 }, (lf, _s, r) => (lf.kind === 'img' ? Math.abs(Math.log((r.w / r.h) / ars[lf.i!])) * 3 - (r.w * r.h) / 1e6 : 0));
    expect(res).not.toBeNull();
    const ps = res!.placed;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) expect(inter(ps[i].rect, ps[j].rect)).toBe(0);
    for (const p of ps.filter((x) => x.leaf.kind === 'img')) expect(Math.abs(Math.log((p.rect.w / p.rect.h) / ars[p.leaf.i!]))).toBeLessThan(0.2);
  });
  it('the slicing tree solves a flexible cell for the sheet proportion', () => {
    const items: MLeaf[] = [{ t: 'leaf', kind: 'img', i: 0, ar: 1.5 }, { t: 'leaf', kind: 'img', i: 1, ar: 0.7 }, { t: 'leaf', kind: 'head', ar: 1, flex: [0.4, 4] }];
    const tree: MNode = { t: 'v', kids: [items[0], { t: 'h', kids: [items[1], items[2]] }] };
    const t = solveFlex(tree, 0.75);
    expect(aspectOf(tree, t)).toBeCloseTo(0.75, 3);
    const ps = layoutTree(tree, { x: 0, y: 0, w: 1200, h: 1600 }, t, 1, 1200, 1600);
    for (const p of ps.filter((x) => x.leaf.kind === 'img')) expect(Math.abs(p.rect.w / p.rect.h - p.leaf.ar)).toBeLessThan(0.01);
  });
});

describe('modular / bleedgrid compositions', () => {
  it('lay out every given picture on every format, without text collisions', () => {
    let n = 0;
    for (const comp of ['modular', 'bleedgrid']) for (const ratio of RATIOS) for (let k = 0; k < 4; k++) {
      const ids = mixed(2 + ((k * 3 + ratio.length) % 6), `${comp}${ratio}${k}`);
      const r = generate(input(`S${comp}${ratio}${k}`, ratio, ['neue-grid', 'zh-modern-song', 'editorial-play', 'instrument'][k], comp, { lockedImages: ids }));
      expect(r.picked.comp).toBe(comp);
      expect(r.picked.imageIds).toEqual(ids);
      const ns = flat(r.scene.nodes);
      const shown = new Set(ns.filter((x): x is ImageNode => x.kind === 'image').map((x) => x.imageId));
      for (const id of ids) expect(shown.has(id)).toBe(true);
      expect(((r.scene.info.geo as { fails: string[] }).fails ?? []).filter((f) => f.startsWith('collide'))).toEqual([]);
      // copy never sits on a picture
      const imgs = ns.filter((x): x is ImageNode => x.kind === 'image');
      for (const t of ns.filter((x): x is TextNode => x.kind === 'text' && x.layer === 'text' && x.lines.length > 0)) for (const im of imgs) expect(inter(t.box, im) / Math.max(1, t.box.w * t.box.h)).toBeLessThan(0.05);
      n++;
    }
    expect(n).toBe(48);
  });
  it('the first picture is the hero: largest in hero / steps / mosaic layouts', () => {
    const area = (ns: SceneNode[], id: string) => Math.max(0, ...ns.filter((x): x is ImageNode => x.kind === 'image' && x.imageId === id).map((x) => x.w * x.h));
    let checked = 0;
    for (const [comp, lay] of [['modular', 'hero'], ['modular', 'steps'], ['bleedgrid', 'mosaic']] as const) for (const ratio of ['3:4', '1:1', '16:9']) for (let k = 0; k < 5; k++) {
      const ids = mixed(lay === 'steps' ? 3 : 5, `H${comp}${lay}${ratio}${k}`);
      const inp = input(`H${comp}${lay}${ratio}${k}`, ratio, 'neue-grid', comp, { lockedImages: ids }) as { params: Record<string, unknown> };
      inp.params.gridLayout = lay;
      const r = generate(inp as never);
      const p = { ...(r.scene.info.sem as { vars?: Record<string, { value: unknown }> }).vars };
      if (p.typology?.value !== lay && !(comp === 'modular' && lay === 'steps' && ratio === '16:9')) continue; // the asked layout may fall back when it cannot be built
      const ns = flat(r.scene.nodes);
      const hero = area(ns, ids[0]);
      for (const id of ids.slice(1)) expect(hero).toBeGreaterThanOrEqual(area(ns, id) * 0.999);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });
  it('random draws add companions from the pool, and replays lock them exactly', () => {
    for (const comp of ['modular', 'bleedgrid']) for (const seed of ['R1', 'R2', 'R3']) {
      const a = generate(input(seed + comp, '3:4', 'neue-grid', comp));
      expect(a.picked.imageIds.length).toBeGreaterThanOrEqual(2);
      const b = generate(input(seed + comp, '3:4', 'neue-grid', comp, { lockedImages: a.picked.imageIds, forceAttempt: a.picked.attempt, lockedPalette: a.picked.palette, lockedTexts: a.picked.texts, forcePlan: a.picked.plan, forceIdea: a.picked.idea }));
      expect(JSON.stringify(b.scene.nodes)).toBe(JSON.stringify(a.scene.nodes));
    }
  });
  it('is fast enough for the selector', () => {
    const t0 = performance.now();
    let k = 0;
    for (const comp of ['modular', 'bleedgrid']) for (const ratio of ['3:4', '16:9']) for (let i = 0; i < 10; i++) { generate(input(`P${comp}${ratio}${i}`, ratio, 'neue-grid', comp, { lockedImages: mixed(3 + (i % 4), 'p' + i) })); k++; }
    const per = (performance.now() - t0) / k;
    console.log(`swiss: ${per.toFixed(1)} ms per draw`);
    expect(per).toBeLessThan(60);
  });
});
