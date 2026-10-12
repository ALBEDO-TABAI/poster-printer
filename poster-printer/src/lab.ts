// Developer lab: renders a grid of posters for visual QA. /lab.html?n=12&ratio=3:4&comp=split&style=neue-grid&seed=X
import { generate, DEFAULT_MODULES } from './engine/generate';
import { renderSVG } from './engine/render/svg';
import { canvasMeasurer } from './engine/text/measure';
import { RANDOM_STYLES, BUILTIN_STYLES, COMPS } from './data/styles';
import { TEXT_SETS } from './data/texts';
import { loadFontManifest, ensureFontSet } from './lib/fonts';
import { loadImages, loadPalettes } from './lib/assets';
import { DEFAULT_PARAMS } from './engine/params';
import { Rng } from './engine/rng';
import type { Ratio, ModeKey } from './engine/types';

async function main() {
  const q = new URLSearchParams(location.search);
  await loadFontManifest();
  const images = await loadImages();
  const palettes = await loadPalettes();
  const measure = canvasMeasurer();
  const n = Number(q.get('n') || 12);
  const base = q.get('seed') || 'LAB';
  const w = Number(q.get('w') || 300);
  const g = document.getElementById('g')!;
  const out: any[] = [];
  for (let i = 0; i < n; i++) {
    const r = new Rng(base + i);
    const style = q.get('style') ? BUILTIN_STYLES.find((s) => s.id === q.get('style'))! : r.pick(RANDOM_STYLES);
    await ensureFontSet(style.fonts);
    const ratios = (q.get('ratio') || '3:4').split(',');
    const ratio = ratios[i % ratios.length] as Ratio;
    const modes = (q.get('modes') ? q.get('modes')!.split(',') : style.modes || []) as ModeKey[];
    const params = { ...DEFAULT_PARAMS, ...style.params, ...(q.get('comp') ? { composition: q.get('comp')! } : {}), ...(q.get('all') ? { composition: COMPS[i % COMPS.length] } : {}), ...Object.fromEntries((q.get('p') || '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split(':'); return [k, isNaN(Number(v)) ? (v === 'true' ? true : v === 'false' ? false : v) : Number(v)]; })) };
    const t0 = performance.now();
    const res = generate({
      seeds: { layout: base + i + 'L', text: base + i + 'T', color: base + i + 'C', image: base + i + 'I' }, ratio, style, params, modules: DEFAULT_MODULES, modes,
      fonts: style.fonts, images, palettes, textSets: TEXT_SETS, measure,
    });
    const svg = renderSVG(res.scene);
    const d = document.createElement('div');
    d.className = 'c';
    const scale = w / res.scene.w;
    d.innerHTML = svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${res.scene.h * scale}"`) + `<div>${style.id} · ${res.picked.comp} · ${res.picked.grid.type}/${res.picked.grid.density} · ${(performance.now() - t0).toFixed(0)}ms · q${res.picked.quality ? Math.round(res.picked.quality.score) : '-'}/a${res.attempts ?? 1}${res.picked.quality ? ` mv${res.picked.quality.moved} dr${res.picked.quality.dropped} rc${res.picked.quality.recolored} pl${res.picked.quality.scrims}` : ''}</div>`;
    g.appendChild(d);
    out.push({ style: style.id, comp: res.picked.comp, ms: Math.round(res.ms), q: res.picked.quality, a: res.attempts });
  }
  (window as any).__labDone = out;
}
main().catch((e) => { document.body.innerHTML = '<pre>' + e.stack + '</pre>'; (window as any).__labDone = { error: String(e) }; });
