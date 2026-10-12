import { readFileSync } from 'node:fs';
import { DEFAULT_MODULES } from '../src/engine/generate';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { BUILTIN_STYLES } from '../src/data/styles';
import { TEXT_SETS } from '../src/data/texts';
import { approxMeasurer } from '../src/engine/text/measure';
const images = JSON.parse(readFileSync(new URL('../public/images/manifest.json', import.meta.url), 'utf8'));
const palettes = JSON.parse(readFileSync(new URL('../public/data/palettes.json', import.meta.url), 'utf8'));
export const RATIOS = ['3:4', '1:1', '9:16', '4:3', '16:9', '21:9'];
export function input(seed: string, ratio: string, styleId: string, comp = 'auto', extra: Record<string, unknown> = {}) {
  const style = BUILTIN_STYLES.find((s) => s.id === styleId) ?? BUILTIN_STYLES[0];
  return { seeds: { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' }, ratio: ratio as never, style, params: { ...DEFAULT_PARAMS, ...style.params, composition: comp } as never, modules: DEFAULT_MODULES, modes: [], fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure: approxMeasurer, ...extra } as never;
}
export const finite = (o: unknown): boolean => typeof o === 'number' ? Number.isFinite(o) : Array.isArray(o) ? o.every(finite) : o && typeof o === 'object' ? Object.values(o).every(finite) : true;
export const LINEUP = { headline: '低频夜 LOW FREQUENCY NIGHT', sub: '六组现场 · 一夜 · Six live sets', small: ['22:00 雾港 Fog Harbour', '23:00 白噪 White Noise', '00:00 K-Line', '01:00 慢潮 Slow Tide', '02:15 Orbitals', '03:30 晨线 Dawnline'], note: [], meta: ['仓库七号 Warehouse 7', '¥120 / ¥160 door'] };

