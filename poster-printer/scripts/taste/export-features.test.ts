// Exports scene features + by-eye premium labels for the taste model. Run: TASTE_EXPORT=1 npx vitest run scripts/taste/export-features.test.ts
import { it } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sceneFeatures, FEATURE_NAMES } from '../../src/engine/aesthetic/features';
const R = '/workspace/lotgo-research/';
const sets: [string, string, string, string][] = [['P3', 'classify/labels_O.txt', 'ours', 'o'], ['P4', 'classify/labels_O4.txt', 'ours4', 'p'], ['P4r1', 'classify/labels_O4_r1.txt', 'ours4_r1', 'p'], ['P4r2', 'classify/labels_O4_r2.txt', 'ours4_r2', 'p'], ['P4r3', 'classify/labels_O4_r3.txt', 'ours4_r3', 'p'], ['P5r3', 'classify/labels_O5_r3.txt', 'ours5', 'p'], ['P5r4', 'classify/labels_O5_r4.txt', 'ours5g', 'p'], ['P5', 'classify/labels_O5.txt', 'ours5i', 'p'], ['P6r1', 'classify/labels_O6_r1.txt', 'ours6a', 'p'], ['P6r2', 'classify/labels_O6_r2.txt', 'ours6b', 'p'], ['P6', 'classify/labels_O6.txt', 'ours6c', 'p']];
it.skipIf(!process.env.TASTE_EXPORT)('export features', () => {
  const rows = [['set', 'name', 'y', ...FEATURE_NAMES].join(',')];
  for (const [set, lab, dir, pre] of sets) {
    for (const l of readFileSync(R + lab, 'utf8').split('\n')) {
      if (!l.trim()) continue; const p = l.split('|'); const i = +p[0]; const y = +p[8];
      const f = `${R}${dir}/${pre}${String(i).padStart(3, '0')}.json`; if (!existsSync(f)) continue;
      const sc = JSON.parse(readFileSync(f, 'utf8')).scene; const v = sceneFeatures(sc);
      rows.push([set, `${dir}/${pre}${String(i).padStart(3, '0')}`, y, ...FEATURE_NAMES.map((k) => +(v[k] ?? 0).toFixed(5))].join(','));
    }
  }
  writeFileSync('/workspace/rea-poster/scripts/taste/train.csv', rows.join('\n'));
});
