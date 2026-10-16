// AI background removal for the desktop app: rembg's IS-Net pipeline (isnet-general-use, Apache-2.0)
// ported to onnxruntime-node, so the cut-out works without Python. sharp only decodes and encodes.
// Same steps as server/serve.py → rembg: thumbnail to fit 1024², stretch to 1024² for the model, divide by the max
// pixel value and subtract mean 0.5 with std 1, min–max the prediction, resize the mask back.
// Every resize is Pillow's Lanczos (fixed-point, from libImaging/Resample.c), because the model's soft mask is
// sensitive to the resampler on ambiguous pictures, and the web build's cut-outs come from Pillow.
// The output keeps the photo's own RGB and puts the mask in alpha (rembg's naive_cutout darkens soft edges instead).
// Runs inside cutout-worker.cjs (a utility process), never in the main process: see main.cjs.
'use strict';

const SIZE = 1024;
const MEAN = [0.5, 0.5, 0.5]; // rembg 2.0.85 DisSession (IS-Net's own preprocessing)
const PRE = 2048; // inputs above this are first shrunk by sharp; the app sends at most 1600 px (userImages.ts)

let ort = null, sharp = null, session = null, loading = null, queue = Promise.resolve();

function modules() {
  if (!ort) ort = require('onnxruntime-node');
  if (!sharp) sharp = require('sharp');
  return { ort, sharp };
}

async function getSession(modelPath) {
  if (session) return session;
  if (!loading) {
    loading = modules().ort.InferenceSession.create(modelPath, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' })
      .then((s) => (session = s))
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
}

/* ---------- Pillow's resampler (Image.resize with LANCZOS, 8 bits per channel) ---------- */
const PRECISION_BITS = 32 - 8 - 2;
const sinc = (x) => { if (x === 0) return 1; x *= Math.PI; return Math.sin(x) / x; };
const lanczos = (x) => (x >= -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0);

function coeffs(inSize, outSize) {
  const scale = inSize / outSize;
  const filterscale = Math.max(scale, 1);
  const support = 3 * filterscale;
  const ksize = Math.ceil(support) * 2 + 1;
  const bounds = new Int32Array(outSize * 2);
  const kk = new Float64Array(outSize * ksize);
  const ss = 1 / filterscale;
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let xmin = Math.trunc(center - support + 0.5); if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5); if (xmax > inSize) xmax = inSize;
    xmax -= xmin;
    let ww = 0;
    for (let x = 0; x < xmax; x++) { const w = lanczos((x + xmin - center + 0.5) * ss); kk[xx * ksize + x] = w; ww += w; }
    if (ww !== 0) for (let x = 0; x < xmax; x++) kk[xx * ksize + x] /= ww;
    bounds[xx * 2] = xmin; bounds[xx * 2 + 1] = xmax;
  }
  const k = new Int32Array(kk.length); // normalize_coeffs_8bpc
  for (let i = 0; i < kk.length; i++) k[i] = Math.trunc(kk[i] < 0 ? -0.5 + kk[i] * (1 << PRECISION_BITS) : 0.5 + kk[i] * (1 << PRECISION_BITS));
  return { ksize, bounds, k };
}

const clip8 = (v) => (v >= (1 << PRECISION_BITS << 8) ? 255 : v <= 0 ? 0 : v >> PRECISION_BITS);

/** Resize interleaved 8-bit pixels (c channels) like Pillow: horizontal pass on the rows the vertical pass needs, then vertical. */
function resize(src, w, h, c, ow, oh) {
  const H = coeffs(w, ow), V = coeffs(h, oh);
  let img = src, iw = w;
  if (ow !== w) {
    const y0 = V.bounds[0], y1 = V.bounds[oh * 2 - 2] + V.bounds[oh * 2 - 1];
    for (let i = 0; i < oh; i++) V.bounds[i * 2] -= y0;
    const tmp = Buffer.alloc(ow * (y1 - y0) * c);
    for (let yy = 0; yy < y1 - y0; yy++) {
      const row = (yy + y0) * w * c;
      for (let xx = 0; xx < ow; xx++) {
        const xmin = H.bounds[xx * 2], xmax = H.bounds[xx * 2 + 1], kb = xx * H.ksize;
        for (let ch = 0; ch < c; ch++) {
          let ss = 1 << (PRECISION_BITS - 1);
          for (let x = 0; x < xmax; x++) ss += src[row + (x + xmin) * c + ch] * H.k[kb + x];
          tmp[(yy * ow + xx) * c + ch] = clip8(ss);
        }
      }
    }
    img = tmp; iw = ow;
  }
  if (oh === h) return img;
  const out = Buffer.alloc(iw * oh * c);
  for (let yy = 0; yy < oh; yy++) {
    const ymin = V.bounds[yy * 2], ymax = V.bounds[yy * 2 + 1], kb = yy * V.ksize;
    for (let xx = 0; xx < iw; xx++) {
      for (let ch = 0; ch < c; ch++) {
        let ss = 1 << (PRECISION_BITS - 1);
        for (let y = 0; y < ymax; y++) ss += img[((y + ymin) * iw + xx) * c + ch] * V.k[kb + y];
        out[(yy * iw + xx) * c + ch] = clip8(ss);
      }
    }
  }
  return out;
}

/** Image.thumbnail((1024, 1024)) target size: keep the aspect, round to the side that keeps it best. */
function thumbSize(w, h) {
  if (w <= SIZE && h <= SIZE) return [w, h];
  const aspect = w / h;
  const pick = (n, key) => Math.max(key(Math.floor(n)) <= key(Math.ceil(n)) ? Math.floor(n) : Math.ceil(n), 1);
  if (SIZE / SIZE >= aspect) return [pick(SIZE * aspect, (n) => Math.abs(aspect - n / SIZE)), SIZE];
  return [SIZE, pick(SIZE / aspect, (n) => (n === 0 ? 0 : Math.abs(aspect - SIZE / n)))];
}

async function run(modelPath, input) {
  const { ort, sharp } = modules();
  // PIL's convert('RGB'): alpha dropped, grey expanded; EXIF orientation applied as rembg's fix_image_orientation does
  let dec = await sharp(input, { failOn: 'none' }).rotate().toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (Math.max(dec.info.width, dec.info.height) > PRE) {
    dec = await sharp(dec.data, { raw: { width: dec.info.width, height: dec.info.height, channels: 3 } })
      .resize(PRE, PRE, { fit: 'inside', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  }
  const [w, h] = thumbSize(dec.info.width, dec.info.height);
  const rgb = w === dec.info.width && h === dec.info.height ? dec.data : resize(dec.data, dec.info.width, dec.info.height, 3, w, h);

  const px = resize(rgb, w, h, 3, SIZE, SIZE);
  const n = SIZE * SIZE;
  let max = 0;
  for (let i = 0; i < px.length; i++) if (px[i] > max) max = px[i];
  const div = Math.max(max, 1e-6);
  const t = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    t[i] = px[3 * i] / div - MEAN[0];
    t[n + i] = px[3 * i + 1] / div - MEAN[1];
    t[2 * n + i] = px[3 * i + 2] / div - MEAN[2];
  }

  const s = await getSession(modelPath);
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, SIZE, SIZE]) });
  const pred = out[s.outputNames[0]].data; // [1, 1, 1024, 1024]; channel 0 is the mask
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const v = pred[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const f = Math.fround, span = f(hi - lo);
  const mask = Buffer.alloc(n); // numpy float32 maths: ((pred - mi) / (ma - mi) * 255).astype(uint8)
  if (span > 0) for (let i = 0; i < n; i++) mask[i] = Math.trunc(f(f(f(pred[i] - lo) / span) * 255));

  const alpha = resize(mask, SIZE, SIZE, 1, w, h);
  return sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png().toBuffer();
}

/** One inference at a time keeps memory bounded (the Python server holds a lock for the same reason). */
function cutout(modelPath, input) {
  const job = queue.then(() => run(modelPath, input));
  queue = job.catch(() => undefined);
  return job;
}

module.exports = { cutout, _resize: resize, _thumbSize: thumbSize };
