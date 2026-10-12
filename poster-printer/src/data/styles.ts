import { expandRecipe, type FontRecipe, type FontSet } from '../engine/typo';
import type { Params } from '../engine/params';
import type { ModeKey } from '../engine/types';

export type LegacyComp = 'split' | 'checker' | 'fullbleed' | 'giant' | 'partition' | 'cards' | 'fan' | 'typefill' | 'swiss' | 'centered' | 'layered' | 'bands';
/** art direction v2 compositions (see src/engine/gen/comps2.ts) */
export type V2Comp = 'typo' | 'edge' | 'ghost' | 'bento' | 'veil' | 'mosaic' | 'inset';
export type V3Comp = 'cover' | 'index' | 'echo' | 'knockout' | 'vertical' | 'quote' | 'ring' | 'object' | 'panorama' | 'ma' | 'substitute' | 'hanzi' | 'anomaly' | 'calendar' | 'window';
/** phase 8: coupled-grammar strategies (src/engine/p8/grammar.ts) */
export type V8Comp = 'typeled' | 'interleave' | 'programme' | 'exhibit';
export type Comp = LegacyComp | V2Comp | V3Comp | V8Comp;
export const V8_COMPS: V8Comp[] = ['typeled', 'interleave', 'programme', 'exhibit'];
export const V3_COMPS: V3Comp[] = ['cover', 'index', 'echo', 'knockout', 'vertical', 'quote', 'ring', 'object', 'panorama', 'ma', 'substitute', 'hanzi', 'anomaly', 'calendar', 'window'];
export const V2_COMPS: V2Comp[] = ['typo', 'edge', 'ghost', 'bento', 'veil', 'mosaic', 'inset'];
export const COMPS: Comp[] = ['split', 'checker', 'fullbleed', 'giant', 'partition', 'cards', 'fan', 'typefill', 'swiss', 'centered', 'layered', 'bands', ...V2_COMPS, ...V3_COMPS, ...V8_COMPS];

export interface Style {
  id: string;
  name: { zh: string; en: string };
  lib: 'zh' | 'en';
  fonts: FontSet;
  params: Partial<Params>;
  comp?: Partial<Record<Comp, number>>;
  modes?: ModeKey[];
  textSet?: string;
  builtIn?: boolean;
  /** phase 11: brush / calligraphy and old-style hanzi looks are rare opt-in: never drawn at random (pick them by hand) */
  optIn?: boolean;
  modified?: boolean;
}

const up = { case: 'upper' as const };
const S = (id: string, zh: string, en: string, lib: 'zh' | 'en', fonts: FontRecipe, params: Partial<Params> = {}, comp?: Partial<Record<Comp, number>>, modes?: ModeKey[]): Style =>
  ({ id, name: { zh, en }, lib, fonts: expandRecipe(fonts), params: Object.fromEntries(Object.entries({ englishBias: lib === 'en' ? 85 : 35, ...params }).filter(([k]) => !REMOVED.includes(k))), comp, modes, builtIn: true });
/** params removed in phase 13 (never read by the engine) are dropped from the recipes */
const REMOVED = ['whitespace', 'symmetry', 'bigGroups', 'groupGap', 'accentUse', 'sliceCount', 'bandKind'];

// English-leaning library
const EN: Style[] = [
  S('neue-grid', '新网格', 'Neue Grid', 'en', { display: ['Inter Tight', 800, { tracking: -0.035 }], text: ['Inter', 400], caption: ['IBM Plex Mono', 400], zhDisplay: ['Noto Sans SC', 800], zhText: ['Noto Sans SC', 400] }, { bgPref: 'light' }, { swiss: 3, split: 3, checker: 2 }),
  S('didone-salon', '迪多沙龙', 'Didone Salon', 'en', { display: ['Bodoni Moda', 500, { tracking: -0.02 }], text: ['Bodoni Moda', 400], caption: ['Jost', 400, up], zhDisplay: ['Noto Serif SC', 600], zhText: ['Noto Serif SC', 400] }, { titleScale: 110 }, { centered: 3, fullbleed: 2, split: 2 }),
  S('poster-gothic', '海报哥特', 'Poster Gothic', 'en', { display: ['Anton', 400, { ...up, tracking: 0.0, leading: 0.9 }], text: ['Archivo', 500], caption: ['Space Mono', 400], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 500] }, { titleScale: 120, colorMode: 'experimental' }, { giant: 5, partition: 2, typefill: 2 }, ['card']),
  S('grotesk-black', '粗怪诞', 'Grotesk Black', 'en', { display: ['Archivo Black', 400, { tracking: -0.03 }], text: ['Archivo', 400], caption: ['Archivo Narrow', 500, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 400] }, {}, { split: 3, checker: 3, bands: 2 }),
  S('mono-lab', '等宽实验室', 'Mono Lab', 'en', { display: ['Space Mono', 700, { tracking: -0.04 }], text: ['IBM Plex Mono', 400], caption: ['JetBrains Mono', 400, up], zhDisplay: ['Noto Sans SC', 700], zhText: ['Noto Sans SC', 400] }, { gridOpacity: 100, zoneNumbers: true }, { swiss: 5, split: 2 }),
  S('garamond-quiet', '静默加拉蒙', 'Garamond Quiet', 'en', { display: ['EB Garamond', 400, { tracking: -0.015 }], text: ['EB Garamond', 400, { italic: true }], caption: ['Inter', 400, up], zhDisplay: ['Noto Serif SC', 500], zhText: ['Noto Serif SC', 400] }, { whitespace: 75, titleScale: 90, texture: 'paper' }, { centered: 4, split: 2, swiss: 1 }),
  S('condensed-signal', '窄体信号', 'Condensed Signal', 'en', { display: ['Bebas Neue', 400, { ...up, leading: 0.88, tracking: 0.01 }], text: ['Barlow', 500], caption: ['Barlow Condensed', 500, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 500] }, { titleScale: 115 }, { giant: 3, checker: 2, bands: 2, partition: 2 }),
  S('geo-bauhaus', '包豪斯几何', 'Geo Bauhaus', 'en', { display: ['Jost', 700, { tracking: -0.02 }], text: ['Jost', 400], caption: ['Jost', 500, up], zhDisplay: ['Noto Sans SC', 700], zhText: ['Noto Sans SC', 400] }, { shapeCount: 3, colorMode: 'experimental' }, { fan: 3, swiss: 2, partition: 2 }),
  S('soft-serif', '柔软衬线', 'Soft Serif', 'en', { display: ['Fraunces', 600, { tracking: -0.02 }], text: ['Work Sans', 400], caption: ['DM Mono', 400], zhDisplay: ['Noto Serif SC', 700], zhText: ['Noto Sans SC', 400] }, { bgPref: 'color' }, { split: 3, cards: 2, centered: 1 }),
  S('editorial-play', '编辑部', 'Editorial', 'en', { display: ['Playfair Display', 700, { tracking: -0.02 }], text: ['Source Serif 4', 400], caption: ['Inter', 500, up], zhDisplay: ['Noto Serif SC', 800], zhText: ['Noto Serif SC', 400] }, {}, { split: 3, fullbleed: 2, centered: 2, bands: 2 }),
  S('tower-caps', '高塔窄字', 'Tower Caps', 'en', { display: ['Six Caps', 400, { ...up, leading: 0.86, tracking: 0.01 }], text: ['Inter', 500], caption: ['Inter', 400, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 400] }, { titleScale: 140 }, { giant: 4, typefill: 3, fullbleed: 2 }),
  S('gallery-syne', '画廊', 'Gallery Syne', 'en', { display: ['Syne', 800, { tracking: -0.03 }], text: ['Syne', 400], caption: ['Space Grotesk', 400, up], zhDisplay: ['Noto Sans SC', 800], zhText: ['Noto Sans SC', 400] }, { colorMode: 'random' }, { split: 2, checker: 2, cards: 2, fan: 1 }),
  S('instrument', '器乐衬线', 'Instrument', 'en', { display: ['Instrument Serif', 400, { tracking: -0.02, leading: 0.95 }], text: ['Instrument Sans', 400], caption: ['Geist Mono', 400, up], zhDisplay: ['Noto Serif SC', 500], zhText: ['Noto Sans SC', 400] }, { titleScale: 115 }, { fullbleed: 3, split: 3, layered: 2 }),
  S('stone-roman', '罗马石刻', 'Stone Roman', 'en', { display: ['Cinzel', 600, { tracking: 0.06, ...up }], text: ['Cormorant Garamond', 500], caption: ['Cinzel', 500, { ...up, tracking: 0.18 }], zhDisplay: ['Noto Serif SC', 900], zhText: ['Noto Serif SC', 400] }, { texture: 'paper', textureAmount: 25 }, { centered: 4, fullbleed: 2 }),
  S('wide-future', '宽体未来', 'Wide Future', 'en', { display: ['Unbounded', 800, { tracking: -0.03 }], text: ['Manrope', 500], caption: ['Geist Mono', 400, up], zhDisplay: ['Smiley Sans', 400], zhText: ['Noto Sans SC', 400] }, { colorMode: 'experimental', titleScale: 90 }, { partition: 2, giant: 2, cards: 2 }),
  S('typewriter-memo', '打字机备忘', 'Typewriter Memo', 'en', { display: ['Fragment Mono', 400, { tracking: -0.04 }], text: ['Fragment Mono', 400], caption: ['DM Mono', 400], zhDisplay: ['Chiron Hei HK', 500], zhText: ['Chiron Hei HK', 400] }, { texture: 'paper', textureAmount: 30, bgPref: 'light', soft: true }, { swiss: 3, centered: 2, split: 2 }),
  S('pixel-retro', '复古像素', 'Pixel Retro', 'en', { display: ['Terminal Grotesque', 400, { leading: 0.9 }], text: ['Space Mono', 400], caption: ['Space Mono', 400, up], zhDisplay: ['ZCOOL QingKe HuangYou', 400], zhText: ['Noto Sans SC', 400] }, { colorMode: 'random', texture: 'riso' }, { checker: 3, bands: 2, giant: 2 }),
  S('newsprint', '新闻纸', 'Newsprint', 'en', { display: ['Newsreader', 700, { tracking: -0.025 }], text: ['Newsreader', 400], caption: ['Libre Franklin', 500, up], zhDisplay: ['Noto Serif SC', 900], zhText: ['Noto Serif SC', 400] }, { bgPref: 'light', texture: 'paper', textureAmount: 22, sidebarTpl: 'data' }, { split: 3, bands: 3, centered: 1 }),
  S('caslon-book', '卡斯隆书房', 'Caslon Book', 'en', { display: ['Libre Caslon Display', 400], text: ['Libre Caslon Text', 400, { italic: true }], caption: ['Libre Franklin', 400, up], zhDisplay: ['Noto Serif SC', 600], zhText: ['Noto Serif SC', 400] }, { whitespace: 65 }, { centered: 3, split: 2, fullbleed: 2 }),
  S('floral-script', '花体手记', 'Floral Script', 'en', { display: ['DM Serif Display', 400], text: ['Dancing Script', 500], caption: ['Jost', 400, up], zhDisplay: ['Noto Serif SC', 600], zhText: ['LXGW WenKai', 400] }, { soft: true }, { cards: 3, split: 2, fan: 2 }),
  S('industrial', '工业', 'Industrial', 'en', { display: ['Oswald', 700, { ...up, leading: 0.92 }], text: ['Roboto Mono', 400], caption: ['Oswald', 400, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 500] }, { zoneNumbers: true, gridOpacity: 100 }, { checker: 3, partition: 3, giant: 1 }),
  S('big-shoulders', '宽肩', 'Big Shoulders', 'en', { display: ['Big Shoulders Display', 900, { ...up, leading: 0.88 }], text: ['Hanken Grotesk', 400], caption: ['Hanken Grotesk', 600, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 400] }, { titleScale: 120 }, { giant: 3, typefill: 3, bands: 2 }),
  S('sporting', '运动怪诞', 'Sporting', 'en', { display: ['Sporting Grotesque', 700, { tracking: -0.02 }], text: ['Karla', 400], caption: ['Karla', 600, up], zhDisplay: ['Smiley Sans', 400], zhText: ['Noto Sans SC', 400] }, { colorMode: 'experimental' }, { partition: 3, split: 2, checker: 2 }),
  S('fashion-gloock', '时装', 'Fashion', 'en', { display: ['Gloock', 400, { tracking: -0.02 }], text: ['Albert Sans', 300], caption: ['Albert Sans', 500, { ...up, tracking: 0.14 }], zhDisplay: ['Noto Serif SC', 700], zhText: ['Noto Sans SC', 300] }, { titleScale: 120 }, { fullbleed: 3, layered: 3, split: 2 }),
  S('warm-serif', '暖衬线', 'Warm Serif', 'en', { display: ['Young Serif', 400, { tracking: -0.02 }], text: ['Figtree', 400], caption: ['Figtree', 600, up], zhDisplay: ['Noto Serif SC', 700], zhText: ['Noto Sans SC', 400] }, { bgPref: 'color', soft: true }, { cards: 3, split: 3 }),
  S('readable', '清晰易读', 'Readable', 'en', { display: ['Lexend', 600, { tracking: -0.03 }], text: ['Lexend', 300], caption: ['Lexend', 500, up], zhDisplay: ['Noto Sans SC', 700], zhText: ['Noto Sans SC', 300] }, {}, { split: 3, bands: 2, cards: 2 }),
  S('avant', '前卫', 'Avant', 'en', { display: ['Basteleur Moonlight', 400, { leading: 0.95 }], text: ['Space Grotesk', 400], caption: ['Space Mono', 400, up], zhDisplay: ['Chiron Sung HK', 700], zhText: ['Noto Serif SC', 400] }, { colorMode: 'experimental', texture: 'riso' }, { typefill: 2, partition: 2, fan: 2, swiss: 2 }),
  S('spartan', '斯巴达', 'Spartan', 'en', { display: ['League Spartan', 800, { tracking: -0.03 }], text: ['Public Sans', 400], caption: ['Public Sans', 600, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 400] }, {}, { split: 2, checker: 2, giant: 2, bands: 2 }),
  S('fat-face', '肥脸海报', 'Fat Face', 'en', { display: ['Abril Fatface', 400, { tracking: -0.01 }], text: ['Karla', 400], caption: ['Karla', 700, up], zhDisplay: ['Noto Serif SC', 900], zhText: ['Noto Sans SC', 400] }, { bgPref: 'color' }, { giant: 2, split: 2, cards: 2, centered: 2 }),
  S('plex-corporate', '企业规范', 'Corporate', 'en', { display: ['IBM Plex Sans', 600, { tracking: -0.02 }], text: ['IBM Plex Sans', 400], caption: ['IBM Plex Mono', 400, up], zhDisplay: ['Noto Sans SC', 700], zhText: ['Noto Sans SC', 400] }, { bgPref: 'light' }, { swiss: 3, split: 3, bands: 2 }),
  S('outline-wide', '镂空', 'Outline Wide', 'en', { display: ['Archivo', 900, { ...up, tracking: -0.02 }], text: ['Archivo', 400], caption: ['Archivo', 600, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 400] }, { colorMode: 'experimental' }, { typefill: 4, giant: 2 }),
  S('quiet-geo', '安静几何', 'Quiet Geometry', 'en', { display: ['Montserrat', 300, { tracking: -0.02 }], text: ['Montserrat', 400], caption: ['Montserrat', 500, up], zhDisplay: ['Noto Sans SC', 300], zhText: ['Noto Sans SC', 300] }, { whitespace: 80, titleScale: 85 }, { swiss: 3, centered: 3, fan: 1 }),
];

// Chinese-leaning library
const ZH: Style[] = [
  // phase 11: modern Song / Hei (Chiron Sung HK, Chiron Hei HK: OFL-1.1)
  S('zh-modern-song', '现代宋', 'Modern Song', 'zh', { display: ['Newsreader', 600], text: ['Inter', 400], caption: ['Inter', 500, up], zhDisplay: ['Chiron Sung HK', 700, { tracking: 0.02 }], zhText: ['Chiron Hei HK', 400] }, { bgPref: 'light' }, { swiss: 3, split: 2, edge: 2 }),
  S('zh-modern-hei', '现代黑', 'Modern Hei', 'zh', { display: ['Inter Tight', 800, { tracking: -0.03 }], text: ['Inter', 400], caption: ['IBM Plex Mono', 400], zhDisplay: ['Chiron Hei HK', 800, { tracking: 0.0 }], zhText: ['Chiron Hei HK', 400] }, {}, { swiss: 3, checker: 2, cover: 2 }),
  S('zh-cold-hei', '冷峻黑体', 'Cold Hei', 'zh', { display: ['Inter Tight', 800], text: ['Inter', 400], caption: ['Inter', 500, up], zhDisplay: ['Noto Sans SC', 900, { tracking: 0.0 }], zhText: ['Noto Sans SC', 400] }, {}, { split: 3, swiss: 2, checker: 2 }),
  S('zh-song-edit', '宋韵编辑', 'Song Editorial', 'zh', { display: ['EB Garamond', 500], text: ['EB Garamond', 400], caption: ['Inter', 400, up], zhDisplay: ['Noto Serif SC', 700], zhText: ['Noto Serif SC', 400] }, { texture: 'paper' }, { centered: 3, split: 3, fullbleed: 1 }),
  S('zh-thin-air', '极细呼吸', 'Thin Air', 'zh', { display: ['Inter', 200], text: ['Inter', 300], caption: ['Inter', 400, up], zhDisplay: ['Noto Sans SC', 200, { tracking: 0.08 }], zhText: ['Noto Sans SC', 300] }, { whitespace: 85, titleScale: 85, bgPref: 'light' }, { swiss: 3, centered: 3, split: 1 }),
  S('zh-wenkai-note', '文楷手札', 'Wenkai Notes', 'zh', { display: ['Cormorant Garamond', 500], text: ['Cormorant Garamond', 400, { italic: true }], caption: ['Jost', 400, up], zhDisplay: ['LXGW WenKai', 500], zhText: ['LXGW WenKai', 400] }, { soft: true, texture: 'paper', textureAmount: 26 }, { centered: 3, cards: 2, split: 2 }),
  S('zh-smiley', '得意斜体', 'Smiley Oblique', 'zh', { display: ['Space Grotesk', 700], text: ['Space Grotesk', 400], caption: ['Space Mono', 400, up], zhDisplay: ['Smiley Sans', 400], zhText: ['Noto Sans SC', 400] }, { colorMode: 'experimental' }, { giant: 3, partition: 2, split: 2 }),
  S('zh-brush-title', '毛笔题字', 'Brush Title', 'zh', { display: ['Cormorant', 600], text: ['Cormorant Garamond', 400], caption: ['Inter', 400, up], zhDisplay: ['Ma Shan Zheng', 400, { tracking: 0 }], zhText: ['Noto Serif SC', 400] }, { textSet: 'nature' }, { fullbleed: 3, centered: 2, split: 2 }, ['brushImage']),
  S('zh-cursive-air', '草书留白', 'Cursive Air', 'zh', { display: ['EB Garamond', 400], text: ['EB Garamond', 400], caption: ['Inter', 300, up], zhDisplay: ['Zhi Mang Xing', 400], zhText: ['LXGW WenKai', 400] }, { whitespace: 80 }, { centered: 3, fullbleed: 2, layered: 1 }),
  S('zh-xiaowei', '小薇刊物', 'Xiaowei Journal', 'zh', { display: ['Playfair Display', 600], text: ['Source Serif 4', 400], caption: ['Inter', 500, up], zhDisplay: ['ZCOOL XiaoWei', 400], zhText: ['Noto Serif SC', 400] }, {}, { split: 3, bands: 2, cards: 2 }),
  S('zh-huangyou', '黄油标题', 'Butter Title', 'zh', { display: ['Archivo Black', 400], text: ['Archivo', 400], caption: ['Archivo Narrow', 500, up], zhDisplay: ['ZCOOL QingKe HuangYou', 400], zhText: ['Noto Sans SC', 400] }, { colorMode: 'random' }, { giant: 3, checker: 2, partition: 2 }),
  S('zh-kuaile', '快乐圆体', 'Happy Round', 'zh', { display: ['Varela Round', 400], text: ['Quicksand', 500], caption: ['Quicksand', 600, up], zhDisplay: ['ZCOOL KuaiLe', 400], zhText: ['Noto Sans SC', 400] }, { bgPref: 'color', cornerRadius: 40 }, { cards: 4, fan: 2, split: 2 }, ['card']),
  S('zh-heavy-song', '重宋海报', 'Heavy Song', 'zh', { display: ['Bodoni Moda', 800], text: ['Bodoni Moda', 400], caption: ['Inter', 500, up], zhDisplay: ['Source Han Serif CN', 900], zhText: ['Source Han Serif CN', 400] }, { titleScale: 120 }, { giant: 3, split: 2, centered: 2 }),
  S('zh-heavy-hei', '重黑海报', 'Heavy Hei', 'zh', { display: ['Inter Tight', 900], text: ['Inter Tight', 400], caption: ['Inter', 500, up], zhDisplay: ['Source Han Sans CN', 900], zhText: ['Source Han Sans CN', 300] }, { titleScale: 120 }, { giant: 3, partition: 2, typefill: 2 }),
  S('zh-longcang', '龙藏行书', 'Running Script', 'zh', { display: ['Cormorant Garamond', 600], text: ['Cormorant Garamond', 400], caption: ['Inter', 300, up], zhDisplay: ['Long Cang', 400], zhText: ['LXGW WenKai', 400] }, { soft: true }, { fullbleed: 2, centered: 2, cards: 1, fan: 1 }),
  S('zh-wild-grass', '狂草', 'Wild Grass', 'zh', { display: ['Cinzel', 600], text: ['Cormorant Garamond', 400], caption: ['Cinzel', 400, up], zhDisplay: ['Liu Jian Mao Cao', 400], zhText: ['Noto Serif SC', 400] }, { colorMode: 'experimental' }, { fullbleed: 2, layered: 2, giant: 2 }, ['brushMask']),
  S('zh-song-minimal', '宋骨极简', 'Song Minimal', 'zh', { display: ['Jost', 300], text: ['Jost', 300], caption: ['Jost', 400, up], zhDisplay: ['Noto Serif SC', 300, { tracking: 0.1 }], zhText: ['Noto Sans SC', 300] }, { whitespace: 80, titleScale: 80, bgPref: 'light' }, { swiss: 3, centered: 3 }),
  S('zh-new-chinese', '新中式', 'New Chinese', 'zh', { display: ['Cinzel', 500], text: ['Cormorant Garamond', 500], caption: ['Cinzel', 400, up], zhDisplay: ['Noto Serif SC', 600, { tracking: 0.12 }], zhText: ['LXGW WenKai', 400] }, { textSet: 'tea', texture: 'paper' }, { centered: 3, fan: 2, split: 2 }),
  S('zh-hk-mag', '港风杂志', 'HK Magazine', 'zh', { display: ['Bodoni Moda', 700, { italic: true }], text: ['Noto Serif', 400], caption: ['Inter', 500, up], zhDisplay: ['Noto Sans SC', 800], zhText: ['Noto Serif SC', 400] }, { colorMode: 'experimental' }, { fullbleed: 3, split: 2, bands: 2 }),
  S('zh-mono-modern', '等宽现代', 'Mono Modern', 'zh', { display: ['JetBrains Mono', 700], text: ['JetBrains Mono', 400], caption: ['JetBrains Mono', 400, up], zhDisplay: ['Noto Sans SC', 600], zhText: ['Noto Sans SC', 400] }, { zoneNumbers: true }, { swiss: 4, checker: 2 }),
  S('zh-old-paper', '老报纸', 'Old Newspaper', 'zh', { display: ['Newsreader', 800], text: ['Newsreader', 400], caption: ['Libre Franklin', 500, up], zhDisplay: ['Noto Serif SC', 900], zhText: ['Noto Serif SC', 400] }, { texture: 'paper', textureAmount: 32, soft: true, sidebarTpl: 'data' }, { bands: 3, split: 3 }),
  S('zh-mincho', '明朝体', 'Mincho', 'zh', { display: ['Cormorant', 500], text: ['Cormorant', 400], caption: ['Inter', 400, up], zhDisplay: ['Noto Serif SC', 500, { tracking: 0.06 }], zhText: ['Noto Serif SC', 300] }, { whitespace: 70 }, { centered: 2, split: 2, fullbleed: 2, layered: 1 }),
  S('zh-tea-journal', '茶饮手账', 'Tea Journal', 'zh', { display: ['Fraunces', 500], text: ['Caveat', 500], caption: ['DM Mono', 400], zhDisplay: ['Chiron Sung HK', 600], zhText: ['Chiron Hei HK', 400] }, { textSet: 'tea', soft: true, bgPref: 'color' }, { cards: 3, split: 2 }),
  S('zh-future', '未来概念', 'Future Concept', 'zh', { display: ['Unbounded', 700], text: ['Manrope', 300], caption: ['Geist Mono', 400, up], zhDisplay: ['Smiley Sans', 400], zhText: ['Noto Sans SC', 200] }, { colorMode: 'experimental', textSet: 'space' }, { fan: 2, giant: 2, fullbleed: 2 }),
  S('zh-stone', '石刻宣言', 'Stone Manifesto', 'zh', { display: ['Cinzel', 800, up], text: ['Cormorant Garamond', 500], caption: ['Cinzel', 500, up], zhDisplay: ['Noto Serif SC', 900, { tracking: 0.2 }], zhText: ['Noto Serif SC', 500] }, { texture: 'riso', textureAmount: 20 }, { centered: 3, giant: 2 }),
  S('zh-round-geo', '圆润几何', 'Round Geometry', 'zh', { display: ['Quicksand', 700], text: ['Quicksand', 500], caption: ['Quicksand', 600, up], zhDisplay: ['Noto Sans SC', 700], zhText: ['Noto Sans SC', 400] }, { cornerRadius: 50 }, { cards: 3, fan: 3 }, ['card']),
  S('zh-retro-print', '复古印刷', 'Retro Print', 'zh', { display: ['Ultra', 400], text: ['Brygada 1918', 400], caption: ['Brygada 1918', 500, up], zhDisplay: ['Noto Serif SC', 800], zhText: ['Noto Serif SC', 400] }, { texture: 'halftone', textureAmount: 12, soft: true }, { split: 2, bands: 2, partition: 2 }),
  S('zh-colossal', '庞然大字', 'Colossal', 'zh', { display: ['Anton', 400, up], text: ['Inter', 500], caption: ['Inter', 500, up], zhDisplay: ['Noto Sans SC', 900, { tracking: -0.02 }], zhText: ['Noto Sans SC', 500] }, { titleScale: 150, glyphSize: 130 }, { giant: 5, typefill: 2 }),
  S('zh-bilingual', '读写对照', 'Bilingual', 'zh', { display: ['Source Serif 4', 600], text: ['Source Serif 4', 400], caption: ['Inter', 400, up], zhDisplay: ['Noto Serif SC', 600], zhText: ['Noto Sans SC', 400] }, { englishBias: 50 }, { split: 3, centered: 2, bands: 2 }),
  S('zh-clash', '撞色分区', 'Color Clash', 'zh', { display: ['Archivo', 800], text: ['Archivo', 400], caption: ['Archivo Narrow', 500, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 400] }, { colorMode: 'experimental' }, { partition: 5, checker: 2 }, ['clash']),
  S('zh-layer', '人物分层', 'Subject Layer', 'zh', { display: ['Anton', 400, up], text: ['Inter', 400], caption: ['Inter', 500, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 400] }, { titleScale: 140 }, { layered: 6, fullbleed: 1 }, ['layered']),
  S('zh-torn', '撕纸拼贴', 'Torn Collage', 'zh', { display: ['Montserrat', 500], text: ['Montserrat', 400], caption: ['Barlow Condensed', 500, up], zhDisplay: ['Noto Sans SC', 800, { tracking: 0.25 }], zhText: ['Noto Sans SC', 400] }, { maskKind: 'torn', colorMode: 'experimental' }, { partition: 5, split: 2 }, ['clash']),
];

/** phase 11: brush / calligraphy and old-style display hanzi (the user found them old-fashioned): kept, but only by hand */
export const OPT_IN_STYLES = new Set(['zh-brush-title', 'zh-cursive-air', 'zh-longcang', 'zh-wild-grass', 'zh-wenkai-note', 'zh-xiaowei']);
for (const st of [...ZH, ...EN]) if (OPT_IN_STYLES.has(st.id)) st.optIn = true;
export const BUILTIN_STYLES: Style[] = [...ZH, ...EN];
/** the styles a random draw may use (rate page, lab, CLI random style) */
export const RANDOM_STYLES: Style[] = BUILTIN_STYLES.filter((st) => !st.optIn);
