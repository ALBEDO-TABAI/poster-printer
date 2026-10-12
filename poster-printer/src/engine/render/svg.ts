import type { Scene, SceneNode, Shape, ImageNode, TextNode, ImgFilter } from '../types';
import { hexToRgb } from '../color/convert';
import { COMPRESSIBLE_OPEN, COMPRESSIBLE_CLOSE } from '../text/breaker';

export interface RenderOpts {
  interactive?: boolean;
  fontCss?: string; // @font-face rules to embed
  resolve?: (src: string) => string; // map image src -> href (e.g. data URL)
  selected?: string | null;
  scale?: number; // output pixel scale (width/height attrs)
  hide?: Set<string>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => (Math.round(v * 100) / 100).toString();

let renderCount = 0;
class Defs {
  items: string[] = [];
  private k = 0;
  // unique per render so several inline SVGs in one document never share ids
  constructor(private pre = 'r' + (++renderCount).toString(36) + '_') {}
  private memo = new Map<string, string>();
  id(prefix: string) { return `${this.pre}${prefix}${++this.k}`; }
  add(key: string | null, make: (id: string) => string, prefix = 'd') {
    if (key && this.memo.has(key)) return this.memo.get(key)!;
    const id = this.id(prefix);
    this.items.push(make(id));
    if (key) this.memo.set(key, id);
    return id;
  }
}

function shapeInner(s: Shape): string {
  switch (s.type) {
    case 'rect': return `<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.w)}" height="${n(s.h)}"${s.rx ? ` rx="${n(s.rx)}"` : ''}/>`;
    case 'circle': return `<circle cx="${n(s.cx)}" cy="${n(s.cy)}" r="${n(s.r)}"/>`;
    case 'path': return `<path d="${s.d}"/>`;
    case 'union': return s.shapes.map(shapeInner).join('');
    case 'text': {
      const ls = (s.tracking || 0) * s.size;
      return `<text font-family="${esc(`"${s.family}", "Noto Sans SC", sans-serif`)}" font-size="${n(s.size)}" font-weight="${s.weight}"${ls ? ` letter-spacing="${n(ls)}"` : ''} text-anchor="${s.anchor || 'start'}">${s.lines.map((l) => `<tspan x="${n(l.x)}" y="${n(l.y)}">${esc(l.text)}</tspan>`).join('')}</text>`;
    }
  }
}

function clipAttr(defs: Defs, s?: Shape) {
  if (!s) return '';
  const id = defs.add(JSON.stringify(s), (id) => `<clipPath id="${id}">${shapeInner(s)}</clipPath>`, 'c');
  return ` clip-path="url(#${id})"`;
}

function filterAttr(defs: Defs, f?: ImgFilter) {
  if (!f) return '';
  const parts: string[] = [];
  if (f.blur) parts.push(`<feGaussianBlur stdDeviation="${n(f.blur)}"/>`);
  if (f.grayscale || f.duotone) parts.push(`<feColorMatrix type="matrix" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0"/>`);
  else if (f.sat !== undefined && Math.abs(f.sat - 1) > 0.01) parts.push(`<feColorMatrix type="saturate" values="${n(f.sat)}"/>`);
  const b = f.bright ?? 1, c = f.contrast ?? 1;
  if (Math.abs(b - 1) > 0.01 || Math.abs(c - 1) > 0.01) {
    const slope = b * c, ic = 0.5 - 0.5 * c;
    const fn = `type="linear" slope="${n(slope)}" intercept="${n(ic)}"`;
    parts.push(`<feComponentTransfer><feFuncR ${fn}/><feFuncG ${fn}/><feFuncB ${fn}/></feComponentTransfer>`);
  }
  if (f.invert) parts.push(`<feComponentTransfer><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/></feComponentTransfer>`);
  if (f.duotone) {
    const [d, l] = f.duotone.map(hexToRgb);
    const t = (i: number) => `type="table" tableValues="${n(d[i] / 255)} ${n(l[i] / 255)}"`;
    parts.push(`<feComponentTransfer><feFuncR ${t(0)}/><feFuncG ${t(1)}/><feFuncB ${t(2)}/></feComponentTransfer>`);
  }
  if (!parts.length) return '';
  const id = defs.add(JSON.stringify(f), (id) => `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">${parts.join('')}</filter>`, 'f');
  return ` filter="url(#${id})"`;
}

export function imageDrawRect(nd: Pick<ImageNode, 'x' | 'y' | 'w' | 'h' | 'iw' | 'ih' | 'fx' | 'fy' | 'zoom'>) {
  const s = Math.max(nd.w / nd.iw, nd.h / nd.ih) * (nd.zoom || 1);
  const dw = nd.iw * s, dh = nd.ih * s;
  return { x: nd.x + (nd.w - dw) * nd.fx, y: nd.y + (nd.h - dh) * nd.fy, w: dw, h: dh };
}

/** fill strings may be gradients: lg(angleDeg,c1,o1,c2,o2[,c3,o3]) */
function paint(defs: Defs, fill: string | undefined): string {
  if (!fill || !fill.startsWith('lg(')) return fill || 'none';
  const parts = fill.slice(3, -1).split(',');
  const ang = Number(parts[0]);
  const stops: string[] = [];
  const cnt = (parts.length - 1) / 2;
  for (let i = 0; i < cnt; i++) stops.push(`<stop offset="${n(cnt === 1 ? 0 : i / (cnt - 1))}" stop-color="${parts[1 + i * 2]}" stop-opacity="${parts[2 + i * 2]}"/>`);
  const a = (ang * Math.PI) / 180;
  const x1 = 0.5 - Math.cos(a) / 2, y1 = 0.5 - Math.sin(a) / 2, x2 = 0.5 + Math.cos(a) / 2, y2 = 0.5 + Math.sin(a) / 2;
  const id = defs.add(fill, (id) => `<linearGradient id="${id}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${stops.join('')}</linearGradient>`, 'g');
  return `url(#${id})`;
}

function common(nd: SceneNode, o: RenderOpts) {
  let a = '';
  if (nd.opacity !== undefined && nd.opacity < 1) a += ` opacity="${n(nd.opacity)}"`;
  if (nd.blend) a += ` style="mix-blend-mode:${nd.blend}"`;
  if (o.interactive) a += ` data-id="${nd.id}" data-layer="${nd.layer}"`;
  return a;
}

/** phase 12: an inline poster must not inherit the page's typography (the app shell sets UI stylistic sets
 *  cv11 / ss01 / ss03 on body, which swapped glyphs and widened lines vs. the measurer and the export by up to 20 %) */
export const SVG_TYPE_RESET = 'font-feature-settings:normal;font-variant:normal;font-variation-settings:normal;letter-spacing:normal;word-spacing:normal;text-transform:none;font-style:normal;font-kerning:auto;font-optical-sizing:auto;font-synthesis:weight style';

function renderText(t: TextNode, o: RenderOpts, defs: Defs) {
  const ls = t.tracking * t.size;
  const fam = esc(`"${t.family}"${t.fallback ? `, "${t.fallback}"` : ''}, "Noto Sans SC", sans-serif`);
  const shift = t.anchor === 'middle' ? ls / 2 : t.anchor === 'end' ? ls : 0;
  const rot = t.rotate ? ` transform="rotate(${n(t.rotate)} ${n(t.box.x)} ${n(t.box.y)})"` : '';
  const sel = o.interactive ? ` class="tx${o.selected === t.id ? ' sel' : ''}"` : '';
  const clip = clipAttr(defs, t.clip);
  return `<text${common(t, o)}${sel}${clip}${rot}${t.lines.some((l) => l.text.includes('  ')) ? ' xml:space="preserve"' : ''} font-family="${fam}" font-size="${n(t.size)}" font-weight="${Math.round(t.weight)}"${t.italic ? ' font-style="italic"' : ''}${ls ? ` letter-spacing="${n(ls)}"` : ''} fill="${t.fill}"${t.stroke ? ` stroke="${t.stroke}" stroke-width="${n(t.sw || 1)}" stroke-linejoin="round" paint-order="stroke"` : ''} text-anchor="${t.anchor}">${t.lines
    .map((l) => (t.lang === 'zh' || /[\u3000-\u303f\uff00-\uffef]/.test(l.text) ? cjkLine(l, t.size, shift, t.anchor) : `<tspan x="${n(l.x + shift)}" y="${n(l.y)}">${esc(l.text)}</tspan>`))
    .join('')}</text>`;
}

/**
 * CJK punctuation compression (标点挤压): two adjacent full-width marks (e.g. "。」" or "（「") would show a full em
 * of dead space, so the second one is pulled back by half an em. A line-start opening bracket is set half-width.
 */
export function cjkLine(l: { text: string; x: number; y: number }, size: number, shift: number, anchor: string): string {
  const ch = Array.from(l.text);
  const half = size * 0.5;
  let x = l.x + shift;
  if (anchor === 'start' && ch.length > 1 && COMPRESSIBLE_OPEN.has(ch[0])) x -= half;
  let out = '';
  let run = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i], p = ch[i - 1];
    const squeeze = i > 0 && ((COMPRESSIBLE_CLOSE.has(p) && (COMPRESSIBLE_CLOSE.has(c) || COMPRESSIBLE_OPEN.has(c))) || (COMPRESSIBLE_OPEN.has(p) && COMPRESSIBLE_OPEN.has(c)));
    if (squeeze) { out += esc(run); run = ''; out += `<tspan dx="${n(-half)}">${esc(c)}</tspan>`; }
    else run += c;
  }
  out += esc(run);
  return `<tspan x="${n(x)}" y="${n(l.y)}">${out}</tspan>`;
}

function renderNode(nd: SceneNode, o: RenderOpts, defs: Defs): string {
  if (o.hide?.has(nd.layer)) return '';
  switch (nd.kind) {
    case 'rect':
      return `<rect${common(nd, o)}${clipAttr(defs, nd.clip)} x="${n(nd.x)}" y="${n(nd.y)}" width="${n(nd.w)}" height="${n(nd.h)}"${nd.rx ? ` rx="${n(nd.rx)}"` : ''} fill="${paint(defs, nd.fill)}"${nd.stroke ? ` stroke="${nd.stroke}" stroke-width="${n(nd.sw || 1)}"` : ''}/>`;
    case 'path':
      return `<path${common(nd, o)}${clipAttr(defs, nd.clip)} d="${nd.d}"${nd.rule ? ` fill-rule="${nd.rule}"` : ''} fill="${paint(defs, nd.fill)}"${nd.stroke ? ` stroke="${nd.stroke}" stroke-width="${n(nd.sw || 1)}"` : ''}${nd.dash ? ` stroke-dasharray="${nd.dash}"` : ''}${nd.cap ? ` stroke-linecap="${nd.cap}"` : ''}/>`;
    case 'circle':
      return `<circle${common(nd, o)}${clipAttr(defs, nd.clip)} cx="${n(nd.cx)}" cy="${n(nd.cy)}" r="${n(nd.r)}" fill="${nd.fill || 'none'}"${nd.stroke ? ` stroke="${nd.stroke}" stroke-width="${n(nd.sw || 1)}"` : ''}${nd.dash ? ` stroke-dasharray="${nd.dash}"` : ''}/>`;
    case 'line':
      return `<line${common(nd, o)}${clipAttr(defs, nd.clip)} x1="${n(nd.x1)}" y1="${n(nd.y1)}" x2="${n(nd.x2)}" y2="${n(nd.y2)}" stroke="${nd.stroke}" stroke-width="${n(nd.sw)}"${nd.dash ? ` stroke-dasharray="${nd.dash}"` : ''}/>`;
    case 'text':
      return renderText(nd, o, defs);
    case 'group':
      return `<g${common(nd, o)}${clipAttr(defs, nd.clip)}${nd.transform ? ` transform="${nd.transform}"` : ''}>${nd.children.map((c) => renderNode(c, o, defs)).join('')}</g>`;
    case 'image': {
      const r = imageDrawRect(nd);
      const href = o.resolve ? o.resolve(nd.src) : nd.src;
      const clipShape: Shape = nd.clip ?? { type: 'rect', x: nd.x, y: nd.y, w: nd.w, h: nd.h };
      const clip = clipAttr(defs, clipShape);
      const flt = filterAttr(defs, nd.filter);
      let s: string;
      if (nd.halftone) {
        const ht = nd.halftone, c = Math.max(3, ht.cell);
        const pid = defs.add(`ht-${ht.ink}-${c}`, (id) => `<pattern id="${id}" width="${n(c)}" height="${n(c)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="${n(c / 2)}" cy="${n(c / 2)}" r="${n(c * 0.44)}" fill="${ht.ink}"/></pattern>`, 'p');
        const dk = filterAttr(defs, { grayscale: true, invert: true, contrast: 1.55, bright: 1.05 });
        const mid = defs.add(null, (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="${n(nd.x)}" y="${n(nd.y)}" width="${n(nd.w)}" height="${n(nd.h)}"><image href="${esc(href)}" x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" preserveAspectRatio="none"${dk}/></mask>`, 'm');
        s = `<g${common(nd, o)}${clip}><rect x="${n(nd.x)}" y="${n(nd.y)}" width="${n(nd.w)}" height="${n(nd.h)}" fill="${ht.paper}"/><rect x="${n(nd.x)}" y="${n(nd.y)}" width="${n(nd.w)}" height="${n(nd.h)}" fill="url(#${pid})" mask="url(#${mid})"/>`;
      } else s = `<g${common(nd, o)}${clip}><image href="${esc(href)}" x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" preserveAspectRatio="none"${flt}/>`;
      if (nd.overlay && nd.overlay.opacity > 0) {
        s += `<rect x="${n(nd.x - 2)}" y="${n(nd.y - 2)}" width="${n(nd.w + 4)}" height="${n(nd.h + 4)}" fill="${nd.overlay.color}" opacity="${n(nd.overlay.opacity)}"${nd.overlay.blend ? ` style="mix-blend-mode:${nd.overlay.blend}"` : ''}/>`;
      }
      if (o.interactive && o.selected === nd.id) {
        s += `<rect class="imgsel" x="${n(nd.x)}" y="${n(nd.y)}" width="${n(nd.w)}" height="${n(nd.h)}" fill="none" stroke="#2f7cf6" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
      }
      return s + '</g>';
    }
  }
}

function textureDef(defs: Defs, kind: string, color: string, w: number, h: number): string {
  switch (kind) {
    case 'grain':
      // print grain: a fine, slightly clumped grey noise centred on 50 % and soft-light blended, so it both lifts
      // (ink drop-out on dark grounds) and darkens (toner specks on light grounds) instead of only greying the page
      return defs.add('tex-grain2', (id) => `<filter id="${id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="3" seed="3" stitchTiles="stitch" result="f"/><feTurbulence type="fractalNoise" baseFrequency="0.18" numOctaves="2" seed="17" stitchTiles="stitch" result="c"/><feComposite in="f" in2="c" operator="arithmetic" k1="0" k2="0.8" k3="0.2" k4="0"/><feColorMatrix type="matrix" values="2.4 0 0 0 -0.7  2.4 0 0 0 -0.7  2.4 0 0 0 -0.7  0 0 0 0 1"/></filter>`, 't');
    case 'paper':
      // fine fibre tooth + a very low-contrast large-scale mottle (no blotches)
      return defs.add('tex-paper', (id) => `<filter id="${id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.0045 0.006" numOctaves="2" seed="8" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.36  0 0 0 0 0.28  0 0 0 0.55 -0.2" result="mm"/><feTurbulence type="fractalNoise" baseFrequency="0.95 0.42" numOctaves="3" seed="4" result="f"/><feColorMatrix in="f" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.26  0 0 0 0 0.2  0 0 0 -2.1 1.22" result="ff"/><feMerge><feMergeNode in="mm"/><feMergeNode in="ff"/></feMerge></filter>`, 't');
    case 'riso':
      return defs.add('tex-riso', (id) => `<filter id="${id}" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 4.6"/></filter>`, 't');
    case 'halftone':
      return defs.add('tex-ht-' + color, (id) => `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="4.5" cy="4.5" r="1.4" fill="${color}"/></pattern>`, 'p');
    case 'lines':
      return defs.add('tex-ln-' + color, (id) => `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="1.2" height="7" fill="${color}"/></pattern>`, 'p');
    case 'linen':
      return defs.add('tex-linen', (id) => `<filter id="${id}" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.02" numOctaves="2" seed="2" result="a"/><feTurbulence type="fractalNoise" baseFrequency="0.02 0.9" numOctaves="2" seed="5" result="b"/><feBlend in="a" in2="b" mode="multiply"/><feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.18  0 0 0 0 0.15  0 0 0 -2.4 1.25"/></filter>`, 't');
  }
  void w; void h;
  return '';
}

export function renderSVG(scene: Scene, o: RenderOpts = {}): string {
  const defs = new Defs();
  const { w, h } = scene;
  const body = scene.nodes.map((nd) => renderNode(nd, o, defs)).join('');
  let content = body;
  if (scene.tune && (scene.tune.contrast !== 1 || scene.tune.saturation !== 1 || scene.tune.brightness !== 1)) {
    const fa = filterAttr(defs, { sat: scene.tune.saturation, bright: scene.tune.brightness, contrast: scene.tune.contrast });
    content = `<g${fa}>${body}</g>`;
  }
  let tex = '';
  if (scene.texture && scene.texture.amount > 0 && !o.hide?.has('texture')) {
    const k = scene.texture.kind;
    const id = textureDef(defs, k, scene.texture.color, w, h);
    if (id) {
      const fill = k === 'halftone' || k === 'lines' ? `url(#${id})` : '#000';
      const filt = k === 'halftone' || k === 'lines' ? '' : ` filter="url(#${id})"`;
      const blend = k === 'grain' ? 'soft-light' : 'multiply';
      const amt = k === 'grain' ? Math.min(1, scene.texture.amount * 1.6) : scene.texture.amount;
      tex = `<rect data-layer="texture" x="0" y="0" width="${w}" height="${h}" fill="${fill}"${filt} opacity="${n(amt)}" style="mix-blend-mode:${blend}" pointer-events="none"/>`;
    }
  }
  const sc = o.scale ?? 1;
  const style = o.fontCss ? `<style>${o.fontCss}</style>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(w * sc)}" height="${n(h * sc)}" viewBox="0 0 ${w} ${h}" style="${SVG_TYPE_RESET}">${style}<defs>${defs.items.join('')}</defs><rect width="${w}" height="${h}" fill="${scene.bg}"/>${content}${tex}</svg>`;
}
