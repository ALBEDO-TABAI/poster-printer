import type { Scene } from '../engine/types';
import { renderSVG } from '../engine/render/svg';
import { fontFaceCss } from './fonts';

const dataCache = new Map<string, string>();
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  if (dataCache.has(url)) return dataCache.get(url)!;
  const blob = await (await fetch(url)).blob();
  const d = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob); });
  dataCache.set(url, d);
  return d;
}

function collect(scene: Scene) {
  const fams = new Set<string>(), srcs = new Set<string>();
  const walk = (ns: Scene['nodes']) => ns.forEach((n) => {
    if (n.kind === 'text') { fams.add(n.family); if (n.fallback) fams.add(n.fallback); }
    if (n.kind === 'image') srcs.add(n.src);
    if (n.clip?.type === 'text') fams.add(n.clip.family);
    if (n.kind === 'group') walk(n.children);
  });
  walk(scene.nodes);
  fams.add('Noto Sans SC');
  return { fams: [...fams], srcs: [...srcs] };
}

/** Self-contained SVG: live text + embedded fonts (optional) + embedded images. */
export async function exportSVG(scene: Scene, embedFonts = true, scale = 1): Promise<string> {
  const { fams, srcs } = collect(scene);
  const map = new Map<string, string>();
  await Promise.all(srcs.map(async (s) => map.set(s, await toDataUrl(s))));
  const fontCss = embedFonts ? await fontFaceCss(fams) : '';
  return renderSVG(scene, { fontCss, resolve: (s) => map.get(s) ?? s, scale });
}

export async function rasterizeSVG(svg: string, w: number, h: number, scale = 2, type = 'image/png', quality = 0.92): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('SVG rasterize failed')); img.src = url; });
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
    const g = cv.getContext('2d')!;
    if (type === 'image/jpeg') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); }
    // let embedded fonts settle (Chrome decodes @font-face in SVG images lazily)
    await new Promise((r) => setTimeout(r, 60));
    g.drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise<Blob>((res) => cv.toBlob((b) => res(b!), type, quality));
  } finally { URL.revokeObjectURL(url); }
}

export async function rasterize(scene: Scene, scale = 2, type = 'image/png', quality = 0.92): Promise<Blob> {
  const svg = await exportSVG(scene, true, 1);
  return rasterizeSVG(svg, scene.w, scene.h, scale, type, quality);
}

export function download(blob: Blob | string, name: string) {
  const b = typeof blob === 'string' ? new Blob([blob], { type: name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.css') ? 'text/css' : 'application/json' }) : blob;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
