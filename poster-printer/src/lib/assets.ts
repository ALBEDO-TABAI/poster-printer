import type { ImageAsset } from '../engine/gen/ctx';
import type { LibPalette } from '../engine/color/palette';

let images: ImageAsset[] | null = null;
let palettes: LibPalette[] | null = null;
export async function loadImages(): Promise<ImageAsset[]> {
  if (!images) { try { images = await (await fetch('/images/manifest.json')).json(); } catch { images = []; } }
  return images!;
}
export async function loadPalettes(): Promise<LibPalette[]> {
  if (!palettes) palettes = await (await fetch('/data/palettes.json')).json();
  return palettes!;
}
export const IMAGE_CATEGORIES: { id: string; zh: string; en: string }[] = [
  { id: 'all', zh: '全部', en: 'All' }, { id: 'nature', zh: '自然', en: 'Nature' }, { id: 'architecture', zh: '建筑空间', en: 'Architecture' }, { id: 'still', zh: '静物', en: 'Still life' }, { id: 'city', zh: '城市', en: 'City' }, { id: 'illustration', zh: '插画', en: 'Illustration' }, { id: 'east', zh: '东方', en: 'Eastern' }, { id: 'landscape', zh: '风景', en: 'Landscape' }, { id: 'figure', zh: '人物', en: 'Figures' },
  { id: 'flora', zh: '花植', en: 'Flora' }, { id: 'abstract', zh: '抽象', en: 'Abstract' }, { id: 'space', zh: '宇宙', en: 'Space' }, { id: 'street', zh: '街景', en: 'Street' }, { id: 'object', zh: '器物', en: 'Objects' }, { id: 'mine', zh: '我的', en: 'Mine' },
];
