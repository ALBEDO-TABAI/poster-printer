"""Phase 9: import Grok Bot-generated original images (layout-first briefs) as preset images.
The generator returned 1280x720 frames; each is turned into a 3:4 portrait (900x1200) by a subject-aware crop and,
where the brief asked for a flat empty zone, by extending the flat background (per-column edge colour, smoothed,
with matched grain). Writes public/images/gen-*.jpg (+thumb, +cut for the trumpet) and manifest entries with the
declared safe-text zones, accent colour and mood.  usage: server/.venv/bin/python scripts/import-genimg.py"""
import json, os, sys, glob
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = '/home/box/agent-data/agents/bc0ff61d-52ca-4e34-9e4e-6a2282365fcb/assets'
OUT = os.path.join(ROOT, 'public/images')
TW, TH = 900, 1200
# id, file prefix, crop x0 (in 1280 px), extend top / bottom (px at 900 wide), declared metadata (portrait coords)
SPEC = [
 ('gen-night-voyage', '62c721b7', 380, 480, 0, dict(category='landscape', title='Night sea with a lantern boat (generated)', mood='quiet, nocturnal, solitary', accent='#f2b25c',
   zones=[dict(role='headline', x=.07, y=.06, w=.86, h=.40), dict(role='info', x=.07, y=.84, w=.48, h=.12)])),
 ('gen-stone-speaker', '48c3dba8', 190, 480, 0, dict(category='object', title='Stone-shaped speaker on tangerine (generated)', mood='warm, calm, product', accent='#2a2623',
   zones=[dict(role='headline', x=.08, y=.06, w=.84, h=.34), dict(role='info', x=.08, y=.43, w=.84, h=.12)])),
 ('gen-stair-light', 'c73a8cc3', 560, 0, 0, dict(category='street', title='Concrete stair in diagonal light (generated)', mood='architectural, contemplative', accent='#c9a777',
   zones=[dict(role='headline', x=.42, y=.05, w=.53, h=.42), dict(role='info', x=.07, y=.06, w=.34, h=.16)])),
 ('gen-brass-trumpet', '5679818a', 190, 240, 240, dict(category='object', title='Brass trumpet on light grey (generated)', mood='bright, musical, crisp', accent='#b8862f',
   zones=[dict(role='headline', x=.06, y=.60, w=.88, h=.22), dict(role='info', x=.07, y=.86, w=.86, h=.10)], interleave=True)),
 ('gen-cobalt-seats', '11744a83', 190, 480, 0, dict(category='street', title='Empty cobalt auditorium seats (generated)', mood='expectant, cool, institutional', accent='#3d6df0',
   zones=[dict(role='headline', x=.07, y=.06, w=.86, h=.42), dict(role='info', x=.07, y=.50, w=.86, h=.10)])),
 ('gen-vermilion-skyline', '4d27eb39', 254, 480, 0, dict(category='street', title='Vector skyline with a vermilion tower (generated)', mood='urban, graphic, festive', accent='#e5392a',
   zones=[dict(role='headline', x=.07, y=.06, w=.86, h=.44), dict(role='info', x=.07, y=.52, w=.6, h=.08)])),
]

def extend(im, top, bottom, seed):
    a = np.asarray(im).astype(float)
    h, w, _ = a.shape
    rng = np.random.default_rng(seed)
    def band(rows, n, flip):
        col = np.median(rows, axis=0)                                   # per-column edge colour
        col = np.asarray(Image.fromarray(col[None].astype(np.uint8)).resize((w, 1)).filter(ImageFilter.GaussianBlur(24))).astype(float)[0]
        g = np.repeat(col[None], n, axis=0)
        sd = rows.std(axis=0).mean(axis=0) * 0.6                         # matched grain
        g += rng.normal(0, 1, g.shape) * sd
        return g
    parts = []
    if top: parts.append(band(a[:24], top, False))
    parts.append(a)
    if bottom: parts.append(band(a[-24:], bottom, True))
    out = np.concatenate(parts, axis=0)
    # soft seams (40 px) so the extension reads as the same flat field
    for y0 in ([top] if top else []) + ([top + h] if bottom else []):
        for k in range(-20, 20):
            y = y0 + k
            t = (k + 20) / 40
            if 0 < y < out.shape[0] - 1:
                out[y] = out[y] * 0.6 + (out[y - 1] * (1 - t) + out[y + 1] * t) * 0.4
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def palette(im, k=5):
    from sklearn.cluster import KMeans
    a = np.asarray(im.resize((80, 107))).reshape(-1, 3).astype(float)
    km = KMeans(k, n_init=4, random_state=0).fit(a)
    order = np.argsort(-np.bincount(km.labels_))
    return ['#%02x%02x%02x' % tuple(int(v) for v in km.cluster_centers_[i]) for i in order]

def main():
    import importlib.util as iu
    sp = iu.spec_from_file_location('ai', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'analyze-images.py')); ai = iu.module_from_spec(sp); sp.loader.exec_module(ai); analyze = ai.analyze
    man_p = os.path.join(OUT, 'manifest.json')
    man = [m for m in json.load(open(man_p)) if not m['id'].startswith('gen-')]
    for i, (id_, pre, x0, top, bot, meta) in enumerate(SPEC):
        src = Image.open(glob.glob(os.path.join(SRC, pre + '*'))[0]).convert('RGB')
        if top or bot:
            c = src.crop((x0, 0, x0 + 900, 720))
            im = extend(c, top, bot, i)
        else:
            c = src.crop((x0, 0, x0 + 540, 720))
            im = c.resize((TW, TH), Image.LANCZOS)
        im = im.resize((TW, TH), Image.LANCZOS)
        p = os.path.join(OUT, id_ + '.jpg'); im.save(p, quality=88, optimize=True)
        th = im.copy(); th.thumbnail((360, 360), Image.LANCZOS); th.save(os.path.join(OUT, 'thumb', id_ + '.jpg'), quality=82)
        cut = None
        if meta.get('interleave'):
            from rembg import new_session, remove
            cp = os.path.join(OUT, 'cut', id_ + '.png')
            remove(im, session=new_session('isnet-general-use')).save(cp, optimize=True)
            cut = '/images/cut/' + id_ + '.png'
        r = analyze(p, os.path.join(OUT, 'cut', id_ + '.png') if cut else None)
        g = np.asarray(im.convert('RGB').resize((16, 16), Image.BOX)).astype(float) / 255
        lin = np.where(g <= 0.04045, g / 12.92, ((g + 0.055) / 1.055) ** 2.4)
        lum = (lin @ np.array([0.2126, 0.7152, 0.0722])).reshape(-1)
        pal = palette(im)
        credit = dict(title=meta['title'], artist='Grok Bot (GenerateImage), original AI-generated image', license='original; generated for this project, no people/brands/characters', source='generated 2026-10-12, layout-first brief')
        man.append(dict(id=id_, src='/images/' + id_ + '.jpg', thumb='/images/thumb/' + id_ + '.jpg', w=TW, h=TH, palette=pal, lum=[round(float(v), 3) for v in lum], lumW=16, lumH=16,
                        focus=r['focus'], cutout=cut, category=meta['category'], title=meta['title'], credit=credit, tier='gen', subject=r['subject'], detail=r['detail'],
                        zones=meta['zones'], accent=meta['accent'], mood=meta['mood'], **({'interleave': True} if meta.get('interleave') else {})))
        print(id_, r['subject'], pal[:3])
    json.dump(man, open(man_p, 'w'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
