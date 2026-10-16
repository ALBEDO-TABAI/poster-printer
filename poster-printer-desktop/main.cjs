// Ready Poster Printer — macOS desktop shell (Electron).
// Serves the built web app from rpp://app/ (a fixed origin, so IndexedDB / localStorage persist between launches)
// and answers /api/health + /api/cutout (the same contract as server/serve.py) through a cut-out utility process.
'use strict';
const { app, BrowserWindow, Menu, protocol, shell, session, dialog, utilityProcess } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SCHEME = 'rpp';
const ORIGIN = `${SCHEME}://app`;
const REPO = 'https://github.com/ALBEDO-TABAI/ready-poster-printer';
const MAX_BYTES = 20 * 1024 * 1024;

const WEB_ROOT = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'poster-printer', 'dist');
const MODEL = app.isPackaged ? path.join(process.resourcesPath, 'models', 'isnet-general-use.onnx') : path.join(__dirname, 'models', 'isnet-general-use.onnx');

if (process.env.RPP_USER_DATA) app.setPath('userData', process.env.RPP_USER_DATA); // isolated profile for scripts/smoke.mjs

const zh = () => (app.getPreferredSystemLanguages()[0] || app.getLocale() || '').toLowerCase().startsWith('zh');
const L = (z, e) => (zh() ? z : e);

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.webm': 'video/webm', '.mp4': 'video/mp4',
};

/* ---------- AI cut-out: cutout-worker.cjs in a utility process, started on first use ---------- */
const IDLE_MS = 5 * 60 * 1000; // frees the model's memory (~0.5 GB) when nobody has cut anything out for a while
let worker = null, seq = 0, idle = null, used = false;
const pending = new Map();

function killWorker() {
  clearTimeout(idle);
  if (!worker) return;
  const w = worker; worker = null;
  try { process.kill(w.pid, 'SIGKILL'); } catch { /* already gone */ }
}

function ensureWorker() {
  if (worker) return worker;
  used = false;
  const w = utilityProcess.fork(path.join(__dirname, 'cutout-worker.cjs'), [], { serviceName: 'Ready Poster Printer cut-out' });
  w.on('message', (m) => {
    const p = pending.get(m.id); if (!p) return;
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error)); else { used = true; p.resolve(Buffer.from(m.png)); }
  });
  w.on('exit', () => {
    if (worker === w) worker = null;
    for (const p of pending.values()) p.reject(new Error('cut-out process stopped'));
    pending.clear();
  });
  return (worker = w);
}

function requestCutout(image) {
  clearTimeout(idle);
  const w = ensureWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, model: MODEL, image: new Uint8Array(image) });
  }).finally(() => { if (!pending.size) idle = setTimeout(killWorker, IDLE_MS); });
}

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

async function handle(req) {
  const url = new URL(req.url);
  if (url.host !== 'app') return new Response('not found', { status: 404 });
  let p;
  try { p = decodeURIComponent(url.pathname).replace(/\/+$/, ''); } catch { return new Response('bad request', { status: 400 }); }

  if (p === '/api/health' || p === '/api/cutout/health') {
    const ok = fs.existsSync(MODEL);
    return json(ok ? 200 : 503, { ok, model: 'isnet-general-use', loaded: Boolean(worker && used) });
  }
  if (p === '/api/cutout') {
    if (req.method !== 'POST') return json(405, { error: 'POST an image' });
    if (!fs.existsSync(MODEL)) return json(503, { error: 'AI cut-out model missing' });
    const body = Buffer.from(await req.arrayBuffer());
    if (!body.length || body.length > MAX_BYTES) return json(413, { error: 'empty or too large' });
    try {
      const png = await requestCutout(body);
      return new Response(png, { status: 200, headers: { 'Content-Type': 'image/png' } });
    } catch (e) {
      return json(400, { error: String((e && e.message) || e) });
    }
  }
  if (p.startsWith('/api/')) return json(404, { error: 'not found' });

  const file = path.normalize(path.join(WEB_ROOT, p === '' ? 'index.html' : p));
  if (file !== WEB_ROOT && !file.startsWith(WEB_ROOT + path.sep)) return new Response('forbidden', { status: 403 });
  try {
    const data = await fs.promises.readFile(fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file);
    return new Response(data, { status: 200, headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' } });
  } catch {
    return new Response('not found', { status: 404 });
  }
}

/* ---------- window ---------- */
const STATE = () => path.join(app.getPath('userData'), 'window-state.json');
function loadBounds() {
  try { return JSON.parse(fs.readFileSync(STATE(), 'utf8')); } catch { return null; }
}
function saveBounds(win) {
  try { fs.writeFileSync(STATE(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch { /* read-only home */ }
}

const isInternal = (u) => u.startsWith(ORIGIN + '/') || u === ORIGIN;
function openOutside(u) {
  if (/^(https?|mailto):/i.test(u)) shell.openExternal(u);
}

let win = null;
function createWindow() {
  const { screen } = require('electron');
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const saved = loadBounds();
  const visible = saved && screen.getAllDisplays().some((d) => {
    const b = d.workArea; return saved.x < b.x + b.width - 80 && saved.x + saved.width > b.x + 80 && saved.y >= b.y - 20 && saved.y < b.y + b.height - 80;
  });
  win = new BrowserWindow({
    width: visible ? saved.width : Math.min(1600, Math.round(wa.width * 0.9)),
    height: visible ? saved.height : Math.min(1000, Math.round(wa.height * 0.9)),
    ...(visible ? { x: saved.x, y: saved.y } : { center: true }),
    minWidth: 960, minHeight: 640,
    title: 'Ready Poster Printer',
    backgroundColor: '#ebebee', // --stage, so there is no white flash before the splash
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  if (visible && saved.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveBounds(win));
  win.on('closed', () => { win = null; });

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) return { action: 'allow', overrideBrowserWindowOptions: { backgroundColor: '#ebebee', minWidth: 960, minHeight: 640 } };
    openOutside(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => { if (!isInternal(url)) { e.preventDefault(); openOutside(url); } });
  win.loadURL(ORIGIN + '/');
}

/* ---------- exports: the page downloads blobs; ask where to save, starting from the last folder ---------- */
let lastDir = null;
function wireDownloads() {
  session.defaultSession.on('will-download', (_e, item) => {
    const dir = lastDir && fs.existsSync(lastDir) ? lastDir : app.getPath('downloads');
    item.setSaveDialogOptions({ defaultPath: path.join(dir, item.getFilename()) });
    item.once('done', (_ev, state) => {
      if (state !== 'completed') return;
      const saved = item.getSavePath();
      if (saved) { lastDir = path.dirname(saved); app.dock?.downloadFinished(saved); }
    });
  });
}

/* ---------- menu ---------- */
function buildMenu() {
  const nav = (rel) => () => {
    const w = BrowserWindow.getFocusedWindow() || win;
    if (w) w.loadURL(ORIGIN + rel); else { createWindow(); win.loadURL(ORIGIN + rel); }
  };
  const tpl = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: L('关于 Ready Poster Printer', 'About Ready Poster Printer') },
        { type: 'separator' },
        { role: 'services', label: L('服务', 'Services') },
        { type: 'separator' },
        { role: 'hide', label: L('隐藏 Ready Poster Printer', 'Hide Ready Poster Printer') },
        { role: 'hideOthers', label: L('隐藏其他', 'Hide Others') },
        { role: 'unhide', label: L('全部显示', 'Show All') },
        { type: 'separator' },
        { role: 'quit', label: L('退出 Ready Poster Printer', 'Quit Ready Poster Printer') },
      ],
    },
    {
      label: L('编辑', 'Edit'),
      submenu: [
        { role: 'undo', label: L('撤销', 'Undo') },
        { role: 'redo', label: L('重做', 'Redo') },
        { type: 'separator' },
        { role: 'cut', label: L('剪切', 'Cut') },
        { role: 'copy', label: L('拷贝', 'Copy') },
        { role: 'paste', label: L('粘贴', 'Paste') },
        { role: 'pasteAndMatchStyle', label: L('粘贴并匹配样式', 'Paste and Match Style') },
        { role: 'delete', label: L('删除', 'Delete') },
        { role: 'selectAll', label: L('全选', 'Select All') },
      ],
    },
    {
      label: L('前往', 'Go'),
      submenu: [
        { label: L('海报', 'Poster'), accelerator: 'CmdOrCtrl+1', click: nav('/') },
        { label: L('多页', 'Deck'), accelerator: 'CmdOrCtrl+2', click: nav('/?view=deck') },
        { label: L('配色', 'Palettes'), accelerator: 'CmdOrCtrl+3', click: nav('/color.html') },
      ],
    },
    {
      label: L('显示', 'View'),
      submenu: [
        { role: 'reload', label: L('重新载入', 'Reload') },
        { role: 'toggleDevTools', label: L('开发者工具', 'Developer Tools') },
        { type: 'separator' },
        { role: 'resetZoom', label: L('实际大小', 'Actual Size') },
        { role: 'zoomIn', label: L('放大', 'Zoom In') },
        { role: 'zoomOut', label: L('缩小', 'Zoom Out') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: L('进入全屏幕', 'Toggle Full Screen') },
      ],
    },
    {
      role: 'window', label: L('窗口', 'Window'),
      submenu: [
        { role: 'minimize', label: L('最小化', 'Minimize') },
        { role: 'zoom', label: L('缩放', 'Zoom') },
        { type: 'separator' },
        { role: 'front', label: L('前置全部窗口', 'Bring All to Front') },
      ],
    },
    {
      role: 'help', label: L('帮助', 'Help'),
      submenu: [
        { label: L('项目主页（GitHub）', 'Project page (GitHub)'), click: () => shell.openExternal(REPO) },
        { label: L('反馈问题', 'Report an issue'), click: () => shell.openExternal(REPO + '/issues') },
        { type: 'separator' },
        { label: L('许可证与字体、图片、模型来源', 'Licences and credits'), click: () => shell.openPath(app.isPackaged ? path.join(process.resourcesPath, 'licenses') : path.join(__dirname, '..', 'poster-printer', 'licenses')) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ---------- lifecycle ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return createWindow();
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    protocol.handle(SCHEME, handle);
    app.setAboutPanelOptions({
      applicationName: 'Ready Poster Printer',
      applicationVersion: app.getVersion(),
      version: `Electron ${process.versions.electron}`,
      copyright: '© ALBEDO-TABAI · AGPL-3.0',
      website: REPO,
      iconPath: app.isPackaged ? undefined : path.join(__dirname, 'build', 'icon.png'),
    });
    if (!app.isPackaged && app.dock) app.dock.setIcon(path.join(__dirname, 'build', 'icon.png'));
    buildMenu();
    wireDownloads();
    if (!fs.existsSync(path.join(WEB_ROOT, 'index.html'))) {
      dialog.showErrorBox('Ready Poster Printer', `No built web app at ${WEB_ROOT}. Run npm run build in poster-printer/ first.`);
      app.quit();
      return;
    }
    createWindow();
    app.on('activate', () => { if (!win) createWindow(); });
  });

  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', killWorker);
}
