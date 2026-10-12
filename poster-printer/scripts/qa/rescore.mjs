// Re-score stored scenes (dir/*.json written by showcase.mjs with REA_DUMP=1) with the *current* design audit.
// usage: node scripts/qa/rescore.mjs <dir>  → prints a table and writes <dir>/audit.json
import { chromium } from 'playwright';
import fs from 'node:fs';
const dir = process.argv[2];
const base = process.env.REA_URL || 'http://127.0.0.1:5180/';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(base);
await page.waitForFunction(() => window.__rea?.getState().ready, null, { timeout: 90000 });
const idx = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8'));
const out = [];
for (const j of idx) {
  const f = `${dir}/${j.name}.json`;
  if (!fs.existsSync(f)) continue;
  const a = await page.evaluate((s) => window.__reaAudit(s), fs.readFileSync(f, 'utf8'));
  // layout score of that render (overlaps/contrast/clutter) minus the design penalty = comparable "design score"
  const layout = j.q ? Math.max(0, 100 - j.q.overlaps * 14 - j.q.glyphHits * 18 - j.q.lowContrast * 9 - j.q.offCanvas * 6 - j.q.clutter - j.q.empty * 15 - j.q.dropped * 1.5 - j.q.scrims * 2) : j.score;
  out.push({ name: j.name, comp: j.comp, ratio: j.ratio, layout, penalty: a.penalty, score: Math.max(0, layout - a.penalty), parts: a.parts, audit: { blocks: a.blocks, focal: a.focalRatio, quiet: a.quiet, decor: a.decor, accent: a.accent, busy: a.busy, harmony: a.harmony, align: a.align } });
}
fs.writeFileSync(`${dir}/audit.json`, JSON.stringify(out, null, 1));
const avg = (k) => out.reduce((s, x) => s + x[k], 0) / out.length;
console.log('n', out.length, 'layout', avg('layout').toFixed(1), 'penalty', avg('penalty').toFixed(1), 'design score', avg('score').toFixed(1));
const pk = Object.keys(out[0].parts);
console.log('penalty parts avg:', pk.map((k) => `${k}=${(out.reduce((s, x) => s + x.parts[k], 0) / out.length).toFixed(2)}`).join(' '));
await browser.close();
