// ready-poster-printer engine CLI: `node dist/engine.mjs <op> [--backend chromium|node]` with a JSON payload on stdin,
// one JSON document on stdout ({ok, result} or {ok:false, error, code}). Used by the Python harness.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve as presolve, extname, basename } from 'node:path';
import { createServer, type Server } from 'node:http';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BUILTIN_STYLES } from '@rea/data/styles';
import { PARAMS, DEFAULT_PARAMS } from '@rea/engine/params';
import { PAIRINGS } from '@rea/data/pairings';
import { IDEAS } from '@rea/engine/gen/ideas';
import { approxMeasurer } from '@rea/engine/text/measure';
import { renderSVG } from '@rea/engine/render/svg';
import { extractPalette } from '@rea/engine/color/extract';
import { familiesOf } from '@rea/lib/fonts';
import { makePdf, jpegSize } from '@rea/lib/pdf';
import { makeZip } from '@rea/lib/zip';
import type { Scene } from '@rea/engine/types';
import type { ImageAsset } from '@rea/engine/gen/ctx';
import { BRIEF_SCHEMA, briefTemplate, validateBrief, RATIOS, type Brief } from './brief';
import { analyze } from './analyze';
import { resolveWith, type Env } from './core';
import { runOp } from './ops';
import { LAYOUT_CATALOG, analyseSet } from './layouts';
import { STYLE_TAGS } from './styletags';

declare const __BUILD_INFO__: { rea: string; reaCommit: string; built: string };
const HERE = dirname(fileURLToPath(import.meta.url));
const REA = process.env.REA_POSTER ?? __BUILD_INFO__.rea;
const PUB = process.env.REA_POSTER_PUBLIC ?? join(REA, 'public');
const FONTS_SRC = process.env.POSTER_PRINTER_FONTS ?? '/workspace/fonts';
const HOME = process.env.POSTER_PRINTER_HOME ?? join(homedir(), '.poster-printer');
// Chrome / Chromium (or another Chromium browser: Edge, Brave) — Linux, macOS and Windows install paths
const CHROME = process.env.POSTER_PRINTER_CHROME ?? [
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync) ?? '';
const PAGE_JS = join(HERE, 'page.js');

class OpError extends Error { constructor(msg: string, public code = 1) { super(msg); } }
const readJSON = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const presetImages = (): ImageAsset[] => readJSON(join(PUB, 'images/manifest.json'));
const palettes = () => readJSON<any[]>(join(PUB, 'data/palettes.json'));
const fontManifest = () => readJSON<any[]>(join(PUB, 'fonts/manifest.json'));
const userIndex = join(HOME, 'images', 'index.json');
const userImages = (): ImageAsset[] => (existsSync(userIndex) ? readJSON<ImageAsset[]>(userIndex) : []);

// ------------------------------------------------------------------ backends
async function nodeEnv(): Promise<Env> {
  const fm = fontManifest();
  const cat = existsSync(join(FONTS_SRC, 'catalog.json')) ? readJSON<any>(join(FONTS_SRC, 'catalog.json')) : { families: [] };
  const dataUrl = (p: string, mime: string) => `data:${mime};base64,${readFileSync(p).toString('base64')}`;
  const resolveSrc = (s: string) => (s.startsWith('data:') ? s : dataUrl(join(PUB, s), s.endsWith('.png') ? 'image/png' : 'image/jpeg'));
  const famsOf = (sc: Scene) => { const f = new Set<string>(['Noto Sans SC']); const w = (ns: Scene['nodes']) => ns.forEach((n) => { if (n.kind === 'text') { f.add(n.family); if (n.fallback) f.add(n.fallback); } if (n.clip?.type === 'text') f.add(n.clip.family); if (n.kind === 'group') w(n.children); }); w(sc.nodes); return [...f]; };
  const { Resvg } = await import('@resvg/resvg-js');
  const sharp = (await import('sharp')).default;
  return {
    backend: 'node', measure: approxMeasurer, presetImages: presetImages(), userImages: userImages(), palettes: palettes(),
    ensureFonts: async () => {},
    svg: async (sc, embed) => {
      const css = embed ? famsOf(sc).flatMap((f) => (fm.find((m) => m.family === f)?.files ?? []).map((x: any) => `@font-face{font-family:"${f}";src:url(${dataUrl(join(PUB, x.url), 'font/woff2')}) format("woff2");font-weight:${x.weight};font-style:${x.style};}`)).join('') : '';
      return renderSVG(sc, { fontCss: css, resolve: resolveSrc });
    },
    raster: async (sc, scale, type) => {
      const svg = renderSVG(sc, { resolve: resolveSrc });
      const files = famsOf(sc).flatMap((f) => (cat.families.find((x: any) => x.name === f)?.files ?? []).map((p: string) => join(FONTS_SRC, p))).filter((p: string) => /\.(ttf|otf)$/i.test(p) && existsSync(p));
      const png = new Resvg(svg, { font: { fontFiles: files, loadSystemFonts: false, defaultFontFamily: 'Noto Sans SC' }, fitTo: { mode: 'zoom', value: scale }, background: type === 'jpeg' ? '#ffffff' : undefined }).render().asPng();
      return (type === 'jpeg' ? await sharp(png).jpeg({ quality: 92 }).toBuffer() : png).toString('base64');
    },
    pixels: async (sc) => {
      const svg = renderSVG(sc, { resolve: resolveSrc });
      const files = famsOf(sc).flatMap((f) => (cat.families.find((x: any) => x.name === f)?.files ?? []).map((p: string) => join(FONTS_SRC, p))).filter((p: string) => /\.(ttf|otf)$/i.test(p) && existsSync(p));
      const img = new Resvg(svg, { font: { fontFiles: files, loadSystemFonts: false, defaultFontFamily: 'Noto Sans SC' } }).render();
      return { w: img.width, h: img.height, data: img.pixels };
    },
  };
}

interface Chromium { run(op: string, p: unknown): Promise<any>; close(): Promise<void> }
async function chromiumEnv(extraFonts: unknown[]): Promise<Chromium> {
  if (!CHROME) throw new OpError('no Chrome/Chromium found (set POSTER_PRINTER_CHROME, or use --backend node)', 3);
  if (!existsSync(PAGE_JS)) throw new OpError('engine page bundle missing: run `npm run build` in engine/', 3);
  const MIME: Record<string, string> = { '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.html': 'text/html' };
  const server: Server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = '';
    if (url === '/' || url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><body><script src="/__pp/page.js"></script>'); return; }
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (url === '/__pp/page.js') file = PAGE_JS;
    else if (url.startsWith('/__pp/home/')) file = join(HOME, url.slice('/__pp/home/'.length));
    else file = join(PUB, url);
    const real = presolve(file);
    if (!(real.startsWith(presolve(PUB)) || real.startsWith(presolve(HOME)) || real === PAGE_JS) || !existsSync(real) || statSync(real).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(real).toLowerCase()] ?? 'application/octet-stream' }); res.end(readFileSync(real));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => (window as any).__pp?.ready, null, { timeout: 30000 });
  await page.evaluate((cfg) => (window as any).__pp.init(cfg), { userImages: userImages(), extraFonts });
  return {
    async run(op, p) {
      try { return await page.evaluate(({ op, p }) => (window as any).__pp.run(op, p), { op, p }); }
      catch (e) { const m = String((e as Error).message ?? e); throw new OpError(m.replace(/^page\.evaluate: (Error: )?/, '').split('\n')[0] + (errs.length ? ` [page: ${errs.slice(-2).join(' | ')}]` : ''), /invalid brief|unknown|must be/.test(m) ? 2 : 1); }
    },
    async close() { await browser.close(); server.close(); },
  };
}

// ------------------------------------------------------------------ writing + verifying outputs
async function verifyImage(path: string, kind: 'png' | 'jpeg') {
  const sharp = (await import('sharp')).default;
  const b = readFileSync(path);
  const magic = kind === 'png' ? b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) : b[0] === 0xff && b[1] === 0xd8;
  const meta = await sharp(b).metadata(); const st = await sharp(b).stats();
  const stdev = Math.max(...st.channels.slice(0, 3).map((c) => c.stdev));
  return { magic, bytes: b.length, w: meta.width, h: meta.height, nonblank: stdev > 2, stdev: +stdev.toFixed(2) };
}
async function writeRendered(base: string, rendered: any, scale = 1) {
  const files: Record<string, string> = {}; const verify: Record<string, unknown> = {};
  if (!rendered) return { files, verify };
  if (rendered.png) { writeFileSync(base + '.png', Buffer.from(rendered.png, 'base64')); files.png = base + '.png'; verify.png = await verifyImage(base + '.png', 'png'); }
  if (rendered.jpeg) { writeFileSync(base + '.jpg', Buffer.from(rendered.jpeg, 'base64')); files.jpg = base + '.jpg'; verify.jpg = await verifyImage(base + '.jpg', 'jpeg'); }
  if (rendered.svg) { writeFileSync(base + '.svg', rendered.svg); files.svg = base + '.svg'; verify.svg = { bytes: rendered.svg.length, ok: rendered.svg.startsWith('<svg') && rendered.svg.trimEnd().endsWith('</svg>') }; }
  void scale;
  for (const [k, v] of Object.entries(verify)) { const x = v as any; if (x.magic === false || x.nonblank === false || x.ok === false) throw new OpError(`render verification failed for ${k}: ${JSON.stringify(x)}`, 4); }
  return { files, verify };
}
const safe = (s: string) => s.replace(/[^\w.-]+/g, '_').slice(0, 80);
function writeJSON(path: string, o: unknown) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(o, null, 1)); }

async function pdfFrom(jpegsB64: string[], out: string, title: string) {
  const pages = jpegsB64.map((b) => { const jpeg = new Uint8Array(Buffer.from(b, 'base64')); const s = jpegSize(jpeg)!; return { jpeg, pxW: s.w, pxH: s.h, ptW: s.w * 0.75, ptH: s.h * 0.75 }; });
  writeFileSync(out, makePdf(pages, { title, producer: 'ready-poster-printer CLI' }));
  const b = readFileSync(out);
  if (b.subarray(0, 5).toString() !== '%PDF-') throw new OpError('pdf verification failed', 4);
  return { file: out, bytes: b.length, pages: pages.length };
}

// ------------------------------------------------------------------ catalogue (pure)
function catalog(what: string, p: any) {
  if (what === 'styles') return BUILTIN_STYLES.filter((s) => !p.lib || s.lib === p.lib).filter((s) => !p.mood || STYLE_TAGS[s.id]?.mood.includes(p.mood)).map((s) => ({ id: s.id, name: s.name, lib: s.lib, tags: STYLE_TAGS[s.id], fonts: { en: s.fonts.en['big.main'].family, en_text: s.fonts.en['big.sub'].family, zh: s.fonts.zh['big.main'].family }, modes: s.modes ?? [], params: s.params }));
  if (what === 'style') { const s = BUILTIN_STYLES.find((x) => x.id === p.id); if (!s) throw new OpError('unknown style ' + p.id, 2); return { ...s, tags: STYLE_TAGS[s.id], resolvedParams: { ...DEFAULT_PARAMS, ...s.params } }; }
  if (what === 'palettes') {
    let l = palettes();
    if (p.src) l = l.filter((x) => x.src === p.src); if (p.light) l = l.filter((x) => x.light === p.light); if (p.chroma) l = l.filter((x) => x.chroma === p.chroma); if (p.contrast) l = l.filter((x) => x.contrast === p.contrast); if (p.tag) l = l.filter((x) => (x.tags ?? []).includes(p.tag));
    if (p.near) { const h = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); const t = h(p.near); const dist = (x: any) => Math.min(...x.colors.map((c: string) => { const v = h(c); return Math.hypot(v[0] - t[0], v[1] - t[1], v[2] - t[2]); })); l = [...l].sort((a, b) => dist(a) - dist(b)); }
    return { total: l.length, palettes: l.slice(0, p.limit ?? 20) };
  }
  if (what === 'palette') { const x = palettes().find((q) => q.id === p.id); if (!x) throw new OpError('unknown palette ' + p.id, 2); return x; }
  if (what === 'fonts') return fontManifest().filter((f) => (p.cjk === undefined || f.cjk === p.cjk) && (!p.group || f.group === p.group)).map((f) => ({ family: f.family, group: f.group, tags: f.tags, cjk: f.cjk, variable: f.variable, weights: f.variable ? [f.wmin, f.wmax] : f.weights, license: f.license, files: f.files.length }));
  if (what === 'pairings') return PAIRINGS.filter((x) => !p.mood || x.mood === p.mood);
  if (what === 'images') {
    const all = [...presetImages().map((a) => ({ ...a, user: false })), ...userImages().map((a) => ({ ...a, user: true }))];
    return all.filter((a) => (!p.category || a.category === p.category) && (!p.cutout || a.cutout) && (p.user === undefined || a.user === p.user)).map((a) => ({ id: a.id, category: a.category, tier: (a as any).tier, w: a.w, h: a.h, cutout: !!a.cutout, palette: a.palette, title: a.title, user: a.user, credit: (a as any).credit?.artist ?? (a as any).credit?.license }));
  }
  if (what === 'ideas') return IDEAS.map((I) => ({ id: I.id, rule: I.rule, realisers: I.realisers, needs: (I as any).needs ?? {}, contrasts: I.contrasts }));
  if (what === 'params') return (PARAMS as any[]).filter((x) => !p.section || x.section === p.section).map((x) => ({ key: x.key, type: x.type, section: x.section, min: x.min, max: x.max, options: x.options?.map((o) => o.v), default: x.def, en: x.en, zh: x.zh }));
  if (what === 'compositions') return (PARAMS as any[]).find((x) => x.key === 'composition')!.options!.map((o: any) => ({ id: o.v, en: o.en, zh: o.zh }));
  if (what === 'ratios') return RATIOS;
  if (what === 'layouts') return LAYOUT_CATALOG;
  if (what === 'imageset') { const all = [...presetImages(), ...userImages()]; const ids: string[] = p.ids ?? []; const miss = ids.filter((id) => !all.some((a) => a.id === id)); if (miss.length) throw new OpError('unknown picture ids: ' + miss.join(', '), 2); return analyseSet(ids.map((id) => all.find((a) => a.id === id)!)); }
  throw new OpError('unknown catalogue ' + what, 2);
}

// ------------------------------------------------------------------ user images (port of lib/userImages.analyseImage)
async function analyseImage(file: string, id: string): Promise<ImageAsset> {
  const sharp = (await import('sharp')).default;
  if (!existsSync(file)) throw new OpError('no such file ' + file, 2);
  const img = sharp(file).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new OpError('not an image: ' + file, 2);
  const k = Math.min(1, 1600 / Math.max(meta.width, meta.height));
  const w = Math.round(meta.width * k), h = Math.round(meta.height * k);
  const main = await sharp(file).rotate().resize(w, h).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
  const tk = 360 / Math.max(w, h);
  const thumb = await sharp(main).resize(Math.round(w * tk), Math.round(h * tk)).jpeg({ quality: 80 }).toBuffer();
  const raw = async (W: number, H: number) => new Uint8ClampedArray((await sharp(main).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer()).buffer.slice(0));
  const pal = extractPalette(await raw(96, Math.max(1, Math.round((96 * h) / w))), 5).map((s) => s.hex);
  const d = await raw(16, 16);
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum: number[] = []; for (let i = 0; i < 256; i++) lum.push(+(0.2126 * lin(d[i * 4]) + 0.7152 * lin(d[i * 4 + 1]) + 0.0722 * lin(d[i * 4 + 2])).toFixed(3));
  const dd = await raw(64, 64);
  const gray = (x: number, y: number) => { const i = (Math.min(63, y) * 64 + Math.min(63, x)) * 4; return (dd[i] * 0.299 + dd[i + 1] * 0.587 + dd[i + 2] * 0.114) / 255; };
  const detail: number[] = [];
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { let e = 0; for (let y = j * 4; y < j * 4 + 4; y++) for (let x = i * 4; x < i * 4 + 4; x++) e += Math.abs(gray(x + 1, y) - gray(x, y)) + Math.abs(gray(x, y + 1) - gray(x, y)); detail.push(+Math.min(1, e / 16 / 0.25).toFixed(2)); }
  const name = basename(file);
  const { focus, subject } = saliency(await raw(48, 48), 48);
  return { id, src: 'data:image/jpeg;base64,' + main.toString('base64'), thumb: 'data:image/jpeg;base64,' + thumb.toString('base64'), w, h, palette: pal, lum, lumW: 16, lumH: 16, detail, focus, subject, cutout: null, category: 'mine', title: name, credit: { title: name, license: 'user upload' }, user: true } as unknown as ImageAsset;
}

/** phase 16: the salient subject of a picture (frequency-tuned colour distinctness + local detail, mild centre prior):
 *  its bounding box (0..1, the mass between the 6th and 94th percentiles of the salient cells) and its centroid. The
 *  grid layouts keep this box inside each picture's crop. */
function saliency(px: Uint8ClampedArray, S: number): { focus: { x: number; y: number }; subject: { x: number; y: number; w: number; h: number } } {
  const L = new Float32Array(S * S), A = new Float32Array(S * S), B = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) { const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255; L[i] = 0.299 * r + 0.587 * g + 0.114 * b; A[i] = r - g; B[i] = (r + g) / 2 - b; }
  const blur = (X: Float32Array) => { const o = new Float32Array(S * S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let s = 0, c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < S && yy < S) { s += X[yy * S + xx]; c++; } } o[y * S + x] = s / c; } return o; };
  const bl = blur(L), ba = blur(A), bb = blur(B);
  const mean = (X: Float32Array) => X.reduce((s, v) => s + v, 0) / X.length;
  const mL = mean(bl), mA = mean(ba), mB = mean(bb);
  const sal = new Float32Array(S * S);
  let mx = 1e-6;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const tone = Math.hypot(bl[i] - mL, (ba[i] - mA) * 0.8, (bb[i] - mB) * 0.8);
    const gx = x + 1 < S ? Math.abs(L[i + 1] - L[i]) : 0, gy = y + 1 < S ? Math.abs(L[i + S] - L[i]) : 0;
    const cx = (x + 0.5) / S - 0.5, cy = (y + 0.5) / S - 0.5;
    const v = (tone + 0.6 * (gx + gy)) * (1 - 0.9 * (cx * cx + cy * cy));
    sal[i] = v; if (v > mx) mx = v;
  }
  const m = mean(sal), sd = Math.sqrt(sal.reduce((s, v) => s + (v - m) ** 2, 0) / sal.length);
  const t = m + 0.4 * sd;
  const colM = new Float32Array(S), rowM = new Float32Array(S);
  let tot = 0, fx = 0, fy = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = sal[y * S + x]; if (v <= t) continue; const w = v - t; colM[x] += w; rowM[y] += w; tot += w; fx += w * (x + 0.5); fy += w * (y + 0.5); }
  if (tot <= 0) return { focus: { x: 0.5, y: 0.45 }, subject: { x: 0.15, y: 0.12, w: 0.7, h: 0.76 } };
  const q = (M: Float32Array, p: number) => { let acc = 0; for (let i = 0; i < S; i++) { acc += M[i]; if (acc >= p * tot) return i / S; } return 1; };
  let x0 = q(colM, 0.06), x1 = q(colM, 0.94) + 1 / S, y0 = q(rowM, 0.06), y1 = q(rowM, 0.94) + 1 / S;
  // never a sliver: at least 18 % of each side, centred on the mass
  const grow = (a: number, b: number) => { const need = 0.18 - (b - a); if (need <= 0) return [a, b]; const c = (a + b) / 2; return [Math.max(0, c - 0.09), Math.min(1, c + 0.09)]; };
  [x0, x1] = grow(x0, x1); [y0, y1] = grow(y0, y1);
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return { focus: { x: r3(fx / tot / S), y: r3(fy / tot / S) }, subject: { x: r3(x0), y: r3(y0), w: r3(Math.min(1, x1) - x0), h: r3(Math.min(1, y1) - y0) } };
}

// ------------------------------------------------------------------ doctor
async function doctor() {
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  const c = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  c('node', true, process.version);
  c('rea-poster', existsSync(join(REA, 'src/engine/generate.ts')), REA);
  let head = ''; try { head = execFileSync('git', ['-C', REA, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { /* no git */ }
  c('engine bundle', head === '' || head === __BUILD_INFO__.reaCommit, `built from rea-poster ${__BUILD_INFO__.reaCommit} at ${__BUILD_INFO__.built}; repo HEAD ${head || '?'}${head && head !== __BUILD_INFO__.reaCommit ? ' (rebuild: npm run build in engine/)' : ''}`);
  for (const f of ['images/manifest.json', 'data/palettes.json', 'fonts/manifest.json']) c('asset ' + f, existsSync(join(PUB, f)), join(PUB, f));
  c('fonts built', existsSync(join(PUB, 'fonts/manifest.json')) && fontManifest().every((f) => f.files.every((x: any) => existsSync(join(PUB, x.url)))), `${existsSync(join(PUB, 'fonts/manifest.json')) ? fontManifest().length : 0} families (woff2 subsets)`);
  c('full fonts (glyph fallback, node raster)', existsSync(join(FONTS_SRC, 'catalog.json')), FONTS_SRC);
  c('page bundle', existsSync(PAGE_JS), PAGE_JS);
  let chromeV = ''; try { chromeV = CHROME ? execFileSync(CHROME, ['--version']).toString().trim() : ''; } catch { /* */ }
  c('chrome', !!chromeV, chromeV || 'not found (default backend chromium needs it; --backend node works without)');
  try { await import('@resvg/resvg-js'); c('resvg (node backend)', true, 'ok'); } catch (e) { c('resvg (node backend)', false, String(e)); }
  try { await import('sharp'); c('sharp', true, 'ok'); } catch (e) { c('sharp', false, String(e)); }
  let cut = false; try { const r = await fetch('http://127.0.0.1:8787/api/health', { signal: AbortSignal.timeout(800) }); cut = r.ok; } catch { /* offline */ }
  c('cutout server (optional)', cut, cut ? '127.0.0.1:8787 up' : '127.0.0.1:8787 offline (only needed for cut-outs of user images)');
  c('user dir', true, `${HOME} (${userImages().length} user images)`);
  if (CHROME && existsSync(PAGE_JS)) {
    try { const t = Date.now(); const ch = await chromiumEnv([]); await ch.close(); c('chromium backend boots', true, `${Date.now() - t} ms`); } catch (e) { c('chromium backend boots', false, String((e as Error).message)); }
  }
  const required = ['node', 'rea-poster', 'asset images/manifest.json', 'asset data/palettes.json', 'asset fonts/manifest.json', 'page bundle'];
  return { ok: checks.filter((x) => required.includes(x.name)).every((x) => x.ok), checks, build: __BUILD_INFO__, paths: { rea: REA, public: PUB, fonts: FONTS_SRC, home: HOME, chrome: CHROME } };
}

// ------------------------------------------------------------------ main
async function main() {
  const [op = 'help', ...rest] = process.argv.slice(2);
  const bi = rest.indexOf('--backend'); const backend = bi >= 0 ? rest[bi + 1] : process.env.POSTER_PRINTER_BACKEND ?? 'chromium';
  if (!['chromium', 'node'].includes(backend)) throw new OpError('backend must be chromium or node', 2);
  const stdin = process.stdin.isTTY ? '' : readFileSync(0, 'utf8');
  const p: any = stdin.trim() ? JSON.parse(stdin) : {};
  const brief = (): Brief => { if (!p.brief) throw new OpError('payload.brief is required', 2); return p.brief; };
  switch (op) {
    case 'help': return { ops: ['paths', 'schema', 'template', 'validate', 'analyze', 'resolve', 'catalog', 'doctor', 'images.analyse', 'fonts.families', 'generate', 'render', 'refine', 'variations', 'audit', 'deck', 'sheet', 'pdf'] };
    case 'schema': return BRIEF_SCHEMA;
    case 'template': return briefTemplate(p.lang ?? 'en');
    case 'validate': return validateBrief(p.brief);
    case 'analyze': return analyze(brief());
    case 'resolve': {
      const R = resolveWith({ presetImages: presetImages(), userImages: userImages() }, brief());
      return { ...R, directions: R.directions.map((d) => ({ ...d, families: familiesOf(d.fonts ?? BUILTIN_STYLES.find((s) => s.id === d.styleId)!.fonts), fonts: d.fonts ? 'pairing' : 'style' })) };
    }
    case 'catalog': return catalog(p.what, p);
    case 'doctor': return doctor();
    case 'paths': return { rea: REA, public: PUB, fonts: FONTS_SRC, home: HOME, chrome: CHROME, engine: HERE, build: __BUILD_INFO__ };
    case 'images.analyse': return analyseImage(p.file, p.id);
    case 'fonts.families': return p.styles ? Object.fromEntries((p.styles as string[]).map((id) => { const s = BUILTIN_STYLES.find((x) => x.id === id); if (!s) throw new OpError('unknown style ' + id, 2); return [id, familiesOf(s.fonts)]; })) : familiesOf(p.fonts);
    case 'sheet': return sheet(p);
    case 'pdf': return pdfFrom(p.jpegs, p.out, p.title ?? 'Ready Poster Printer');
  }
  // ops that render
  let ch: Chromium | null = null; let env: Env | null = null;
  const run = async (o: string, payload: unknown): Promise<any> => (ch ? ch.run(o, payload) : runOp(env!, o, payload));
  if (backend === 'chromium') ch = await chromiumEnv(p.extraFonts ?? []); else env = await nodeEnv();
  try {
    const out = p.out as string | undefined;
    if (out) mkdirSync(out, { recursive: true });
    if (op === 'generate') {
      const r = await run('generate', { brief: brief(), count: p.count, minScore: p.minScore, maxTries: p.maxTries, seed: p.seed, ratio: p.ratio, directions: p.directions, select: p.select, includeFlagged: p.includeFlagged, render: { formats: p.formats ?? ['png'], scale: p.scale ?? 1, embedFonts: p.embedFonts } });
      const posters: any[] = [];
      for (const [i, c] of r.candidates.entries()) {
        const name = `${String(i + 1).padStart(2, '0')}-${safe(c.name)}`;
        const item: any = { rank: i + 1, name, direction: c.direction, ...c.summary, flagged: !!c.flagged, gates_passed: c.report.gates_passed, blocking_failures: c.report.blocking_failures, replayExact: c.replayExact, reasons: c.reasons, ms: c.ms, report: c.report };
        if (out) { const base = join(out, name); writeJSON(base + '.json', c.poster); const w = await writeRendered(base, c.rendered); item.files = { json: base + '.json', ...w.files }; item.verify = w.verify; }
        else item.poster = c.poster;
        posters.push(item);
      }
      const R = r.resolved;
      return { backend, parity: backend === 'chromium', count: r.count, minScore: r.minScore, tries: r.tries, rejected: r.rejected, gate_failed: r.gateFailed, posters, analysis: { language: R.analysis.lang, hierarchy: R.analysis.fields.map((f: any) => ({ key: f.key, tier: f.tier, importance: f.importance })), list: { kind: R.analysis.list.kind, items: R.analysis.list.items.length } }, reasons: R.reasons, warnings: R.warnings };
    }
    if (op === 'render' || op === 'export') {
      const r = await run('render', { entry: p.entry, render: { formats: p.formats ?? ['png'], scale: p.scale ?? 1, embedFonts: p.embedFonts }, plainSvg: p.plainSvg, scene: p.scene });
      const res: any = { backend, summary: r.summary };
      if (p.plainSvg) res.svgPlain = r.svgPlain;
      if (p.scene) res.scene = r.scene;
      if (out || p.base) {
        const base = p.base ?? join(out!, safe(p.name ?? p.entry.id));
        mkdirSync(dirname(base), { recursive: true });
        const w = await writeRendered(base, r.rendered); res.files = w.files; res.verify = w.verify;
        if ((p.formats ?? []).includes('pdf')) {
          res.files.pdf = (await pdfFrom([r.rendered.jpeg], base + '.pdf', p.entry.id)).file;
          if (!(p.formats ?? []).some((f: string) => f === 'jpeg' || f === 'jpg')) { unlinkSync(res.files.jpg); delete res.files.jpg; delete res.verify.jpg; }
        }
        if ((p.formats ?? []).includes('json')) { writeJSON(base + '.json', { app: 'ready-poster-printer', kind: 'poster', version: 1, entry: p.entry }); res.files.json = base + '.json'; }
      } else res.rendered = r.rendered;
      return res;
    }
    if (op === 'refine') { const r = await run('refine', { entry: p.entry, set: p.set, texts: p.texts, styleId: p.styleId, ratio: p.ratio }); return { backend, entry: r.entry, summary: r.summary }; }
    if (op === 'audit') return { backend, ...(await run('audit', { entry: p.entry, brief: p.brief ?? null })) };
    if (op === 'variations' || op === 'deck') {
      const list = await run(op, { ...p, render: out ? { formats: op === 'deck' ? ['jpeg', ...(p.formats ?? []).filter((f: string) => f === 'png')] : p.formats ?? ['png'], scale: p.scale ?? 1 } : undefined });
      const items: any[] = [];
      for (const [i, v] of list.entries()) {
        const name = `${op === 'deck' ? 'page' : 'var'}-${String(i + 1).padStart(2, '0')}`;
        const item: any = { name, ...v.summary, entry: v.entry };
        if (out) { const base = join(out, name); writeJSON(base + '.json', { app: 'ready-poster-printer', kind: 'poster', version: 1, entry: v.entry }); const w = await writeRendered(base, v.rendered); item.files = { json: base + '.json', ...w.files }; item.verify = w.verify; }
        items.push(item);
      }
      const res: any = { backend, items };
      if (op === 'deck' && out) {
        const jpegs = list.map((v: any) => v.rendered.jpeg);
        if ((p.formats ?? ['pdf']).includes('pdf')) res.pdf = await pdfFrom(jpegs, join(out, 'deck.pdf'), 'Ready Poster Printer deck');
        if ((p.formats ?? []).includes('zip')) { const z = makeZip(list.map((v: any, i: number) => ({ name: `page-${String(i + 1).padStart(2, '0')}.jpg`, data: new Uint8Array(Buffer.from(v.rendered.jpeg, 'base64')) }))); writeFileSync(join(out, 'deck.zip'), z); res.zip = join(out, 'deck.zip'); }
      }
      return res;
    }
    throw new OpError('unknown op ' + op, 2);
  } finally { if (ch) await ch.close(); }
}

async function sheet(p: { images: string[]; labels?: string[]; out: string; cols?: number; cell?: number; title?: string; rowLabels?: string[]; perRow?: number }) {
  const sharp = (await import('sharp')).default;
  const cols = p.cols ?? 6, cw = p.cell ?? 300; const pad = 14; const lab = 34; const head = p.title ? 56 : 0;
  const metas = await Promise.all(p.images.map((f) => sharp(f).metadata()));
  const ch = Math.round(Math.max(...metas.map((m) => (cw * (m.height ?? 1)) / (m.width ?? 1))));
  const rows = Math.ceil(p.images.length / cols);
  const W = pad + cols * (cw + pad), H = head + pad + rows * (ch + lab + pad);
  const comps: any[] = [];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  for (const [i, f] of p.images.entries()) {
    const m = metas[i]; const h = Math.round((cw * (m.height ?? 1)) / (m.width ?? 1));
    const x = pad + (i % cols) * (cw + pad), y = head + pad + Math.floor(i / cols) * (ch + lab + pad);
    comps.push({ input: await sharp(f).resize(cw, h).toBuffer(), left: x, top: y + (ch - h) });
    const t = p.labels?.[i] ?? basename(f);
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${lab}"><text x="0" y="14" font-family="DejaVu Sans, sans-serif" font-size="11" fill="#222">${esc(t.slice(0, 52))}</text><text x="0" y="29" font-family="DejaVu Sans, sans-serif" font-size="10" fill="#666">${esc(t.slice(52, 104))}</text></svg>`), left: x, top: y + ch + 3 });
  }
  if (p.title) comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${head}"><text x="${pad}" y="36" font-family="DejaVu Sans, sans-serif" font-size="22" font-weight="bold" fill="#111">${esc(p.title)}</text></svg>`), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#f4f3f0' } }).composite(comps).jpeg({ quality: 86 }).toFile(p.out);
  return { file: p.out, w: W, h: H, verify: await verifyImage(p.out, 'jpeg') };
}

// write, then exit once the pipe has drained (large results are truncated by an immediate exit)
const emit = (o: unknown, code: number) => process.stdout.write(JSON.stringify(o) + '\n', () => process.exit(code));
main().then((result) => emit({ ok: true, result }, 0))
  .catch((e) => { const code = e instanceof OpError ? e.code : typeof e?.code === 'number' ? e.code : 1; emit({ ok: false, error: String(e?.message ?? e), code, issues: e?.issues }, code); });
