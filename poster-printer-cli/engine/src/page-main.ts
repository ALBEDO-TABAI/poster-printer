// Browser side of the chromium backend: the app's own measurer, font loader and exporter, driven by the CLI.
import { canvasMeasurer } from '@rea/engine/text/measure';
import { loadFontManifest, ensureFontSet, fontFaceCss } from '@rea/lib/fonts';
import { loadImages, loadPalettes } from '@rea/lib/assets';
import { exportSVG, rasterizeSVG } from '@rea/lib/exporter';
import { renderSVG } from '@rea/engine/render/svg';
import type { Scene } from '@rea/engine/types';
import type { ImageAsset } from '@rea/engine/gen/ctx';
import { runOp } from './ops';
import type { Env } from './core';

interface ExtraFont { family: string; url: string; weight: string; style: string; unicodeRange: string }
let env: Env | null = null;
let extras: ExtraFont[] = [];
const extraCss: string[] = [];

const blobToB64 = (b: Blob) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(b); });
const toDataUrl = async (url: string) => (url.startsWith('data:') ? url : `data:${(await fetch(url)).headers.get('content-type') ?? 'application/octet-stream'};base64,${await blobToB64(await (await fetch(url)).blob())}`);

async function svgWithExtras(scene: Scene, embedFonts: boolean): Promise<string> {
  if (!extras.length) return exportSVG(scene, embedFonts);
  // same as lib/exporter exportSVG, plus the on-demand glyph subsets (unicode-range faces of the same family)
  const fams = new Set<string>(['Noto Sans SC']); const srcs = new Set<string>();
  const walk = (ns: Scene['nodes']) => ns.forEach((n) => { if (n.kind === 'text') { fams.add(n.family); if (n.fallback) fams.add(n.fallback); } if (n.kind === 'image') srcs.add(n.src); if (n.clip?.type === 'text') fams.add(n.clip.family); if (n.kind === 'group') walk(n.children); });
  walk(scene.nodes);
  const map = new Map<string, string>(); await Promise.all([...srcs].map(async (s) => map.set(s, await toDataUrl(s))));
  let css = embedFonts ? await fontFaceCss([...fams]) : '';
  for (const x of extras) if (fams.has(x.family)) css += extraCss[extras.indexOf(x)];
  return renderSVG(scene, { fontCss: css, resolve: (s) => map.get(s) ?? s });
}

async function init(cfg: { userImages: ImageAsset[]; extraFonts: ExtraFont[] }) {
  await loadFontManifest();
  const [presetImages, palettes] = await Promise.all([loadImages(), loadPalettes()]);
  extras = cfg.extraFonts ?? [];
  for (const x of extras) {
    const ff = new FontFace(x.family, `url(${x.url}) format("woff2")`, { weight: x.weight, style: x.style, unicodeRange: x.unicodeRange, display: 'block' });
    document.fonts.add(ff); await ff.load();
    extraCss.push(`@font-face{font-family:"${x.family}";src:url(${await toDataUrl(x.url)}) format("woff2");font-weight:${x.weight};font-style:${x.style};unicode-range:${x.unicodeRange};}`);
  }
  env = {
    backend: 'chromium', measure: canvasMeasurer(), presetImages, userImages: cfg.userImages ?? [], palettes,
    ensureFonts: async (fs) => { await ensureFontSet(fs); },
    svg: svgWithExtras,
    raster: async (scene, scale, type) => {
      const svg = await svgWithExtras(scene, true);
      return blobToB64(await rasterizeSVG(svg, scene.w, scene.h, scale, type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92));
    },
    pixels: async (scene) => {
      const blob = await rasterizeSVG(await svgWithExtras(scene, true), scene.w, scene.h, 1, 'image/png', 1);
      const bmp = await createImageBitmap(blob);
      const cv = new OffscreenCanvas(bmp.width, bmp.height); const cx = cv.getContext('2d')!; cx.drawImage(bmp, 0, 0);
      return { w: bmp.width, h: bmp.height, data: cx.getImageData(0, 0, bmp.width, bmp.height).data };
    },
  };
  return { images: presetImages.length, palettes: palettes.length, extraFonts: extras.length };
}

async function run(op: string, payload: unknown) {
  if (!env) throw new Error('page not initialised');
  return runOp(env, op, payload);
}
(window as unknown as { __pp: unknown }).__pp = { init, run, ready: true };
