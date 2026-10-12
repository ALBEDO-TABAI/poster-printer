// Renders showcase posters through the real app's export pipeline (window.__reaRaster).
// usage: node scripts/qa/showcase.mjs <outDir> [spec.json]
// spec.json: [{ name, style, ratio, seed, modes?, comp?, decor?, scale? }]; without it, one poster per built-in style.
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2] || 'showcase/tmp';
const spec = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
fs.mkdirSync(out, { recursive: true });
const base = process.env.REA_URL || 'http://127.0.0.1:5180/';
const RATIOS = ['3:4', '9:16', '1:1', '4:3', '16:9', '3:4', '21:9', '3:4'];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.goto(base);
await page.waitForFunction(() => window.__rea?.getState().ready, null, { timeout: 90000 });
const jobs = spec ?? (await page.evaluate(() => window.__rea.getState().styles.filter((s) => s.builtIn).map((s) => s.id)))
  .map((id, i) => ({ name: `${String(i + 1).padStart(2, '0')}-${id}`, style: id, ratio: RATIOS[i % RATIOS.length], seed: 'SHOW' + i }));
const meta = [];
for (const j of jobs) {
  const info = await page.evaluate(async (j) => {
    const st = window.__rea.getState();
    st.pickStyle(j.style);
    const s2 = window.__rea.getState();
    const params = { ...s2.params, ...(j.params || {}) };
    if (j.comp) params.composition = j.comp;
    st.set('params', params);
    st.set('ratio', j.ratio);
    if (j.modes) st.set('modes', j.modes);
    st.set('seeds', { layout: j.seed + 'L', text: j.seed + 'T', color: j.seed + 'C', image: j.seed + 'I' });
    st.set('decorSalt', j.decor || '');
    st.set('edits', {});
    st.set('placed', j.placed || []);
    await st.regen(true);
    // components dropped into free slots (the same path as the panel's “drop into free slot” button)
    for (const c of j.slots || []) { window.__rea.getState().addComponent(c); await window.__rea.getState().regen(false); }
    const r = window.__rea.getState().result;
    window.__lastScene = JSON.stringify({ scene: r.scene, grid: r.picked.grid, ratio: j.ratio, imageIds: r.picked.imageIds });
    return { comp: r.picked.comp, ms: r.ms, score: r.picked.quality?.score, audit: r.picked.quality?.audit, direction: r.scene.info.direction, q: r.picked.quality ? Object.fromEntries(Object.entries(r.picked.quality).filter(([k, v]) => typeof v === 'number')) : null, grid: r.picked.grid.type + '/' + r.picked.grid.density, modes: window.__rea.getState().modes };
  }, j);
  const url = await page.evaluate((sc) => window.__reaRaster(sc), j.scale || 1);
  fs.writeFileSync(`${out}/${j.name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  if (process.env.REA_DUMP) fs.writeFileSync(`${out}/${j.name}.json`, await page.evaluate(() => window.__lastScene));
  meta.push({ ...j, ...info });
  console.log(j.name, info.comp, info.ms.toFixed(1) + 'ms', 'score', info.score);
}
fs.writeFileSync(`${out}/index.json`, JSON.stringify(meta, null, 2));
if (errs.length) console.log('ERRORS', errs.slice(0, 10));
await browser.close();
