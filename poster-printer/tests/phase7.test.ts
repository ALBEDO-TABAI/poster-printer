import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generate, DEFAULT_MODULES } from '../src/engine/generate';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { BUILTIN_STYLES } from '../src/data/styles';
import { TEXT_SETS } from '../src/data/texts';
import { approxMeasurer } from '../src/engine/text/measure';
import { Rng } from '../src/engine/rng';
import { IDEAS, IDEA_IDS, sampleIdea } from '../src/engine/gen/ideas';
import { gates, gatePenalty } from '../src/engine/aesthetic/gates';
import { breakLines, spaceHanLatin } from '../src/engine/text/breaker';
import { archOf } from '../src/engine/gen/sampler';
import { writeFileSync } from 'node:fs';

const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8'));
const palettes = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
const RATIOS = ['3:4', '1:1', '9:16', '4:3', '16:9', '21:9'];
function input(seed: string, ratio: string, styleId: string, comp = 'auto', extra: Record<string, unknown> = {}) {
  const style = BUILTIN_STYLES.find((s) => s.id === styleId) ?? BUILTIN_STYLES[0];
  return { seeds: { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' }, ratio: ratio as never, style, params: { ...DEFAULT_PARAMS, ...style.params, composition: comp } as never, modules: DEFAULT_MODULES, modes: [], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer, ...extra } as never;
}
const finite = (o: unknown): boolean => typeof o === 'number' ? Number.isFinite(o) : Array.isArray(o) ? o.every(finite) : o && typeof o === 'object' ? Object.values(o).every(finite) : true;
const compW = { knockout: 1, ring: 1, edge: 1, substitute: 1, hanzi: 1, ma: 1, inset: 1, calendar: 1, anomaly: 1, window: 1, cover: 1, object: 1, panorama: 1, vertical: 1, quote: 1, bento: 1, fullbleed: 1, split: 1, veil: 1, wide: 1, partition: 1, index: 1, echo: 1, ghost: 1, mosaic: 1, giant: 1, typo: 1, cards: 1 };
const opt = { hasImg: true, hasCut: true, zh: true, wide: false };

describe('phase 7 idea layer', () => {
  it('has at least 12 ideas, each with a rule, contrasts and realisers', () => {
    expect(IDEAS.length).toBeGreaterThanOrEqual(12);
    for (const I of IDEAS) {
      expect(I.rule.length).toBeGreaterThan(10);
      expect(Object.keys(I.contrasts).length).toBeGreaterThan(0);
      expect(Object.keys(I.realisers).length).toBeGreaterThan(0);
    }
  });
  it('samples deterministically, honours force and exclude', () => {
    const a = sampleIdea(new Rng('x'), compW, opt)!, b = sampleIdea(new Rng('x'), compW, opt)!;
    expect(a.idea.id).toBe(b.idea.id);
    for (const id of IDEA_IDS) expect(sampleIdea(new Rng('f' + id), compW, { ...opt, force: id })!.idea.id).toBe(id);
    for (let i = 0; i < 40; i++) expect(sampleIdea(new Rng('e' + i), compW, { ...opt, exclude: ['tension', 'split'] })!.idea.id).not.toMatch(/^(tension|split)$/);
  });
  it('spreads over many ideas (effective kinds >= 8 over 300 samples)', () => {
    const c: Record<string, number> = {};
    for (let i = 0; i < 300; i++) { const id = sampleIdea(new Rng('s' + i), compW, opt)!.idea.id; c[id] = (c[id] ?? 0) + 1; }
    const n = 300; const eff = 2 ** -Object.values(c).reduce((s, v) => s + (v / n) * Math.log2(v / n), 0);
    expect(eff).toBeGreaterThanOrEqual(8);
  });
  it('records the idea and replays it exactly', () => {
    for (const [i, ratio] of RATIOS.entries()) {
      const inp = input(`p7r${i}`, ratio, BUILTIN_STYLES[(i * 7) % BUILTIN_STYLES.length].id, 'auto', { select: 6 });
      const a = generate(inp);
      expect(IDEA_IDS).toContain(a.picked.idea!.id);
      const replay = generate({ ...(inp as object), seeds: a.seeds, forceComp: a.picked.comp, forcePlan: a.picked.plan, forceIdea: a.picked.idea, layoutSalt: a.picked.salt, forceAttempt: a.picked.attempt, select: 0 } as never);
      expect(JSON.stringify(replay.scene)).toBe(JSON.stringify(a.scene));
    }
  });
});

describe('phase 7 compositions', () => {
  for (const comp of ['ma', 'substitute', 'hanzi', 'anomaly', 'calendar', 'window']) {
    it(`${comp}: finite geometry on every ratio`, () => {
      for (const ratio of RATIOS) for (const st of ['warm-serif', 'zh-stone', 'gallery-syne', 'zh-heavy-hei']) {
        const r = generate(input(`t7-${comp}-${ratio}-${st}`, ratio, st, comp));
        expect(finite(r.scene.nodes)).toBe(true);
        expect(r.scene.nodes.some((n: { kind: string }) => n.kind === 'text')).toBe(true);
      }
    });
  }
});

describe('phase 7 gates and CJK', () => {
  it('reports sane gate values and a bounded penalty', () => {
    for (let i = 0; i < 12; i++) {
      const r = generate(input(`g7-${i}`, RATIOS[i % 6], BUILTIN_STYLES[(i * 5) % BUILTIN_STYLES.length].id));
      const g = gates(r.scene);
      expect(finite(g)).toBe(true); expect(g.flatFills).toBeGreaterThanOrEqual(0);
      expect(g.toneBand).toBeGreaterThan(0); expect(g.toneBand).toBeLessThanOrEqual(1);
      expect(g.accent).toBeGreaterThanOrEqual(0); expect(g.accent).toBeLessThanOrEqual(1);
      expect(g.centroid).toBeGreaterThanOrEqual(0);
      expect(gatePenalty(g)).toBeGreaterThanOrEqual(0); expect(gatePenalty(g)).toBeLessThan(5);
    }
  });
  it('spaces Han/Latin boundaries and avoids one-character last lines', () => {
    expect(spaceHanLatin('第3期Open日')).toBe('第\u20053\u2005期\u2005Open\u2005日'.replace(/\u2005期/, '\u2005期'));
    const m = (s: string) => Array.from(s).length * 10;
    const lines = breakLines('山野之间的一场慢速散步会', 60, m, { minLast: 2 } as never);
    expect(Array.from(lines[lines.length - 1]).length).toBeGreaterThanOrEqual(2);
  });
});

describe('phase 7 variety', () => {
  it('keeps archetype effective kinds >= 10 over 480 selected draws (with session recency)', { timeout: 120000 }, () => {
    const arch: Record<string, number> = {}, comps: Record<string, number> = {}, ideas: Record<string, number> = {};
    const recent: string[] = [], recentI: string[] = [];
    const R = ['3:4', '3:4', '3:4', '9:16', '1:1', '4:3', '16:9', '21:9'];
    const N = Number(process.env.VARIETY_N ?? 480);
    for (let i = 0; i < N; i++) {
      const st = BUILTIN_STYLES[(i * 7) % BUILTIN_STYLES.length];
      const r = generate(input(`${process.env.VARIETY_SEED ?? 'var7'}-${i}`, R[i % R.length], st.id, 'auto', { select: Number(process.env.VARIETY_K ?? 8), recent: recent.slice(-4), recentIdeas: recentI.slice(-4) }));
      recent.push(r.picked.comp); recentI.push(r.picked.idea?.id ?? '');
      const a = archOf(r.picked.comp, r.scene.nodes.some((n: { cutout?: boolean }) => n.cutout));
      arch[a] = (arch[a] ?? 0) + 1; comps[r.picked.comp] = (comps[r.picked.comp] ?? 0) + 1; ideas[recentI[i]] = (ideas[recentI[i]] ?? 0) + 1;
    }
    const eff = (c: Record<string, number>) => { const n = Object.values(c).reduce((s, v) => s + v, 0); return 2 ** -Object.values(c).reduce((s, v) => s + (v / n) * Math.log2(v / n), 0); };
    if (process.env.VARIETY_OUT) writeFileSync(process.env.VARIETY_OUT, JSON.stringify({ arch: eff(arch), comp: eff(comps), idea: eff(ideas), archC: arch, compC: comps, ideaC: ideas }, null, 1));
    expect(eff(arch)).toBeGreaterThanOrEqual(10);
  });
});
