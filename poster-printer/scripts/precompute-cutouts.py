"""Offline subject masks for preset photos, so the cover ("subject in front of masthead") works without the AI server.
Runs rembg (IS-Net) locally on every photo/illus/museum preset that has no cut-out yet, keeps only clean single-subject
masks (enough coverage, not touching most of the frame border, one dominant component) and records them in the manifest.
usage: server/.venv/bin/python scripts/precompute-cutouts.py"""
import json, os, sys
import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = os.path.join(ROOT, 'public/images/manifest.json')
m = json.load(open(MAN))
sess = new_session('isnet-general-use')
kept = rej = 0
for it in m:
    if it.get('cutout') or it.get('tier') == 'proc': continue
    cp = os.path.join(ROOT, 'public/images/cut', it['id'] + '.png')
    if not os.path.exists(cp):
        im = Image.open(os.path.join(ROOT, 'public', it['src'].lstrip('/'))).convert('RGB')
        im.thumbnail((1024, 1024), Image.LANCZOS)
        c = remove(im, session=sess)
        c.thumbnail((1200, 1200), Image.LANCZOS)
        c.save(cp, optimize=True)
    c = Image.open(cp)
    al = np.asarray(c.split()[-1]).astype(float) / 255
    a = al > 0.5
    cov = a.mean()
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).mean()
    lab, n = ndimage.label(a)
    big = (np.bincount(lab.ravel())[1:].max() / max(1, a.sum())) if n else 0
    ok = 0.06 < cov < 0.55 and border < 0.3 and big > 0.85
    if ok:
        ys, xs = np.nonzero(a)
        it['cutout'] = '/images/cut/' + it['id'] + '.png'
        it['cutBox'] = {'x': round(xs.min() / a.shape[1], 3), 'y': round(ys.min() / a.shape[0], 3), 'w': round((xs.max() - xs.min()) / a.shape[1], 3), 'h': round((ys.max() - ys.min()) / a.shape[0], 3)}
        kept += 1
    else:
        os.remove(cp); rej += 1
    print(it['id'], 'keep' if ok else 'reject', round(cov, 2), round(border, 2), round(big, 2), flush=True)
json.dump(m, open(MAN, 'w'), separators=(',', ':'))
print('kept', kept, 'rejected', rej)
