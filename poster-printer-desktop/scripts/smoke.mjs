// Smoke test for the desktop app, driven by Playwright's Electron support (the web app's node_modules).
// usage: node scripts/smoke.mjs [path/to/Ready Poster Printer.app] [outDir]
//   no app path → runs the unpackaged app (electron .) against ../poster-printer/dist
// Uses a throwaway profile (RPP_USER_DATA), so the real app's data is never touched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { _electron } = await import(path.join(root, '../poster-printer/node_modules/playwright/index.mjs'));
const appPath = process.argv[2] && process.argv[2].endsWith('.app') ? path.resolve(process.argv[2]) : null;
const out = path.resolve(process.argv.slice(2).find((a) => a && !a.endsWith('.app')) || path.join(os.tmpdir(), 'rpp-smoke'));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'downloads'), { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rpp-profile-'));
const sample = path.join(root, '../poster-printer/public/images/figure-48893.jpg');
const RATIOS = ['3:4', '9:16', '1:1', '4:3', '16:9', '21:9', '1:2.1'];

const fails = []; let passes = 0;
const check = (cond, msg) => { if (cond) { passes++; console.log('  ✓ ' + msg); } else { fails.push(msg); console.log('  ✗ ' + msg); } };
const crashDir = path.join(os.homedir(), 'Library/Logs/DiagnosticReports');
const crashes = () => { try { return fs.readdirSync(crashDir).filter((f) => /Ready Poster Printer|Electron|cut-out/i.test(f)); } catch { return []; } };
const crashesBefore = new Set(crashes());

async function launch() {
  const opts = { env: { ...process.env, RPP_USER_DATA: profile }, timeout: 60000 };
  const app = appPath
    ? await _electron.launch({ ...opts, executablePath: path.join(appPath, 'Contents/MacOS', path.basename(appPath, '.app')) })
    : await _electron.launch({ ...opts, executablePath: path.join(root, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'), args: [root], cwd: root });
  const page = await app.firstWindow();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.waitForFunction(() => window.__rea?.getState().ready && window.__rea.getState().scene, null, { timeout: 90000 });
  await page.waitForSelector('.frame .paper svg');
  return { app, page, errs };
}
const st = (page, fn) => page.evaluate(`(() => { const s = window.__rea.getState(); return (${fn})(s); })()`);

console.log(appPath ? `packaged: ${appPath}` : 'unpackaged (electron .)');
let { app, page, errs } = await launch();
const wait = (ms) => page.waitForTimeout(ms);

// 1. shell: origin, engine, glass, window, main-process wiring
const info = await page.evaluate(() => ({ href: location.href, ua: navigator.userAgent, glass: document.documentElement.dataset.glass, fonts: document.fonts.size, w: innerWidth, h: innerHeight }));
console.log(`  ${info.ua.match(/Chrome\/[\d.]+/)?.[0]} · ${info.w}×${info.h} · glass=${info.glass} · ${info.fonts} font faces`);
check(info.href.startsWith('rpp://app/'), 'served from rpp://app/');
check(info.glass === 'backdrop', 'Chromium glass refraction is on');
const mainInfo = await app.evaluate(({ app: a, session, BrowserWindow }) => ({
  name: a.getName(), version: a.getVersion(), packaged: a.isPackaged, dl: session.defaultSession.listenerCount('will-download'),
  title: BrowserWindow.getAllWindows()[0]?.getTitle(), userData: a.getPath('userData'),
}));
check(mainInfo.dl === 1, 'save-dialog download handler registered');
check(mainInfo.userData === profile, 'isolated test profile in use');
console.log(`  app ${mainInfo.name} ${mainInfo.version} · packaged=${mainInfo.packaged} · title "${mainInfo.title}"`);
await page.screenshot({ path: path.join(out, 'app.png') });

// 2. draws on every ratio (dock button and Space), as scripts/qa/e2e.mjs does
for (const r of RATIOS) {
  await page.click(`#seg-ratio button[data-v="${r}"]`); await wait(120);
  for (let i = 0; i < 3; i++) {
    const h0 = await st(page, (s) => s.history.length);
    if (i % 2) await page.keyboard.press('Space'); else await page.click('[data-qa=draw]');
    await wait(160);
    const d = await st(page, (s) => ({ w: s.scene?.w, n: s.history.length, svg: document.querySelectorAll('.frame .paper svg').length }));
    if (!(d.w > 0 && d.svg === 1 && d.n === h0 + 1)) check(false, `draw ${r} #${i}`);
  }
}
check(true, `${RATIOS.length * 3} draws across ${RATIOS.length} ratios`);
await page.click('#seg-ratio button[data-v="3:4"]'); await wait(300);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(out, 'poster.png') });

// 3. export through the real export sheet; downloads redirected to a folder (the app itself shows a save dialog)
await app.evaluate(({ session }, dir) => {
  session.defaultSession.removeAllListeners('will-download');
  session.defaultSession.on('will-download', (_e, item) => item.setSavePath(dir + '/' + item.getFilename()));
}, path.join(out, 'downloads'));
for (const [fmt, scale] of [['png', '2'], ['svg', null]]) {
  await page.click('#btn-export'); await wait(300);
  await page.click(`[data-fmt=${fmt}]`); if (scale) await page.click(`#seg-scale button[data-v="${scale}"]`);
  await page.click('[data-qa=do-export]');
  let f = null;
  for (let i = 0; i < 100 && !f; i++) { await wait(200); f = fs.readdirSync(path.join(out, 'downloads')).find((x) => x.endsWith('.' + fmt)); }
  await wait(300);
  const buf = f ? fs.readFileSync(path.join(out, 'downloads', f)) : Buffer.alloc(0);
  if (fmt === 'png') check(buf.length > 20000 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(16) > 1000, `PNG export saved (${f}, ${buf.length ? buf.readUInt32BE(16) : 0}px wide)`);
  else check(buf.toString('utf8').includes('<svg') && buf.toString('utf8').includes('<text'), `SVG export saved (${f})`);
  await page.keyboard.press('Escape'); await wait(200);
}

// 4. AI cut-out: health, then upload + scissors in the image library, exactly as a user does it
const health = await page.evaluate(() => fetch('/api/health').then((r) => r.json()));
check(health.ok === true, `/api/health ok (${JSON.stringify(health)})`);
await page.click('.rail-l [data-lib="images"]'); await wait(400);
await page.setInputFiles('#library input[type=file][accept="image/*"]', sample);
await page.waitForFunction(() => window.__rea.getState().userImages?.length === 1, null, { timeout: 20000 });
check(true, 'image uploaded into the library');
const t0 = Date.now();
await page.waitForSelector('#library .busy', { state: 'detached', timeout: 20000 }).catch(() => {});
const scissors = page.locator('.img-item .img-tools button:first-child');
for (let i = 0; i < 6 && !(await scissors.isVisible()); i++) { // the tools show on hover; the list re-renders after an upload
  await page.mouse.move(0, 0); await page.hover('.img-item:has(.img-tools)'); await wait(250);
}
await scissors.click();
await page.waitForFunction(() => window.__rea.getState().userImages?.[0]?.cutout, null, { timeout: 60000 }).catch(() => {});
const cut = await st(page, (s) => { const u = s.userImages[0]; return { ok: !!u.cutout && u.cutout.startsWith('data:image/png'), len: u.cutout?.length ?? 0, subject: u.subject }; });
check(cut.ok && cut.len > 10000, `AI cut-out via the scissors button (${Date.now() - t0} ms, ${Math.round(cut.len / 1024)} KB, subject ${JSON.stringify(cut.subject)})`);
await page.screenshot({ path: path.join(out, 'cutout.png') });

// 5. deck view and palette page
await page.goto('rpp://app/?view=deck'); await wait(1500);
check(await page.evaluate(() => document.body.innerText.length > 50 && !!document.querySelector('#root *')), 'deck view renders');
await page.screenshot({ path: path.join(out, 'deck.png') });
await page.goto('rpp://app/color.html'); await wait(1500);
check(await page.evaluate(() => document.querySelectorAll('a[href="./?view=deck"]').length > 0), 'palette page renders');
await page.screenshot({ path: path.join(out, 'palettes.png') });

// 6. external links leave the app: window.open → system browser (stubbed here), never an in-app window
await app.evaluate(({ shell }) => { globalThis.__opened = []; shell.openExternal = async (u) => { globalThis.__opened.push(u); }; });
const popup = await page.evaluate(() => window.open('https://github.com/ALBEDO-TABAI/ready-poster-printer') === null);
await wait(300);
const opened = await app.evaluate(() => globalThis.__opened);
check(popup && opened.length === 1, 'external link goes to the system browser');
check(errs.length === 0, `no console errors (${errs.length})`); if (errs.length) console.log(errs.slice(0, 8).join('\n'));

// 7. data survives a restart (same origin, same profile); quit leaves no crash report
const before = await page.evaluate(async () => { location.href = 'rpp://app/'; return true; });
await page.waitForFunction(() => window.__rea?.getState().ready, null, { timeout: 60000 });
const hist = await st(page, (s) => ({ users: s.userImages.length, cut: !!s.userImages[0]?.cutout }));
await app.close();
({ app, page, errs } = await launch());
const after = await st(page, (s) => ({ users: s.userImages.length, cut: !!s.userImages[0]?.cutout, lang: s.lang }));
check(before && hist.users === 1 && after.users === 1 && after.cut, `uploaded image + cut-out persist across restart (${JSON.stringify(after)})`);
await app.close();
await new Promise((r) => setTimeout(r, 3000));
const newCrashes = crashes().filter((f) => !crashesBefore.has(f));
check(newCrashes.length === 0, `no crash reports after quitting (${newCrashes.join(', ') || 'none'})`);

fs.rmSync(profile, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails.length} failed · screenshots in ${out}`);
process.exit(fails.length ? 1 : 0);
