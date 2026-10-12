import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { approxMeasurer } from '../src/engine/text/measure';
import { generate, DEFAULT_MODULES, type GenInput } from '../src/engine/generate';
import { renderSVG } from '../src/engine/render/svg';
import { BUILTIN_STYLES } from '../src/data/styles';
import { TEXT_SETS } from '../src/data/texts';
import { COMPONENTS, freeSlots, compSize, type PlacedComponent } from '../src/engine/components';
import { SIDEBAR_TEMPLATES } from '../src/engine/gen/sidebar';
import { nodeBoxOf } from '../src/engine/bbox';
import type { SceneNode, Ratio, TextNode } from '../src/engine/types';

const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8'));
const palettes = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
function input(seed: string, ratio: Ratio, styleIdx: number, extra: Partial<GenInput> = {}, params: Record<string, unknown> = {}): GenInput {
  const style = BUILTIN_STYLES[styleIdx % BUILTIN_STYLES.length];
  return {
    seeds: { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' }, ratio, style, params: { ...DEFAULT_PARAMS, ...style.params, ...params } as never,
    modules: DEFAULT_MODULES, modes: [], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer, ...extra,
  };
}
const walk = (ns: SceneNode[], f: (n: SceneNode) => void) => ns.forEach((n) => { f(n); if (n.kind === 'group') walk(n.children, f); });

describe('component slots', () => {
  it('every component builds a non-empty group inside its slot, in every ratio', () => {
    for (const ratio of ['3:4', '1:1', '16:9', '21:9', '9:16'] as Ratio[]) {
      const placed: PlacedComponent[] = COMPONENTS.map((c, i) => ({ id: 'k' + i, type: c.id, x: 0.05 + (i % 3) * 0.3, y: 0.05 + Math.floor(i / 3) * 0.22, scale: 1, salt: 's', color: 'auto' }));
      const r = generate(input('C' + ratio, ratio, 3, { placed }));
      for (const pc of placed) {
        const g = r.scene.nodes.find((n) => n.id === 'pc-' + pc.id);
        expect(g?.kind).toBe('group');
        if (g?.kind !== 'group') continue;
        expect(g.children.length).toBeGreaterThan(0);
        const b = nodeBoxOf(g)!;
        const sz = compSize(pc.type, 1, r.scene.w, r.scene.h);
        expect(b.w, pc.type + ratio).toBeLessThan(sz.w * 1.2 + 2.2 * Math.min(r.scene.w, r.scene.h) / 100);
        expect(b.h, pc.type + ratio).toBeLessThan(sz.h * 1.2 + 2.2 * Math.min(r.scene.w, r.scene.h) / 100);
      }
      expect(renderSVG(r.scene, { interactive: true })).toContain('pc-k0');
    }
  });
  it('placements persist across draws and do not perturb the layout', () => {
    const placed: PlacedComponent[] = [{ id: 'a', type: 'stamp', x: 0.7, y: 0.7, scale: 1, salt: 'x', color: 'auto' }];
    for (let i = 0; i < 6; i++) {
      const base = generate(input('P' + i, '3:4', i));
      const withC = generate(input('P' + i, '3:4', i, { placed, forceAttempt: base.picked.attempt }));
      const strip = (ns: SceneNode[]) => JSON.stringify(ns.filter((n) => !n.id.startsWith('pc-')));
      expect(strip(withC.scene.nodes)).toBe(strip(base.scene.nodes));
      expect(withC.scene.nodes.some((n) => n.id === 'pc-a')).toBe(true);
    }
  });
  it('component text is legible against what is under it', () => {
    let low = 0, total = 0;
    for (let i = 0; i < 20; i++) {
      const placed: PlacedComponent[] = ['caption', 'date', 'index', 'label'].map((t, k) => ({ id: 'q' + k, type: t, x: 0.1 + k * 0.2, y: 0.15 + (i % 4) * 0.18, scale: 1, salt: 'z' + i, color: 'auto' }));
      const r = generate(input('L' + i, '3:4', i, { placed }));
      walk(r.scene.nodes.filter((n) => n.id.startsWith('pc-')), (n) => { if (n.kind === 'text') { total++; if (!(n as TextNode).fill) low++; } });
    }
    expect(total).toBeGreaterThan(50);
    expect(low).toBe(0);
  });
  it('free-slot search prefers empty space over text', () => {
    for (let i = 0; i < 10; i++) {
      const r = generate(input('S' + i, i % 2 ? '16:9' : '3:4', i));
      const { w, h } = compSize('tag', 1.2, r.scene.w, r.scene.h);
      const slots = freeSlots(r.scene, w, h, [], 4);
      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) { expect(s.x).toBeGreaterThanOrEqual(0); expect(s.y + s.h).toBeLessThanOrEqual(r.scene.h + 0.5); }
      // the best slot overlaps at most a little real copy
      let hit = 0;
      walk(r.scene.nodes, (n) => { if (n.kind === 'text' && n.layer === 'text' && n.size < r.scene.w * 0.06) { const b = n.box, s = slots[0]; hit += Math.max(0, Math.min(b.x + b.w, s.x + s.w) - Math.max(b.x, s.x)) * Math.max(0, Math.min(b.y + b.h, s.y + s.h) - Math.max(b.y, s.y)); } });
      expect(hit / (w * h)).toBeLessThan(0.35);
    }
  });
});

describe('sidebar templates', () => {
  it('has 18 templates in 10 families and each renders', () => {
    expect(SIDEBAR_TEMPLATES.length).toBe(18);
    expect(new Set(SIDEBAR_TEMPLATES.map((t) => t.family)).size).toBe(10);
    for (const tp of SIDEBAR_TEMPLATES) {
      let found = false;
      for (let i = 0; i < 8 && !found; i++) {
        const r = generate(input('SB' + tp.id + i, '3:4', i, { forceSidebar: true }, { sidebarTpl: tp.id, composition: 'swiss' }));
        if (r.picked.sidebar === tp.id) { found = true; const k = r.scene.nodes.filter((n) => n.layer === 'sidebar').length; expect(k, tp.id).toBeGreaterThan(tp.family === 'corners' ? 0 : 1); }
      }
      expect(found, tp.id).toBe(true);
    }
  });
  it('per-template saved type size scales that template only', () => {
    const size = (sizes: Record<string, number>) => {
      const r = generate(input('SZ', '3:4', 2, { forceSidebar: true, sidebarSizes: sizes }, { sidebarTpl: 'colophon', composition: 'swiss', qualityGate: false, collisionFix: false }));
      const ts = r.scene.nodes.filter((n): n is TextNode => n.kind === 'text' && n.layer === 'sidebar');
      return ts.reduce((a, t) => a + t.size, 0) / ts.length;
    };
    const a = size({}), b = size({ colophon: 140 }), c = size({ 'data.rows': 140 });
    expect(b / a).toBeGreaterThan(1.3);
    expect(c).toBeCloseTo(a, 5);
  });
});
