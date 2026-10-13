// Phase 17: the three layers of a poster's structure, re-rolled one at a time (generate.ts: GenInput.layers / reroll).
//   网格 grid   the grid system: columns, margins, baseline, modules (the pictures and the type re-flow into the new grid)
//   图位 place  where the pictures (and the panels that hold them) sit; the type is set again around them
//   排字 type   how the type is set: line breaks, alignment, sizes within the block, colour, where the info sits; the
//               pictures stay exactly where they are
import type { Layer } from './generate';

export const LAYERS: Layer[] = ['grid', 'place', 'type'];

/** compositions whose picture position is fixed by the design (full-bleed, a fixed plate, a disc): 图位 has nothing to vary */
export const FIXED_PLACE = new Set<string>(['cover', 'fullbleed', 'ghost', 'layered', 'mosaic', 'object', 'quote', 'ring', 'veil', 'window']);

export const LAYER_INFO: Record<Layer, { zh: string; en: string; dzh: string; den: string; key: string }> = {
  grid: { zh: '网格', en: 'Grid', dzh: '换网格系统：栏数、页边距、基线与模块，图片和文字随新网格重排', den: 'A new grid system: columns, margins, baseline and modules; pictures and type re-flow into it', key: 'G' },
  place: { zh: '图位', en: 'Placement', dzh: '换图片在版面上的位置与大小，文字围绕新位置重新排', den: 'Move the pictures (position and size); the type is set again around them', key: 'P' },
  type: { zh: '排字', en: 'Type', dzh: '只换文字的排法：断行、对齐、字号、颜色和信息块位置，图片纹丝不动', den: 'Only the typesetting: line breaks, alignment, sizes, colour and where the info sits; pictures stay put', key: 'T' },
};

/** the toast when a layer has nothing else to offer on this poster */
export function layerHint(lang: string, layer: Layer, comp: string): string {
  const zh = lang === 'zh';
  if (layer === 'place' && FIXED_PLACE.has(comp)) return zh ? '这个版式的图片位置是固定的（满版 / 定位版式）：要换图位，用「整体结构」' : 'This layout fixes the picture position (full-bleed / set plate): use “Whole structure” to move it';
  const n = zh ? LAYER_INFO[layer].zh : LAYER_INFO[layer].en.toLowerCase();
  return zh ? `这个版式的${n}没有找到别的排法，试试「整体结构」` : `No other ${n} for this layout: try “Whole structure”`;
}
