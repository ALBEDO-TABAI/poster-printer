/* ============================================================
   Liquid glass runtime (ES module port of the Poster Printer prototype's js/glass.js)

   Map optics (field + overlay planes) adapted from Glass-HQ/liquid-glass
   — MIT License, Copyright (c) 2026 Glass HQ (commit 9f5bfc7);
   full licence text in licenses/ui/LICENSE-liquid-glass.txt.
   - Bevel refraction: per-size displacement maps (canvas → data URL → <feImage>)
     fed to <feDisplacementMap>, referenced from backdrop-filter on Chromium;
     Firefox gets "mirror lenses" (same filter on a painted copy of the scene);
     Safari keeps native backdrop blur + the specular overlay. Map optics adapted
     from Glass-HQ/liquid-glass (MIT) — see the section header below.
   - Specular light angle follows the pointer (one CSS var on :root, rAF-throttled).
   - Adaptive tint: ambient colour from the poster; luminance sampling for glass over the canvas.
   - Liquid segmented control: thumb stretches toward the target, then the tail catches up.
   - Press "jelly" on release and pointer-follow highlight.
   ============================================================ */
const G = {};
if (typeof window !== 'undefined' && !window.__ppGlass) {
  window.__ppGlass = G;
  const ua = navigator.userAgent;
  const isChromium = !!window.chrome && /Chrom(e|ium)\//.test(ua) && !/Edg\/|OPR\//.test(ua) || /Edg\//.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isSafari = /Safari\//.test(ua) && !/Chrom(e|ium)\//.test(ua);
  G.engine = isChromium ? 'chromium' : isFirefox ? 'firefox' : isSafari ? 'webkit' : 'other';
  // SVG filters inside backdrop-filter only render in Chromium today. Others keep blur+saturate+rim.
  G.refractSupported = isChromium && CSS.supports('backdrop-filter', 'blur(1px)');
  document.documentElement.dataset.engine = G.engine;
  // ?glass=backdrop|mirror|none forces a path (for testing / screenshots)
  const forced = new URLSearchParams(location.search).get('glass');

  const NS = 'http://www.w3.org/2000/svg';
  let defs;
  function ensureDefs() {
    if (defs) return defs;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
    svg.setAttribute('aria-hidden', 'true');
    defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }

  /* ---------------------------------------------------------------
     Material maps — optics adapted from Glass-HQ/liquid-glass (MIT,
     © 2026 Glass HQ; see licenses/ui/LICENSE-liquid-glass.txt):
       · packages/liquid-glass/src/core/optics.ts  edgeDisplacement()
       · packages/liquid-glass/src/gpu/maps.wgsl   field + overlay planes
     Their maps are rendered with WebGPU (vgpu/WGSL); here the same
     formulas run once per surface size on a Canvas2D ImageData, so no
     WebGPU adapter is needed and every engine gets identical maps.
     Field plane: R,G = 0.5 − n·edge·0.5 (n = outward normal), where
       edge = 1 − √((2 − depth)·depth), depth = sat(−d / bevel)
     — a convex circular lens profile: displacement is maximal at the
     rim and eases to zero `bevel` px inside (vs. our v1 smoothstep).
     Overlay plane: a 0.9px specular stroke lit from the top and bottom
     (|n.y|), a soft inner diffuse glow, and a dark side shade (n.x).
     --------------------------------------------------------------- */
  const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  // signed distance (negative inside, CSS px) + outward normal of a rounded rect centred at 0
  function sdRect(px, py, hw, hh, r) {
    const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
    let d, nx, ny;
    if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1e-5; d = l - r; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py); }
    else if (qx > qy) { d = qx - r; nx = Math.sign(px) || 1; ny = 0; }
    else { d = qy - r; nx = 0; ny = Math.sign(py) || 1; }
    return [d, nx, ny];
  }
  function fieldMap(w, h, r, bevel, pad = 0) {
    const k = 0.5; // half resolution; feImage scales it up smoothly
    const W = Math.max(2, Math.round((w + 2 * pad) * k)), H = Math.max(2, Math.round((h + 2 * pad) * k));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(W, H); const a = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = (x + 0.5) / k - w / 2 - pad, py = (y + 0.5) / k - h / 2 - pad;
      const [d, nx, ny] = sdRect(px, py, w / 2, h / 2, r);
      const depth = sat(-d / bevel);
      const edge = d > 0 ? 0 : 1 - sat(Math.sqrt((2 - depth) * depth));
      const i = (y * W + x) * 4;
      a[i] = Math.round((0.5 - nx * edge * 0.5) * 255); a[i + 1] = Math.round((0.5 - ny * edge * 0.5) * 255); a[i + 2] = 128; a[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return c.toDataURL('image/png');
  }
  function overlayMap(w, h, r, dark) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(W, H); const a = img.data;
    const aa = 1 / dpr, cs = Math.cos(1.08), cd = Math.cos(1.08 * 0.65), cside = Math.cos(0.98), mix = (p, q, t) => p + (q - p) * t;
    const dk = dark ? 1 : 0;
    for (let y = 0; y < H; y++) {
      const py = (y + 0.5) / dpr - h / 2;
      for (let x = 0; x < W; x++) {
        const px = (x + 0.5) / dpr - w / 2;
        const [d, nx, ny] = sdRect(px, py, w / 2, h / 2, r);
        if (d < -6) continue; // interior: fully transparent, skip the maths
        const coverage = sat(0.5 - d / aa);
        const directional = Math.pow(sat((Math.abs(ny) - cs) / (1 - cs)), 1.25);
        const diffuseDir = Math.pow(sat((Math.abs(ny) - cd) / (1 - cd)), 1.25);
        const stroke = sat((d + 0.9) / aa + 0.5) * sat(0.5 - d / aa);
        let spec = directional * stroke; spec = spec / (1 + 0.5 * (1 - spec));
        const diffuse = diffuseDir * 0.18 * Math.pow(1 - sat(-d / 4.5), 2) * coverage;
        const hl = sat(spec * mix(1, 0.82, dk) + diffuse * mix(1, 0.4, dk));
        const adj = d - 0.5, falloff = 1 - sat(-adj / 0.5), ramp = mix(falloff > 0 ? 1 : 0, falloff, 0.75);
        const outline = ramp * sat((adj + 0.5) / aa + 0.5) * sat(-adj / aa + 0.5);
        const w1 = sat((nx - cside) / (1 - cside)) * outline, w2 = sat((-nx - cside) / (1 - cside)) * outline;
        const shade = (w1 / (1 + 0.4 * (1 - w1)) + w2 / (1 + 0.4 * (1 - w2))) * mix(0.48, 0.6, dk);
        const alpha = hl + shade * (1 - hl);
        if (alpha <= 0.002) continue;
        const light = mix(1, 0.82, dk) * hl / Math.max(alpha, 1e-5);
        const i = (y * W + x) * 4; const v = Math.round(light * 255);
        a[i] = v; a[i + 1] = v; a[i + 2] = v; a[i + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(img, 0, 0); return c.toDataURL('image/png');
  }

  /* Filter graph: field map → displacement, optionally split per channel
     (R pushed slightly further, B slightly less) for subtle chromatic
     aberration at the rim, recombined additively. Blur/saturation stay in
     CSS after url() so Chromium keeps its fast edge-clamped backdrop blur. */
  const cache = new Map(), ovCache = new Map();
  let fid = 0;
  const CH = { R: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', G: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', B: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' };
  function el(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  const ready = new Map();
  /* set a filter property now and once more after its displacement map is decoded */
  function assertFilter(el, prop, id, value) {
    el.style[prop] = value; el.__lgf = id;
    const pr = ready.get(id); if (!pr) return;
    pr.then(() => requestAnimationFrame(() => {
      if (el.__lgf !== id) return;                   // superseded meanwhile
      el.style[prop] = value + ' saturate(1)';
    }));
  }
  function filterFor(w, h, r, bevel, scale, ca, pad = 0, blur = 0, satv = 1) {
    const sw = Math.round(w / 2) * 2, sh = Math.round(h / 2) * 2, W = sw + 2 * pad, H = sh + 2 * pad;
    const key = [sw, sh, Math.round(r), bevel, scale, ca, pad, blur, satv].join('x');
    if (cache.has(key)) return cache.get(key);
    const id = 'lgf' + (fid++);
    const f = el('filter', { id, x: '0', y: '0', width: String(W), height: String(H), filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
    const href = fieldMap(sw, sh, r, bevel, pad);
    /* feImage decodes asynchronously; Chromium resolves a backdrop/element filter whose image
       is not decoded yet as a no-op and does not invalidate it afterwards. Track decode so
       callers can re-assert the filter once the map exists. */
    const im = new Image(); im.src = href; ready.set(id, im.decode().catch(() => {}));
    f.append(el('feImage', { href, x: '0', y: '0', width: String(W), height: String(H), preserveAspectRatio: 'none', result: 'map' }));
    if (!ca) {
      f.append(el('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: String(scale), xChannelSelector: 'R', yChannelSelector: 'G' }));
    } else {
      [['R', 1 + ca], ['G', 1], ['B', 1 - ca]].forEach(([c, m]) => {
        f.append(el('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: (scale * m).toFixed(2), xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + c }));
        f.append(el('feColorMatrix', { in: 'd' + c, type: 'matrix', values: CH[c], result: 'c' + c }));
      });
      f.append(el('feComposite', { in: 'cR', in2: 'cG', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0', result: 'rg' }));
      f.append(el('feComposite', { in: 'rg', in2: 'cB', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0' }));
    }
    /* Frost inside the graph (CSS blur() after url() is dropped at device-scale 2 in Chromium).
       The blur reads transparent pixels past the surface edge; SVG blurs premultiplied, so
       re-opaquing alpha afterwards (feFuncA slope 4) yields the average of the inside pixels
       only — an edge-clamped blur without needing edgeMode support. */
    if (blur > 0) {
      f.append(el('feGaussianBlur', { stdDeviation: String(blur) }));
      const ct = el('feComponentTransfer', {}); ct.append(el('feFuncA', { type: 'linear', slope: '4', intercept: '0' })); f.append(ct);
    }
    if (satv !== 1) f.append(el('feColorMatrix', { type: 'saturate', values: String(satv) }));
    ensureDefs().appendChild(f);
    cache.set(key, id);
    return id;
  }
  function overlayFor(w, h, r, dark) {
    const key = [Math.round(w), Math.round(h), Math.round(r), dark ? 1 : 0].join('x');
    if (!ovCache.has(key)) ovCache.set(key, overlayMap(Math.round(w), Math.round(h), r, dark));
    return ovCache.get(key);
  }

  /* Materials (blur = CSS px std-dev, sat = saturation). "clear" floats over
     imagery and keeps refraction legible; "regular" frosts more for panels. */
  const MAT = { clear: { blur: 3, sat: 1.7 }, regular: { blur: 12, sat: 1.8 }, thick: { blur: 22, sat: 1.85 } };
  /* WebKit renders url() filters on HTML lenses unreliably (the feImage map / blur is dropped
     and the lens shows the scene unfiltered), so Safari keeps its excellent native backdrop
     blur + our specular/rim overlay ('none' = no displacement). Gecko gets mirror lenses. */
  const isWebKit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(navigator.userAgent);
  G.mode = ['backdrop', 'mirror', 'none'].includes(forced) ? forced : G.refractSupported ? 'backdrop' : isWebKit ? 'none' : 'mirror';
  document.documentElement.dataset.glass = G.mode;
  function geometry(el) {
    // offsetWidth/Height ignore transforms (panels animate with scale)
    const w = el.offsetWidth, h = el.offsetHeight;
    const cs = getComputedStyle(el);
    const rad = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, h / 2, w / 2);
    return { w, h, rad };
  }
  function applyRefraction(el) {
    const off = document.documentElement.classList.contains('reduce-transparency') || matchMedia('(prefers-reduced-transparency: reduce)').matches;
    const { w, h, rad } = geometry(el);
    if (w < 8 || h < 8) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    const mat = MAT[el.dataset.mat || 'regular'] || MAT.regular;
    // specular / rim-shade overlay works in every engine (plain CSS background image)
    if (!off) el.style.setProperty('--lg-ov', `url(${overlayFor(w, h, rad, dark)})`); else el.style.removeProperty('--lg-ov');
    if (off) { el.style.backdropFilter = ''; el.style.webkitBackdropFilter = ''; return; }
    const bevel = Number(el.dataset.bevel || Math.min(24, Math.max(10, rad * 0.9)));
    const scale = Number(el.dataset.refract || 36);
    const ca = Number(el.dataset.ca || 0);
    const blur = el.dataset.blur != null ? Number(el.dataset.blur) : mat.blur;
    if (G.mode === 'backdrop') {
      const id = filterFor(w, h, rad, bevel, scale, ca, 0, blur, mat.sat);
      assertFilter(el, 'backdropFilter', id, `url(#${id})`);
    } else if (G.mode === 'mirror') {
      mirrorSetup(el, filterFor(w, h, rad, bevel, scale, ca, PAD, blur, mat.sat));
    }
  }
  /* phase 20: while the layout glides (body.shifting, ~420 ms) every surface shows a plain blur, so a surface that
     changes size mid-glide (the dock folding its labels) waits: its maps are built once, at the size it settles on —
     not for every intermediate width (a new filter + canvas maps per frame was the main cost of a panel toggle) */
  const shifting = () => document.body.classList.contains('shifting');
  const later = new Set(); let laterT = 0;
  const flushLater = () => { laterT = 0; if (shifting()) { laterT = setTimeout(flushLater, 90); return; } const l = [...later]; later.clear(); l.forEach(applyRefraction); };
  const refractSoon = (el) => { if (!shifting()) { applyRefraction(el); return; } later.add(el); if (!laterT) laterT = setTimeout(flushLater, 90); };
  const ro = new ResizeObserver((entries) => { for (const e of entries) refractSoon(e.target); });
  G.refract = (root = document) => root.querySelectorAll('[data-refract]').forEach((el) => { if (!el.__lg) { el.__lg = 1; ro.observe(el); } refractSoon(el); });
  G.refreshAll = () => { document.querySelectorAll('[data-refract]').forEach(applyRefraction); G.kick(50); };

  /* ---------------------------------------------------------------
     Mirror lenses (Firefox / Safari). backdrop-filter:url() is
     Chromium-only, but every engine applies SVG filters to an
     element's OWN pixels — the same observation liquid-glass builds
     on (it filters a live content layer, and in Gecko paints a
     per-surface -moz-element() copy). We know exactly what sits under
     our glass — the ambient field, the dot grid and the poster — so
     each surface gets a clipped .lg-lens layer that paints those
     layers at their true screen position and refracts them with the
     same field map. Positions are re-synced on a short rAF burst
     whenever anything moves (G.kick), never continuously.
     --------------------------------------------------------------- */
  const PAD = 24; // the lens paints 24px beyond the surface so blur/displacement never sample transparency
  G.scene = { field: '', poster: '', posterEl: null, dots: '' };
  function mirrorSetup(el, id) {
    let lens = el.__lens;
    if (!lens) {
      const wrap = document.createElement('i'); wrap.className = 'lg-lens'; wrap.setAttribute('aria-hidden', 'true');
      lens = document.createElement('i'); wrap.appendChild(lens); el.prepend(wrap); el.__lens = lens; el.classList.add('has-lens');
      lenses.add(el);
      /* hosts re-render via innerHTML (inspector, sheets, ctxbar): put the lens back first */
      new MutationObserver(() => { if (wrap.parentNode !== el) { el.prepend(wrap); syncLens(el); } }).observe(el, { childList: true });
    }
    assertFilter(lens, 'filter', id, `url(#${id})`);
    syncLens(el);
  }
  const lenses = new Set();
  function syncLens(el) {
    const lens = el.__lens; if (!lens || !el.isConnected) { lenses.delete(el); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const sx = r.width / el.offsetWidth || 1, sy = r.height / el.offsetHeight || 1; // undo ancestor/self scale
    const ox = r.left - PAD * sx, oy = r.top - PAD * sy;
    const sc = G.scene, layers = [], pos = [], size = [];
    const pe = sc.posterEl && sc.posterEl.isConnected ? sc.posterEl.getBoundingClientRect() : null;
    if (pe && pe.width && sc.poster) { layers.push(`url("${sc.poster}")`); pos.push(`${(pe.left - ox) / sx}px ${(pe.top - oy) / sy}px`); size.push(`${pe.width / sx}px ${pe.height / sy}px`); }
    if (sc.dots) { layers.push(sc.dots); pos.push(`${(24 - ox) / sx}px ${(24 - oy) / sy}px`); size.push(`${24 / sx}px ${24 / sy}px`); }
    if (sc.field) { layers.push(`url("${sc.field}")`); pos.push(`${-ox / sx}px ${-oy / sy}px`); size.push(`${innerWidth / sx}px ${innerHeight / sy}px`); }
    lens.style.backgroundImage = layers.join(',');
    lens.style.backgroundPosition = pos.join(',');
    lens.style.backgroundSize = size.join(',');
  }
  let kickUntil = 0, kickRaf = 0;
  G.kick = (ms = 700) => {
    if (G.mode !== 'mirror') return;
    kickUntil = Math.max(kickUntil, performance.now() + ms);
    if (kickRaf) return;
    const loop = () => { lenses.forEach(syncLens); kickRaf = performance.now() < kickUntil ? requestAnimationFrame(loop) : 0; };
    kickRaf = requestAnimationFrame(loop);
  };
  // anything that transitions (panels, dock, frame) re-syncs lenses for its duration
  document.addEventListener('transitionrun', () => G.kick(700), true);
  document.addEventListener('animationstart', () => G.kick(700), true);
  window.addEventListener('resize', () => G.kick(300));

  /* Ambient field: a pre-blurred render of the current poster over the stage
     colour, sized to the viewport. Used as the stage background in every
     engine, and replayed inside mirror lenses at identical geometry. */
  G.buildField = (img, posterRect, stage, strength = 0.5) => {
    const W = 192, H = Math.max(2, Math.round(192 * innerHeight / innerWidth));
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    if (img && img.naturalWidth && posterRect) {
      const k = W / innerWidth;
      const cx = (posterRect.left + posterRect.width / 2) * k, cy = (posterRect.top + posterRect.height / 2) * k;
      const pw = posterRect.width * k * 1.9, ph = posterRect.height * k * 1.9;
      ctx.globalAlpha = strength;
      if ('filter' in ctx) { ctx.filter = 'blur(9px) saturate(1.5)'; ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph); ctx.filter = 'none'; }
      else { // no canvas filter (older Safari): downsample hard, then upscale = soft
        const t = document.createElement('canvas'); t.width = 8; t.height = 10; t.getContext('2d').drawImage(img, 0, 0, 8, 10);
        ctx.imageSmoothingQuality = 'high'; ctx.drawImage(t, cx - pw / 2, cy - ph / 2, pw, ph);
      }
      ctx.globalAlpha = 1;
    }
    return c.toDataURL('image/jpeg', 0.9);
  };
  G.setScene = (o) => { Object.assign(G.scene, o); lenses.forEach(syncLens); };

  /* ---- specular light follows the pointer ---- */
  let lx = 0.3, ly = 0.2, raf = 0;
  window.addEventListener('pointermove', (e) => {
    lx = e.clientX / innerWidth - 0.5; ly = e.clientY / innerHeight - 0.5;
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      const a = Math.atan2(ly, lx) * 180 / Math.PI + 90 + 180; // light comes from pointer side
      document.documentElement.style.setProperty('--la', a.toFixed(1) + 'deg');
    });
  }, { passive: true });

  /* ---- pointer highlight + jelly release ---- */
  document.addEventListener('pointermove', (e) => {
    const h = e.target.closest && e.target.closest('.hl');
    if (!h) return;
    const r = h.getBoundingClientRect();
    h.style.setProperty('--hx', (e.clientX - r.left) + 'px'); h.style.setProperty('--hy', (e.clientY - r.top) + 'px');
  }, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    const p = e.target.closest && e.target.closest('.press');
    if (!p) return;
    const r = p.getBoundingClientRect();
    p.style.setProperty('--ox', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    p.style.setProperty('--oy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    const up = () => { p.classList.remove('jelly'); void p.offsetWidth; p.classList.add('jelly'); setTimeout(() => p.classList.remove('jelly'), 600); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointerup', up);
  });

  /* ---- adaptive tint ---- */
  const lumCanvas = document.createElement('canvas'); lumCanvas.width = 32; lumCanvas.height = 32;
  const lumCtx = lumCanvas.getContext('2d', { willReadFrequently: true });
  let lumReady = false;
  G.setAmbient = (hex, imgEl) => {
    const n = parseInt(hex.slice(1), 16);
    document.documentElement.style.setProperty('--amb', `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`);
    lumReady = false;
    if (imgEl) {
      const draw = () => { try { lumCtx.drawImage(imgEl, 0, 0, 32, 32); lumReady = true; } catch { lumReady = false; } };
      if (imgEl.complete) draw(); else imgEl.addEventListener('load', draw, { once: true });
    }
  };
  /** luminance (0–1) of the poster under a viewport rect, given the poster's viewport rect */
  G.lumUnder = (rect, posterRect) => {
    if (!lumReady) return 0.5;
    const x0 = Math.max(0, Math.floor((rect.left - posterRect.left) / posterRect.width * 32));
    const x1 = Math.min(31, Math.ceil((rect.right - posterRect.left) / posterRect.width * 32));
    const y0 = Math.max(0, Math.floor((rect.top - posterRect.top) / posterRect.height * 32));
    const y1 = Math.min(31, Math.ceil((rect.bottom - posterRect.top) / posterRect.height * 32));
    if (x1 < x0 || y1 < y0) return null;
    const d = lumCtx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return s / (d.length / 4) / 255;
  };
  G.adapt = (el, posterRect) => {
    const l = G.lumUnder(el.getBoundingClientRect(), posterRect);
    el.classList.toggle('on-dark', l != null && l < 0.5);
    el.classList.toggle('on-light', l != null && l >= 0.5);
  };

  /* ---- liquid segmented control ----
     markup: <div class="seg" data-seg="name"><span class="seg-thumb"></span><button data-v>…</button>…</div> */
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
  function place(seg, btn, animate) {
    const th = seg.querySelector(':scope > .seg-thumb'); if (!th || !btn) return;
    const l = btn.offsetLeft, w = btn.offsetWidth;
    const pl = parseFloat(th.dataset.l || l), pw = parseFloat(th.dataset.w || w);
    th.dataset.l = l; th.dataset.w = w;
    if (!animate || reduceMotion() || !th.dataset.placed) { th.style.left = l + 'px'; th.style.width = w + 'px'; th.dataset.placed = 1; return; }
    const right = l > pl;
    const lead = right ? { left: pl, width: l + w - pl } : { left: l, width: pl + pw - l };
    th.getAnimations().forEach((a) => a.cancel());
    th.animate([
      { left: pl + 'px', width: pw + 'px', transform: 'scaleY(1)' },
      // phase 14: restrained — the thumb leads, the tail follows, a hair of squash; 280 ms on the shared curve
      { left: lead.left + 'px', width: lead.width + 'px', transform: 'scaleY(.94)', offset: 0.5 },
      { left: l + 'px', width: w + 'px', transform: 'scaleY(1)' },
    ], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
    th.style.left = l + 'px'; th.style.width = w + 'px';
  }
  G.segInit = (root = document) => root.querySelectorAll('.seg').forEach((seg) => {
    if (!seg.querySelector(':scope > .seg-thumb')) seg.insertAdjacentHTML('afterbegin', '<span class="seg-thumb"></span>');
    const on = seg.querySelector(':scope > button.on');
    requestAnimationFrame(() => place(seg, on, false));
    if (seg.__seg) return; seg.__seg = 1;
    // drag the thumb like a droplet
    let drag = null;
    seg.addEventListener('pointerdown', (e) => {
      const th = seg.querySelector(':scope > .seg-thumb'); const onb = seg.querySelector(':scope > button.on');
      if (!onb || !th) return;
      const r = onb.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right) return; // only when grabbing the thumb
      drag = { x0: e.clientX, l0: onb.offsetLeft, w: onb.offsetWidth, moved: false };
      seg.setPointerCapture(e.pointerId);
    });
    seg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x0; if (Math.abs(dx) > 3) drag.moved = true;
      if (!drag.moved) return;
      seg.classList.add('dragging');
      const th = seg.querySelector(':scope > .seg-thumb');
      const max = seg.clientWidth - drag.w - 3;
      const l = Math.max(3, Math.min(max, drag.l0 + dx));
      const stretch = Math.min(1.25, 1 + Math.abs(e.movementX || 0) / 30);
      th.style.left = l + 'px'; th.style.width = drag.w + 'px'; th.style.transform = `scale(${stretch}, ${2 - stretch})`;
    });
    const end = () => {
      if (!drag) return;
      const moved = drag.moved; drag = null; seg.classList.remove('dragging');
      const th = seg.querySelector(':scope > .seg-thumb'); th.style.transform = '';
      if (!moved) return;
      const c = th.offsetLeft + th.offsetWidth / 2;
      let best = null, bd = 1e9;
      seg.querySelectorAll(':scope > button').forEach((b) => { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - c); if (d < bd) { bd = d; best = b; } });
      th.dataset.l = th.offsetLeft; th.dataset.w = th.offsetWidth;
      if (best) { seg.__suppressClick = true; best.click(); setTimeout(() => (seg.__suppressClick = false), 0); }
    };
    seg.addEventListener('pointerup', end); seg.addEventListener('pointercancel', end);
  });
  G.segSelect = (seg, btn) => {
    seg.querySelectorAll(':scope > button').forEach((b) => b.classList.toggle('on', b === btn));
    place(seg, btn, true);
  };
  G.segRelayout = (root = document) => root.querySelectorAll('.seg').forEach((seg) => place(seg, seg.querySelector(':scope > button.on'), false));

  /* ---- liquid warp for the draw transition (filter on the incoming poster layer) ---- */
  G.warp = (el) => {
    if (reduceMotion() || G.engine === 'webkit') return;
    const dm = document.getElementById('warp-dm'); const turb = document.getElementById('warp-turb');
    if (!dm) return;
    turb.setAttribute('seed', String(Math.floor(Math.random() * 100)));
    el.style.filter = 'url(#warp)';
    const t0 = performance.now(), D = 620;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / D); const e = 1 - Math.pow(1 - p, 3);
      dm.setAttribute('scale', String(70 * (1 - e)));
      if (p < 1) requestAnimationFrame(step); else el.style.filter = '';
    };
    requestAnimationFrame(step);
  };

  /* React helpers: refract new [data-refract] nodes as they mount */
  G.place = place;
  G.auto = () => {
    if (G.__auto) return; G.__auto = 1;
    let t = 0;
    const run = () => { t = 0; G.refract(document); };
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.hasAttribute('data-refract') || n.querySelector('[data-refract]'))) { if (!t) t = requestAnimationFrame(run); return; }
    }).observe(document.body, { childList: true, subtree: true });
    run();
  };
}
export default (typeof window !== 'undefined' && window.__ppGlass) || G;
