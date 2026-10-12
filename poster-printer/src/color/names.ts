// Original poetic names, descriptive colour names and tags for palette cards (deterministic per palette id).
import { Rng } from '../engine/rng';
import { hexToLch } from '../engine/color/convert';
import type { LibPalette } from '../engine/color/palette';

const A = ['窗台', '雨后', '旧书', '茶汤', '山径', '码头', '晚风', '纸灯', '苔痕', '河岸', '瓷盘', '木梯', '晨雾', '邮筒', '花架', '暮色', '石阶', '月台', '沙丘', '果园', '阁楼', '渡口', '灯塔', '书桌', '布帘', '陶罐', '松林', '湖心', '巷口', '屋檐', '信纸', '橘皮', '麦田', '海盐', '铁轨', '剧场'];
const B = ['的一角', '慢慢变凉', '刚刚亮起', '还没干透', '落了点灰', '藏着夏天', '在等一个人', '有点咸', '半开着', '响了三声', '的余温', '的背面', '被风翻过', '留了一盏灯', '收起了伞', '起了薄雾', '慢了半拍', '照进来', '落在肩上', '安静下来'];
const EN_A = ['Window', 'Harbour', 'Orchard', 'Attic', 'Platform', 'Lantern', 'Moss', 'Teacup', 'Dune', 'Alley', 'Ledger', 'Studio', 'Shoreline', 'Kiln', 'Arcade', 'Meadow'];
const EN_B = ['at Dusk', 'After Rain', 'in Winter', 'Half Open', 'Still Warm', 'Before Noon', 'in Fog', 'Left Behind', 'Turned Over', 'at Low Tide'];
export const LABELS = ['TONE STUDY', 'SWATCH SHEET', 'CHROMA LOG', 'COLOUR FIELD', 'PIGMENT NOTE', 'HUE INDEX', 'PALETTE PROOF', 'COLOUR MEMO'];

const HUES: [number, string, string][] = [[20, '红', 'Red'], [50, '橙', 'Orange'], [85, '黄', 'Yellow'], [115, '黄绿', 'Lime'], [160, '绿', 'Green'], [200, '青', 'Teal'], [250, '蓝', 'Blue'], [290, '紫', 'Violet'], [335, '玫', 'Magenta'], [361, '红', 'Red']];
export function describe(hex: string): { zh: string; en: string } {
  const [L, C, H] = hexToLch(hex);
  if (C < 7) {
    if (L > 92) return { zh: '纸白', en: 'Paper White' };
    if (L < 16) return { zh: '墨黑', en: 'Ink Black' };
    return L > 60 ? { zh: '浅灰', en: 'Pale Grey' } : { zh: '深灰', en: 'Slate Grey' };
  }
  const h = HUES.find(([lim]) => H < lim)!;
  const tone = L > 80 ? ['浅', 'Pale '] : L < 35 ? ['深', 'Deep '] : C < 22 ? ['灰', 'Dusty '] : C > 55 ? ['亮', 'Vivid '] : ['', ''];
  return { zh: tone[0] + h[1], en: tone[1] + h[2] };
}

export interface CardMeta { title: string; titleEn: string; tags: string[]; tagsEn: string[]; label: string; idx: string }
export const LIGHT: Record<string, [string, string]> = { dark: ['暗调', 'Dark'], calm: ['沉静', 'Calm'], bright: ['明朗', 'Bright'], luminous: ['通亮', 'Luminous'] };
export const CHROMA: Record<string, [string, string]> = { soft: ['柔和', 'Soft'], mid: ['中调', 'Mid'], rich: ['浓郁', 'Rich'] };
export const CONTRAST: Record<string, [string, string]> = { gentle: ['平缓', 'Gentle'], clear: ['分明', 'Clear'], strong: ['强对比', 'Strong'] };
const SEASON = (h: number): [string, string] => (h < 60 || h > 330 ? ['秋天', 'Autumn'] : h < 140 ? ['春天', 'Spring'] : h < 230 ? ['夏天', 'Summer'] : ['冬天', 'Winter']);

export function metaFor(p: LibPalette, n: number, salt = ''): CardMeta {
  const r = new Rng('card|' + p.id + '|' + salt);
  const tags: string[] = [], tagsEn: string[] = [];
  for (const [m, k] of [[LIGHT, p.light], [CHROMA, p.chroma], [CONTRAST, p.contrast]] as const) { const v = (m as Record<string, [string, string]>)[k as string]; if (v) { tags.push(v[0]); tagsEn.push(v[1]); } }
  const s = SEASON(hexToLch(p.colors[0])[2]); tags.push(s[0]); tagsEn.push(s[1]);
  return { title: r.pick(A) + r.pick(B), titleEn: `${r.pick(EN_A)} ${r.pick(EN_B)}`, tags, tagsEn, label: r.pick(LABELS), idx: String(n).padStart(3, '0') };
}
export const MOOD: Record<string, [string, string]> = { vintage: ['复古', 'Vintage'], pop: ['波普', 'Pop'], pastel: ['粉彩', 'Pastel'], noir: ['暗黑', 'Noir'], muted: ['莫兰迪', 'Muted'] };
