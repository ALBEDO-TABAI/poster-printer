import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generate, DEFAULT_MODULES } from '../src/engine/generate';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { BUILTIN_STYLES } from '../src/data/styles';
import { TEXT_SETS } from '../src/data/texts';
import { approxMeasurer } from '../src/engine/text/measure';

const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8'));
const palettes = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
const V3 = ['cover', 'index', 'echo', 'knockout', 'vertical', 'quote', 'ring'];
const RATIOS = ['3:4', '1:1', '9:16', '4:3', '16:9', '21:9'];

function run(seed: string, ratio: string, styleId: string, comp: string, extra: Record<string, unknown> = {}) {
  const style = BUILTIN_STYLES.find((s) => s.id === styleId) ?? BUILTIN_STYLES[0];
  return generate({ seeds: { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' }, ratio: ratio as never, style, params: { ...DEFAULT_PARAMS, ...style.params, composition: comp } as never, modules: DEFAULT_MODULES, modes: [], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer, ...extra } as never);
}

function finite(o: unknown): boolean {
  if (typeof o === 'number') return Number.isFinite(o);
  if (Array.isArray(o)) return o.every(finite);
  if (o && typeof o === 'object') return Object.values(o).every(finite);
  return true;
}

describe('phase 5 compositions', () => {
  const styles = ['warm-serif', 'zh-stone', 'gallery-syne', 'zh-heavy-hei'];
  for (const comp of V3) {
    it(`${comp}: finite geometry on every ratio`, () => {
      for (const ratio of RATIOS) for (const st of styles) {
        const r = run(`t5-${comp}-${ratio}-${st}`, ratio, st, comp);
        expect(r.scene.nodes.length).toBeGreaterThan(2);
        expect(finite(r.scene.nodes)).toBe(true);
        expect(r.scene.nodes.some((n: { kind: string }) => n.kind === 'text')).toBe(true);
        for (const n of r.scene.nodes as Array<Record<string, number>>) {
          if (n.kind as unknown === 'rect') { expect(n.w).toBeGreaterThanOrEqual(0); expect(n.h).toBeGreaterThanOrEqual(0); }
        }
      }
    });
  }

  it('auto composition is deterministic for a seed', () => {
    const a = run('det-1', '3:4', 'warm-serif', 'auto');
    const b = run('det-1', '3:4', 'warm-serif', 'auto');
    expect(JSON.stringify(a.scene.nodes)).toBe(JSON.stringify(b.scene.nodes));
  });

  it('forceComp keeps the poster on the given composition', () => {
    const r = run('force-1', '3:4', 'warm-serif', 'auto', { forceComp: 'ring' });
    expect(r.scene.info.comp).toBe('ring');
  });

  it('recency sampler spreads compositions across a session', () => {
    const seen: string[] = [];
    let repeats = 0;
    for (let i = 0; i < 40; i++) {
      const r = run(`rec-${i}`, '3:4', BUILTIN_STYLES[i % BUILTIN_STYLES.length].id, 'auto', { recent: seen.slice(-4) });
      const c = String((r.picked as { kind?: string }).kind ?? r.scene.info.comp ?? ''); // phase 18: build posters by page archetype
      if (seen.length && seen[seen.length - 1] === c) repeats++;
      seen.push(c);
    }
    expect(new Set(seen).size).toBeGreaterThanOrEqual(6);
    expect(repeats).toBeLessThanOrEqual(6);
  });

  it('replaying stored picks reproduces the poster exactly (locks do not change the plan)', () => {
    for (let i = 0; i < 60; i++) {
      const style = BUILTIN_STYLES[i % BUILTIN_STYLES.length];
      const a = run('replay' + i, (['3:4', '16:9', '1:1'] as const)[i % 3], style.id, 'auto', { recent: ['ring', 'quote'] });
      const pk = JSON.parse(JSON.stringify(a.picked));
      const b = run('replay' + i, (['3:4', '16:9', '1:1'] as const)[i % 3], style.id, 'auto', { recent: ['edge'], lockedTexts: pk.texts, lockedPalette: pk.palette, lockedImages: pk.imageIds, forceAttempt: pk.attempt ?? 0, forceComp: pk.comp, forcePlan: pk.plan });
      expect(JSON.stringify(b.scene.nodes)).toBe(JSON.stringify(a.scene.nodes));
    }
  });
});
