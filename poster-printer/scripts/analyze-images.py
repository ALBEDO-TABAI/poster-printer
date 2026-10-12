"""Subject-aware crop data for the bundled images (open-source maths only: numpy + Pillow).

For every manifest entry it computes
  focus   – saliency-weighted centre of the subject (0..1), used as the crop anchor
  subject – bbox of the salient region {x,y,w,h} (0..1), crops try to keep it whole
  detail  – 16×16 grid of local detail (gradient energy, 0..1), "is this area busy?" for text placement
Saliency = spectral-residual saliency (Hou & Zhang 2007) + colour-contrast, with a mild centre prior.
Cut-out images use their alpha mask as the saliency map instead (that *is* the subject).
usage: python3 scripts/analyze-images.py [public/images/manifest.json]
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageFilter

MAN = sys.argv[1] if len(sys.argv) > 1 else 'public/images/manifest.json'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(MAN)))  # public/

def blur(a, r):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255

def spectral_residual(g):
    f = np.fft.fft2(g)
    la = np.log(np.abs(f) + 1e-6)
    ph = np.angle(f)
    k = np.ones((3, 3)) / 9
    pad = np.pad(la, 1, mode='edge')
    avg = sum(pad[i:i + la.shape[0], j:j + la.shape[1]] * k[i, j] for i in range(3) for j in range(3))
    sal = np.abs(np.fft.ifft2(np.exp(la - avg + 1j * ph))) ** 2
    sal /= sal.max() + 1e-9
    return blur(sal, 2.5)

def analyze(path, cut_path=None):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    s = 96
    sw, sh = (s, max(8, round(s * H / W))) if W >= H else (max(8, round(s * W / H)), s)
    sm = np.asarray(im.resize((sw, sh), Image.LANCZOS), dtype=np.float32) / 255
    g = sm @ np.array([0.299, 0.587, 0.114])
    if cut_path and os.path.exists(cut_path):
        a = np.asarray(Image.open(cut_path).convert('RGBA').resize((sw, sh), Image.LANCZOS), dtype=np.float32)[..., 3] / 255
        sal = a
    else:
        sr = spectral_residual(g)
        mean = sm.reshape(-1, 3).mean(0)
        cc = np.sqrt(((blur(sm[..., 0], 1.5)[..., None] * 0 + sm - mean) ** 2).sum(-1))
        cc = blur(cc / (cc.max() + 1e-9), 3)
        yy, xx = np.mgrid[0:sh, 0:sw]
        prior = np.exp(-(((xx / sw - 0.5) ** 2) / 0.18 + ((yy / sh - 0.45) ** 2) / 0.22))
        sal = (0.55 * sr / (sr.max() + 1e-9) + 0.45 * cc) * (0.55 + 0.45 * prior)
    sal = sal / (sal.max() + 1e-9)
    thr = np.quantile(sal, 0.8)
    m = sal >= thr
    wts = np.where(m, sal, 0)
    yy, xx = np.mgrid[0:sh, 0:sw]
    fx = float((wts * xx).sum() / wts.sum() + 0.5) / sw
    fy = float((wts * yy).sum() / wts.sum() + 0.5) / sh
    # subject bbox: rows/cols that hold 90% of the salient mass
    def span(p):
        c = np.cumsum(p) / p.sum()
        return int(np.searchsorted(c, 0.05)), int(np.searchsorted(c, 0.95)) + 1
    x0, x1 = span(wts.sum(0)); y0, y1 = span(wts.sum(1))
    subject = dict(x=round(x0 / sw, 3), y=round(y0 / sh, 3), w=round((x1 - x0) / sw, 3), h=round((y1 - y0) / sh, 3))
    # detail: gradient energy, pooled to 16×16
    gx = np.abs(np.diff(g, axis=1, append=g[:, -1:]))
    gy = np.abs(np.diff(g, axis=0, append=g[-1:, :]))
    e = np.asarray(Image.fromarray((gx + gy).astype(np.float32)).resize((16, 16), Image.BOX), dtype=np.float32)
    e = np.clip(e / 0.25, 0, 1)  # 0.25 mean abs gradient (96px proxy) ≈ very busy texture
    return dict(focus=dict(x=round(fx, 3), y=round(fy, 3)), subject=subject, detail=[round(float(v), 2) for v in e.reshape(-1)])

def main():
    man = json.load(open(MAN))
    for a in man:
        p = os.path.join(ROOT, a['src'].lstrip('/'))
        cut = os.path.join(ROOT, a['cutout'].lstrip('/')) if a.get('cutout') else None
        r = analyze(p, cut)
        a.update(r)
        print(a['id'], r['focus'], r['subject'], 'detail~%.2f' % np.mean(r['detail']))
    json.dump(man, open(MAN, 'w'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
