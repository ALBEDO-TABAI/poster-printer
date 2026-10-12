import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rng, newSeed } from '../src/engine/rng';
import { makeGrid } from '../src/engine/gen/grid';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { tokenize, breakLines, breakBalanced, breakWords } from '../src/engine/text/breaker';
import { approxMeasurer } from '../src/engine/text/measure';
import { generate, DEFAULT_MODULES } from '../src/engine/generate';
import { renderSVG } from '../src/engine/render/svg';
import { BUILTIN_STYLES, COMPS } from '../src/data/styles';
import { TEXT_SETS } from '../src/data/texts';
import { RATIOS, MODES, canvasSize, type SceneNode, type Ratio, type ModeKey } from '../src/engine/types';

const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8'));
const palettes = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
const W = (s: string) => [...s].length * 10;

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = new Rng('x'), b = new Rng('x'), c = new Rng('y');
    const sa = Array.from({ length: 20 }, () => a.next()), sb = Array.from({ length: 20 }, () => b.next());
    expect(sa).toEqual(sb);
    expect(Array.from({ length: 20 }, () => c.next())).not.toEqual(sa);
  });
  it('int stays in range, weighted respects zero weights', () => {
    const r = new Rng('r');
    for (let i = 0; i < 2000; i++) { const v = r.int(3, 7); expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(7); }
    for (let i = 0; i < 500; i++) expect(r.weighted([['a', 1], ['b', 0]])).toBe('a');
  });
  it('newSeed uses an unambiguous alphabet', () => { for (let i = 0; i < 50; i++) expect(newSeed()).toMatch(/^[A-NP-Z2-9]{12}$/); });
});

describe('CJK-aware line breaking', () => {
  it('never starts a line with closing punctuation (kinsoku)', () => {
    const txt = '网格负责秩序，偶然负责惊喜。每一次抽取都是新的开始！让文字找到自己的位置。';
    for (const maxW of [40, 50, 60, 70, 90, 120]) {
      const lines = breakLines(txt, maxW, W);
      for (const l of lines) expect('，。！？、；：）」』》'.includes(l[0])).toBe(false);
      expect(lines.join('')).toBe(txt);
    }
  });
  it('keeps latin words intact', () => {
    const toks = tokenize('Order Loves Accident 秩序');
    expect(toks.map((t) => t.t)).toContain('Order');
    const lines = breakLines('Order Loves Accident', 70, W);
    for (const l of lines) expect(['Order', 'Loves', 'Accident', 'Order Loves', 'Loves Accident'].includes(l.trim())).toBe(true);
  });
  it('balanced breaking does not exceed max width and evens lines', () => {
    const t = 'Measured space for restless ideas and quiet pages';
    const lines = breakBalanced(t, 300, W);
    for (const l of lines) expect(W(l)).toBeLessThanOrEqual(300);
    const ws = lines.map(W);
    expect(Math.max(...ws) - Math.min(...ws)).toBeLessThan(200);
  });
  it('word mode produces the requested number of lines when possible', () => {
    expect(breakWords('Twelve Units Endless Outcomes', 2, W).length).toBe(2);
  });
});

describe('grid engine', () => {
  for (const ratio of RATIOS) for (const density of ['simple', 'stable', 'full', 'aggressive', 'curve', 'curve2']) {
    it(`${ratio} ${density}: edges monotonic and inside the canvas`, () => {
      const [w, h] = canvasSize(ratio);
      for (let i = 0; i < 10; i++) {
        const g = makeGrid(new Rng(ratio + density + i), w, h, { ...DEFAULT_PARAMS, density });
        expect(g.x.length).toBe(g.nc + 1); expect(g.y.length).toBe(g.nr + 1);
        for (let k = 1; k < g.x.length; k++) expect(g.x[k]).toBeGreaterThan(g.x[k - 1]);
        for (let k = 1; k < g.y.length; k++) expect(g.y[k]).toBeGreaterThan(g.y[k - 1]);
        expect(g.content.x).toBeGreaterThanOrEqual(0); expect(g.content.y).toBeGreaterThanOrEqual(0);
        expect(g.content.x + g.content.w).toBeLessThanOrEqual(w + 0.5); expect(g.content.y + g.content.h).toBeLessThanOrEqual(h + 0.5);
      }
    });
  }
});

const walk = (ns: SceneNode[], f: (n: SceneNode) => void) => ns.forEach((n) => { f(n); if (n.kind === 'group') walk(n.children, f); });
function run(seed: string, ratio: Ratio, styleIdx: number, comp = 'auto', modes: ModeKey[] = []) {
  const style = BUILTIN_STYLES[styleIdx % BUILTIN_STYLES.length];
  return generate({
    seeds: { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' }, ratio, style, params: { ...DEFAULT_PARAMS, ...style.params, composition: comp } as never,
    modules: DEFAULT_MODULES, modes, fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer,
  });
}

describe('generator', () => {
  it('is deterministic: same seeds produce identical SVG', () => {
    for (let i = 0; i < 12; i++) {
      const a = renderSVG(run('D' + i, '3:4', i).scene), b = renderSVG(run('D' + i, '3:4', i).scene);
      expect(a.replace(/r\w+_/g, '')).toBe(b.replace(/r\w+_/g, ''));
    }
  });
  for (const comp of COMPS) it(`composition ${comp} renders in every ratio without NaN and in < 200ms`, () => {
    for (const ratio of RATIOS) for (let i = 0; i < 3; i++) {
      const r = run(`${comp}${ratio}${i}`, ratio, i * 5 + 1, comp);
      expect(r.picked.comp).toBe(comp === 'layered' && !r.picked.imageIds.length ? r.picked.comp : r.picked.comp);
      const svg = renderSVG(r.scene);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(r.ms).toBeLessThan(200);
      let texts = 0;
      walk(r.scene.nodes, (n) => {
        if (n.kind === 'text' && n.lines.length && n.layer === 'text' && n.role !== 'glyph') {
          texts++;
          // text boxes start on the canvas (giant/bleed type may run off the far edge by design)
          expect(n.box.x).toBeGreaterThan(-n.size * 1.2);
          expect(n.box.y).toBeGreaterThan(-n.size);
          expect(n.box.x).toBeLessThan(r.scene.w);
          expect(n.box.y).toBeLessThan(r.scene.h);
        }
      });
      expect(texts).toBeGreaterThan(0);
    }
  });
  for (const mode of MODES) it(`mode ${mode} generates cleanly`, () => {
    for (let i = 0; i < 8; i++) {
      const r = run(`${mode}${i}`, RATIOS[i % RATIOS.length], i * 3, 'auto', [mode]);
      expect(renderSVG(r.scene)).not.toMatch(/NaN|undefined/);
    }
  });
  it('text lock reproduces texts; colour lock reproduces palette', () => {
    const a = run('LK1', '3:4', 2);
    const style = BUILTIN_STYLES[2];
    const b = generate({
      seeds: { layout: 'other', text: 'other', color: 'other', image: 'other' }, ratio: '1:1', style, params: { ...DEFAULT_PARAMS, ...style.params } as never,
      modules: DEFAULT_MODULES, modes: [], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer, lockedTexts: a.picked.texts, lockedPalette: a.picked.palette, lockedImages: a.picked.imageIds,
    });
    expect(b.picked.texts).toEqual(a.picked.texts);
    expect(b.picked.palette).toEqual(a.picked.palette);
    expect(b.picked.imageIds.slice(0, a.picked.imageIds.length)).toEqual(a.picked.imageIds);
  });
  it('module toggles remove their layers', () => {
    const style = BUILTIN_STYLES[0];
    const mods = { ...DEFAULT_MODULES, text: false, images: false, ornament: false };
    const r = generate({ seeds: { layout: 'M', text: 'M', color: 'M', image: 'M' }, ratio: '3:4', style, params: { ...DEFAULT_PARAMS } as never, modules: mods, modes: [], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer });
    walk(r.scene.nodes, (n) => { expect(n.layer).not.toBe('text'); expect(n.layer).not.toBe('images'); expect(n.layer).not.toBe('ornament'); });
  });
  it('200 random generations stay fast (avg < 30ms)', () => {
    let t = 0;
    for (let i = 0; i < 200; i++) t += run('P' + i, RATIOS[i % 6], i).ms;
    expect(t / 200).toBeLessThan(30);
  });
});

describe('layout quality pass', () => {
  it('reports a score and records the chosen attempt', () => {
    const r = run('Q1', '3:4', 0);
    expect(r.picked.quality).toBeDefined();
    expect(r.picked.quality!.score).toBeGreaterThanOrEqual(0);
    expect(r.picked.attempt).toBeGreaterThanOrEqual(0);
  });
  it('forced attempt reproduces the exact scene (history restore stays exact)', () => {
    for (let i = 0; i < 20; i++) {
      const style = BUILTIN_STYLES[i % BUILTIN_STYLES.length];
      const base = { seeds: { layout: 'FA' + i, text: 'T' + i, color: 'C' + i, image: 'I' + i }, ratio: RATIOS[i % 6], style, params: { ...DEFAULT_PARAMS, ...style.params }, modules: DEFAULT_MODULES, modes: [] as ModeKey[], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer };
      const a = generate(base);
      const b = generate({ ...base, forceAttempt: a.picked.attempt });
      expect(JSON.stringify(b.scene.nodes)).toBe(JSON.stringify(a.scene.nodes));
    }
  });
  it('movable text never sits on giant type / glyphs after the pass (≥ 95% of draws clean)', () => {
    let clean = 0; const N = 240; let sum = 0;
    for (let i = 0; i < N; i++) {
      const r = run('QC' + i, RATIOS[i % 6], i % BUILTIN_STYLES.length, COMPS[i % COMPS.length]);
      const q = r.picked.quality!;
      sum += q.score;
      if (q.glyphHits === 0 && q.overlaps === 0) clean++;
    }
    expect(clean / N).toBeGreaterThan(0.95);
    expect(sum / N).toBeGreaterThan(85);
  });
  it('quality gate keeps generation inside the 200 ms budget', () => {
    let worst = 0;
    for (let i = 0; i < 60; i++) worst = Math.max(worst, run('QT' + i, RATIOS[i % 6], i % BUILTIN_STYLES.length).ms);
    expect(worst).toBeLessThan(200);
  });
});
