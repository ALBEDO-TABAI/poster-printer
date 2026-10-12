import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { opticalTracking, typeScale, snapToScale } from '../src/engine/typo';
import { breakLines } from '../src/engine/text/breaker';
import { cjkLine } from '../src/engine/render/svg';
import { harmonyScore, muddiness, demud } from '../src/engine/color/harmony';
import { cropAlign } from '../src/engine/gen/ctx';
import { snapMove, gridSnapLines } from '../src/lib/snap';
import { designAudit } from '../src/engine/gen/audit';
import { freeSlots } from '../src/engine/components';
import { PAIRINGS } from '../src/data/pairings';
import { generate, DEFAULT_MODULES } from '../src/engine/generate';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { BUILTIN_STYLES } from '../src/data/styles';
import { TEXT_SETS } from '../src/data/texts';
import { approxMeasurer } from '../src/engine/text/measure';
import type { Ratio, SceneNode } from '../src/engine/types';

const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8'));
const palettes = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
const W = (s: string) => [...s].length * 10;
const walk = (ns: SceneNode[], f: (n: SceneNode) => void) => ns.forEach((n) => { f(n); if (n.kind === 'group') walk(n.children, f); });
function run(seed: string, ratio: Ratio, styleIdx: number, comp = 'auto') {
  const style = BUILTIN_STYLES[styleIdx % BUILTIN_STYLES.length];
  return generate({
    seeds: { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' }, ratio, style, params: { ...DEFAULT_PARAMS, ...style.params, composition: comp } as never,
    modules: DEFAULT_MODULES, modes: [], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer,
  });
}

describe('typography rules', () => {
  it('optical tracking tightens display and opens small caps', () => {
    expect(opticalTracking(20, 'en', false)).toBeLessThan(0);
    expect(opticalTracking(1.2, 'en', true)).toBeGreaterThan(0.05);
    expect(opticalTracking(1.2, 'en', true)).toBeGreaterThan(opticalTracking(1.2, 'en', false));
    expect(opticalTracking(12, 'zh', false)).toBeLessThan(0);
  });
  it('modular scale snapping never grows a size by more than maxGrow', () => {
    const lv = typeScale(10, 1.5, -1, 8);
    expect(lv[2] / lv[1]).toBeCloseTo(1.5);
    for (const s of [7, 13, 21, 48, 130]) {
      const v = snapToScale(s, lv, 1.04);
      expect(v).toBeLessThanOrEqual(s * 1.04 + 1e-9);
      expect(lv).toContain(v);
    }
  });
  it('hangs trailing CJK punctuation instead of orphaning it', () => {
    const lines = breakLines('我们读星空像读旧信。', 90, W, { hang: true });
    expect(lines[lines.length - 1]).not.toBe('。');
    expect(lines.join('')).toBe('我们读星空像读旧信。');
  });
  it('avoids single-word widows', () => {
    const lines = breakLines('one two three four five six seven', 200, (s) => s.length * 10, { widows: true });
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[lines.length - 1].trim().split(/\s+/).length).toBeGreaterThan(1);
  });
  it('compresses adjacent CJK punctuation', () => {
    const svg = cjkLine({ text: '好。」', x: 0, y: 0 }, 20, 0, 'start');
    expect(svg).toMatch(/dx="-10/);
  });
});

describe('colour rules', () => {
  it('detects and fixes muddy browns', () => {
    expect(muddiness('#7a6a4a')).toBeGreaterThan(0.3);
    expect(muddiness(demud('#7a6a4a'))).toBeLessThan(muddiness('#7a6a4a'));
    expect(muddiness('#1f4fa8')).toBeLessThan(0.1);
  });
  it('scores a disciplined palette above a muddy clash', () => {
    const good = harmonyScore({ bg: '#f2ede4', ink: '#1b1b1b', accent: '#d2462b', alt: '#c9c2b4' });
    const bad = harmonyScore({ bg: '#8a7a5a', ink: '#6f6a4e', accent: '#7f7355', alt: '#8c8160' });
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.score).toBeGreaterThan(0.7);
  });
});

describe('composition rules', () => {
  it('subject-aware crop keeps the subject inside the frame', () => {
    const asset = { w: 1000, h: 1000, focus: { x: 0.8, y: 0.3 }, subject: { x: 0.65, y: 0.15, w: 0.3, h: 0.4 } };
    const frame = { w: 400, h: 800 };
    const { fx, fy } = cropAlign(asset, frame);
    const s = Math.max(frame.w / asset.w, frame.h / asset.h), dw = asset.w * s, dh = asset.h * s;
    const ox = (frame.w - dw) * fx, oy = (frame.h - dh) * fy;
    expect(ox + 0.65 * dw).toBeGreaterThanOrEqual(-1);
    expect(ox + 0.95 * dw).toBeLessThanOrEqual(frame.w + 1);
    expect(oy + 0.15 * dh).toBeGreaterThanOrEqual(-1);
  });
  it('drag snapping pulls a box edge onto nearby grid lines only within tolerance', () => {
    const lines = gridSnapLines({ x: [50, 300, 550], y: [50, 450], gutter: 20, nc: 2, nr: 1, W: 600, H: 500 });
    const near = snapMove({ x: 45, y: 200, w: 100, h: 50 }, 2, 0, lines, 8);
    expect(near.gx).toBeDefined();
    const far = snapMove({ x: 120, y: 200, w: 100, h: 50 }, 3, 0, { xs: [0], ys: [] }, 8);
    expect(far.dx).toBe(3);
  });
  it('free-slot finder returns in-canvas slots with obstacles present', () => {
    const r = run('SLOT', '3:4', 3);
    const block = { x: 0, y: 0, w: r.scene.w, h: r.scene.h / 2 };
    const slots = freeSlots(r.scene, 120, 120, [block]);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x + s.w).toBeLessThanOrEqual(r.scene.w + 1);
      expect(s.y + s.h).toBeLessThanOrEqual(r.scene.h + 1);
    }
    let n = 0; walk(r.scene.nodes, () => n++); expect(n).toBeGreaterThan(3);
  });
  it('generated scenes respect block / decoration budgets and carry a design audit', () => {
    let pen = 0;
    for (let i = 0; i < 24; i++) {
      const r = run('BUD' + i, (['3:4', '16:9', '1:1', '9:16'] as Ratio[])[i % 4], i * 3);
      const a = designAudit({ nodes: r.scene.nodes, W: r.scene.w, H: r.scene.h, palette: r.scene.palette, images: images, comp: r.picked.comp });
      expect(a.decor).toBeLessThanOrEqual(3.5);
      expect(a.blocks).toBeLessThanOrEqual(10);
      expect(a.penalty).toBeGreaterThanOrEqual(0);
      pen += a.penalty;
      expect(r.scene.info.direction).toBeTruthy();
    }
    expect(pen / 24).toBeLessThan(15);
  });
  it('curated pairings cover every mood with a sane type ratio', () => {
    const moods = new Set(PAIRINGS.map((p) => p.mood));
    expect(moods.size).toBeGreaterThanOrEqual(6);
    for (const p of PAIRINGS) { expect(p.ratio).toBeGreaterThanOrEqual(1.2); expect(p.ratio).toBeLessThanOrEqual(1.7); }
  });
});
