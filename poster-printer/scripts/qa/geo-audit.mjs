// Phase 11: geometric audit on REAL rendered text boxes. Generates N draws in the running app (same path as the editor),
// renders each scene to SVG in the page, measures every text element's DOM bounding box (getBBox, in poster units),
// and runs the geometric gates (src/engine/aesthetic/geo.ts) on those boxes.
// usage: node scripts/qa/geo-audit.mjs <out.json> [N=200] [seed=GEO] ; env REA_URL (default http://127.0.0.1:5180/)
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2] || '/tmp/geo.json', N = +(process.argv[3] || 200), SEED = process.argv[4] || 'GEO';
const base = process.env.REA_URL || 'http://127.0.0.1:5180/';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(base);
await page.waitForFunction(() => window.__rea?.getState().ready, null, { timeout: 120000 });
const SHOTS = process.env.GEO_SHOTS || '';
const res = await page.evaluate(async ({ N, SEED, SHOTS }) => {
  const { rasterize } = await import('/src/lib/exporter.ts');
  const { renderSVG } = await import('/src/engine/render/svg.ts');
  const { geoGates } = await import('/src/engine/aesthetic/geo.ts');
  const st0 = window.__rea.getState();
  const styles = st0.styles.filter((s) => s.builtIn).map((s) => s.id).filter((id) => !id.startsWith('zh-modern-')).sort(); // the P10 style list, so before / after draw the same jobs
  const RATIOS = ['3:4', '3:4', '3:4', '3:4', '3:4', '9:16', '9:16', '9:16', '1:1', '1:1', '4:3', '4:3', '16:9', '16:9', '21:9'];
  let h = 0; for (const c of SEED) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:800px;visibility:hidden'; document.body.appendChild(host);
  const rows = [];
  for (let i = 0; i < N; i++) {
    const st = window.__rea.getState();
    const style = styles[Math.floor(rnd() * styles.length)], ratio = RATIOS[Math.floor(rnd() * RATIOS.length)];
    const seed = SEED + i;
    st.pickStyle(style); st.set('ratio', ratio); st.set('modes', window.__rea.getState().modes); st.set('customOn', false); st.set('imgPick', []); st.set('edits', {}); st.set('placed', []);
    st.set('seeds', { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' });
    await st.regen(true);
    const r = window.__rea.getState().result; const sc = window.__rea.getState().scene;
    host.innerHTML = renderSVG(sc, { interactive: true });
    await document.fonts.ready;
    const boxes = new Map();
    // ink boxes: horizontal extent from the rendered tspans (getBBox), vertical extent from the browser's own ink metrics
    // of that line in that font (canvas measureText actualBoundingBox*): the em / line box would make tight leading look
    // like collisions
    const cv = document.createElement('canvas').getContext('2d');
    for (const el of host.querySelectorAll('text[data-id]')) {
      try {
        const cs = getComputedStyle(el); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const spans = el.querySelectorAll('tspan');
        for (const tsp of (spans.length ? spans : [el])) {
          const b = tsp.getBBox(); if (!b.width) continue;
          const m = cv.measureText(tsp.textContent || ''); const by = +(tsp.getAttribute('y') ?? el.getAttribute('y') ?? 0);
          x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.width);
          y0 = Math.min(y0, by - m.actualBoundingBoxAscent); y1 = Math.max(y1, by + m.actualBoundingBoxDescent);
        }
        if (x1 > x0) boxes.set(el.getAttribute('data-id'), { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      } catch {}
    }
    const dom = geoGates(sc, boxes), eng = geoGates(sc);
    let shot;
    if (SHOTS && dom.fails.length) {
      const marks = dom.fails.flatMap((f) => [f.a, f.b]).filter(Boolean).map((id, k) => { const b = boxes.get(id); return b ? { kind: 'rect', id: 'geo' + k, layer: 'ornament', x: b.x, y: b.y, w: b.w, h: b.h, fill: '#ff0033', opacity: 0.35 } : null; }).filter(Boolean);
      const blob = await rasterize({ ...sc, nodes: [...sc.nodes, ...marks] }, 0.3, 'image/jpeg');
      shot = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(blob); });
    }
    rows.push({ i, style, ratio, seed, shot, comp: r.picked.comp, strategy: r.picked.strategy, dom: { fails: dom.fails, soft: dom.soft.length }, eng: { fails: eng.fails.length }, attempts: r.attempts });
  }
  return rows;
}, { N, SEED, SHOTS });
if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); for (const r of res) if (r.shot) fs.writeFileSync(`${SHOTS}/${String(r.i).padStart(3, '0')}-${r.comp}-${r.dom.fails.map((f) => f.kind).join('+')}.jpg`, Buffer.from(r.shot.split(',')[1], 'base64')); for (const r of res) delete r.shot; }
fs.writeFileSync(out, JSON.stringify(res));
const rej = res.filter((r) => r.dom.fails.length).length;
const kinds = {}; for (const r of res) for (const f of r.dom.fails) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
const byComp = {}; for (const r of res) { const c = byComp[r.comp] ??= [0, 0]; c[0]++; if (r.dom.fails.length) c[1]++; }
console.log(JSON.stringify({ n: res.length, rejected: rej, rate: +(rej / res.length).toFixed(3), engRejected: res.filter((r) => r.eng.fails).length, kinds, byComp: Object.fromEntries(Object.entries(byComp).sort((a, b) => b[1][1] - a[1][1])) }));
await browser.close();
