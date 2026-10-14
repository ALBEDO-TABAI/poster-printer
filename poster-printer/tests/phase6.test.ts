import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generate, DEFAULT_MODULES, SELECT } from '../src/engine/generate';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { BUILTIN_STYLES } from '../src/data/styles';
import { TEXT_SETS } from '../src/data/texts';
import { approxMeasurer } from '../src/engine/text/measure';
import { archOf } from '../src/engine/gen/sampler';
import { tasteFromFeatures, tasteScore } from '../src/engine/aesthetic/score';

const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8'));
const palettes = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
const RATIOS = ['3:4', '1:1', '9:16', '4:3', '16:9', '21:9'];

function input(seed: string, ratio: string, styleId: string, comp = 'auto', extra: Record<string, unknown> = {}) {
  const style = BUILTIN_STYLES.find((s) => s.id === styleId) ?? BUILTIN_STYLES[0];
  return { seeds: { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' }, ratio: ratio as never, style, params: { ...DEFAULT_PARAMS, ...style.params, composition: comp } as never, modules: DEFAULT_MODULES, modes: [], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer, ...extra } as never;
}
const finite = (o: unknown): boolean => typeof o === 'number' ? Number.isFinite(o) : Array.isArray(o) ? o.every(finite) : o && typeof o === 'object' ? Object.values(o).every(finite) : true;
const eff = (c: Record<string, number>) => { const n = Object.values(c).reduce((s, v) => s + v, 0); return 2 ** -Object.values(c).reduce((s, v) => s + (v / n) * Math.log2(v / n), 0); };

describe('phase 6 compositions', () => {
  for (const comp of ['object', 'panorama']) {
    it(`${comp}: finite geometry on every ratio`, () => {
      for (const ratio of RATIOS) for (const st of ['warm-serif', 'zh-stone', 'gallery-syne', 'zh-heavy-hei']) {
        const r = generate(input(`t6-${comp}-${ratio}-${st}`, ratio, st, comp, { modes: ['layered'] }));
        expect(r.scene.nodes.length).toBeGreaterThan(2);
        expect(finite(r.scene.nodes)).toBe(true);
        expect(r.scene.nodes.some((n: { kind: string }) => n.kind === 'text')).toBe(true);
      }
    });
  }
});

describe('taste selector', () => {
  it('model matches the Python reference (scripts/taste/train_user.py)', () => {
    const rows = readFileSync(new URL('../scripts/taste/train.csv', import.meta.url), 'utf8').trim().split('\n');
    const head = rows[0].split(',');
    const row = rows.find((l) => l.split(',')[1] === 'ours6b/p109')!.split(',');
    const f: Record<string, number> = {};
    head.slice(3).forEach((k, i) => { f[k] = +row[i + 3]; });
    expect(tasteFromFeatures(f)).toBeCloseTo(6.8334, 3); // phase 10 model: python3 scripts/taste/train_user.py export (user ratings U1 + by-eye sets)
  });

  it('is deterministic and the winner replays exactly', () => {
    for (const [i, ratio] of RATIOS.entries()) {
      const inp = input(`sel${i}`, ratio, BUILTIN_STYLES[i * 5].id, 'auto', { select: 8 });
      const a = generate(inp), b = generate(inp);
      expect(JSON.stringify(a.scene)).toBe(JSON.stringify(b.scene));
      expect(a.picked.salt).toBeDefined();
      expect(a.picked.taste).toBeCloseTo(tasteScore(a.scene), 6);
      const replay = generate({ ...(inp as object), seeds: a.seeds, forceComp: a.picked.comp, forcePlan: a.picked.plan, forceIdea: a.picked.idea, layoutSalt: a.picked.salt, forceAttempt: a.picked.attempt, select: 0 } as never);
      expect(JSON.stringify(replay.scene)).toBe(JSON.stringify(a.scene));
    }
  });

  it('picks a candidate at least as good as the natural draw', () => {
    for (let i = 0; i < 12; i++) {
      const inp = input(`gain${i}`, RATIOS[i % 6], BUILTIN_STYLES[(i * 11) % BUILTIN_STYLES.length].id);
      const one = generate(inp);
      const sel = generate({ ...(inp as object), select: 8, selectMode: 'taste' } as never);
      // phase 7: the taste selector ranks by taste − gate penalty (phase 11: − geometry / palette-fit fails; phase 12: −
      // an unanchored lopsided candidate)
      const pen = (r: { scene: { info: { gates?: { penalty?: number }; geo?: { fails?: string[] }; paletteFit?: { fails?: string[] }; balance?: unknown } } }) => Number(r.scene.info.gates?.penalty ?? 0) + 3 * (r.scene.info.geo?.fails?.length ?? 0) + 2 * (r.scene.info.paletteFit?.fails?.length ?? 0) + SELECT.lopW * ((r.scene.info.balance as { lopsided?: boolean } | undefined)?.lopsided ? 1 : 0);
      expect(sel.picked.taste! - pen(sel as never)).toBeGreaterThanOrEqual(tasteScore(one.scene) - pen(one as never) - 1e-9);
    }
  });

  it('phase 11 light selector: never picks a geometry-failing candidate when the natural draw passes', () => {
    for (let i = 0; i < 12; i++) {
      const inp = input(`light${i}`, RATIOS[i % 6], BUILTIN_STYLES[(i * 7) % BUILTIN_STYLES.length].id);
      const one = generate(inp);
      const sel = generate({ ...(inp as object), select: 8 } as never);
      const gf = (r: { scene: { info: { geo?: { fails?: string[] } } } }) => r.scene.info.geo?.fails?.length ?? 0;
      if (!gf(one as never)) expect(gf(sel as never)).toBe(0);
    }
  });

  it('keeps archetype variety (effective kinds >= 9.5 over 120 selected draws)', { timeout: 60000 }, () => {
    const arch: Record<string, number> = {}; const recent: string[] = [];
    const R = ['3:4', '3:4', '3:4', '9:16', '1:1', '4:3', '16:9', '21:9'];
    for (let i = 0; i < 120; i++) {
      const st = BUILTIN_STYLES[(i * 7) % BUILTIN_STYLES.length];
      const r = generate(input(`ent${i}`, R[i % R.length], st.id, 'auto', { select: 8, recent: [...recent] }));
      recent.push(r.picked.kind ?? r.picked.comp);
      // phase 18: a construction-engine poster counts as its page archetype
      const a = r.picked.kind ?? archOf(r.picked.comp, r.scene.nodes.some((n: { cutout?: boolean }) => n.cutout));
      arch[a] = (arch[a] ?? 0) + 1;
    }
    expect(eff(arch)).toBeGreaterThanOrEqual(9.5);
  });
});
