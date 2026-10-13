// Converts rating exports from /rate.html (ready-poster-printer-ratings-*.json; older poster-printer-ratings-*.json too) into train.csv rows for the taste model.
// usage: node scripts/taste/ratings-to-csv.mjs <ratings.json> [more.json…] [--set U1] [--out scripts/taste/train.csv] [--replace]
// Appends by default (rows of the same set are replaced first). y = the 1–9 rating, the same scale as the by-eye labels.
// Phase 10: ratings made with finer steps (record.step < 1) go to set <set>f (train_user.py reads them as ±0.25, integer
// ratings as the interval [r, r+1)); A/B judgements (export.pairs) are written to pairs.csv for the pairwise loss.
// Features are the exact sceneFeatures() recorded when the poster was rated; each export also carries the entry/scene to re-create it.
import fs from 'node:fs';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const set = opt('--set', 'U1'), out = opt('--out', new URL('./train.csv', import.meta.url).pathname);
const replace = args.includes('--replace'); const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) { console.error('usage: node scripts/taste/ratings-to-csv.mjs <ratings.json…> [--set U1] [--out train.csv] [--replace]'); process.exit(1); }
let header = null, rows = [];
if (!replace && fs.existsSync(out)) { const lines = fs.readFileSync(out, 'utf8').split('\n').filter(Boolean); header = lines[0].split(','); rows = lines.slice(1).filter((l) => !l.startsWith(set + ',') && !l.startsWith(set + 'f,')); }
let n = 0, skipped = 0, filled = 0;
let server = null;
/** load the app's sceneFeatures() through Vite's SSR loader (no build step) */
async function featuresFn() {
  if (!server) {
    const { createServer } = await import('vite');
    server = await createServer({ root: new URL('../..', import.meta.url).pathname, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  }
  const m = await server.ssrLoadModule('/src/engine/aesthetic/features.ts');
  return (scene) => m.sceneFeatures(scene);
}
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (j.kind !== 'ratings') throw new Error(`${f}: not a ratings export`);
  const names = j.featureNames;
  if (!header) header = ['set', 'name', 'y', ...names];
  const cols = header.slice(3);
  const missing = cols.filter((c) => !names.includes(c));
  // phase 7 compatibility: an export from an older generator lacks newer features. Exports carry the scene, so the
  // current sceneFeatures() recomputes every column from it; ratings without a scene get 0 for the missing columns.
  let fx = null;
  if (missing.length) {
    console.warn(`${f}: ${missing.length} feature(s) newer than this export (${missing.slice(0, 4).join(', ')}…): recomputing from the stored scenes`);
    fx = await featuresFn();
  }
  for (const r of j.ratings) {
    if (!(r.rating >= 1 && r.rating <= 9) || !r.features) { skipped++; continue; }
    let feats = r.features;
    if (fx) {
      if (r.scene) feats = fx(r.scene);
      else { filled++; feats = { ...r.features }; }
    }
    rows.push([r.step && r.step < 1 ? set + 'f' : set, `rate/${r.id}`, r.rating, ...cols.map((c) => +(+(feats[c] ?? 0)).toFixed(5))].join(','));
    n++;
  }
}
// A/B pairs → pairs.csv (set, name, w = 1 a better / -1 b better / 0 tie, a:features…, b:features…)
const pairRows = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const p of j.pairs ?? []) {
    let fa = p.a.features, fb = p.b.features;
    const cols = header.slice(3);
    if (cols.some((c) => !(c in fa) || !(c in fb))) { const fx = await featuresFn(); if (p.a.scene) fa = fx(p.a.scene); if (p.b.scene) fb = fx(p.b.scene); }
    pairRows.push([set, `pair/${p.id}`, p.winner === 'a' ? 1 : p.winner === 'b' ? -1 : 0, ...cols.map((c) => +(+(fa[c] ?? 0)).toFixed(5)), ...cols.map((c) => +(+(fb[c] ?? 0)).toFixed(5))].join(','));
  }
}
if (pairRows.length) {
  const pout = new URL('./pairs.csv', import.meta.url).pathname;
  const cols = header.slice(3);
  let prev = fs.existsSync(pout) ? fs.readFileSync(pout, 'utf8').split('\n').filter(Boolean).slice(1).filter((l) => !l.startsWith(set + ',')) : [];
  fs.writeFileSync(pout, [['set', 'name', 'w', ...cols.map((c) => 'a:' + c), ...cols.map((c) => 'b:' + c)].join(','), ...prev, ...pairRows].join('\n'));
  console.log(`${pairRows.length} A/B pairs → ${pout}`);
}
if (server) await server.close();
if (filled) console.warn(`${filled} rating(s) had no stored scene: their newer feature columns were filled with 0 (export with scenes to avoid this)`);
fs.writeFileSync(out, [header.join(','), ...rows].join('\n'));
console.log(`${n} ratings → ${out} as set "${set}"${skipped ? `, ${skipped} skipped` : ''}. Next: cd scripts/taste && python3 train.py && python3 export.py   (export.py args = sets to leave out)`);
