"""Process curated raw images into public/images + manifest with palette, luminance grid, focus and optional cutouts."""
import json, os, sys, glob
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'img_raw')
OUT = os.path.join(HERE, '..', 'public', 'images')
os.makedirs(os.path.join(OUT, 'thumb'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'cut'), exist_ok=True)

SEL = {
 'east': ['37282', '45294', '56689', '853241', '42346', '45095', '55237', '36971', '56138'],
 'landscape': ['11311', '11903', '18447', '36492', '55736', '56915', '36545', '54868', '56727', '56384', '428620'],
 'figure': ['399894', '435991', '436134', '436137', '436163', '773108', '459097', '48893'],
 'flora': ['400570', '56939', '912002', '51786', '54305', '56796', '362627'],
 'abstract': ['892571', '839178'],
 'object': ['248895', '248901', '255422', '39905', '42726', '54081', '42474', '188957', '49855', '4448'],
 'street': ['265895', '265932', '270389', '286336', '631032'],
}
CUT = set(SEL['object']) | {'399894', '773108', '48893', '435991', '56939', '54305', '400570'}
NOTRIM = set(SEL['object'])

prov = {}
for pf in glob.glob(os.path.join(RAW, 'met', '*.json')):
    for p in json.load(open(pf)):
        prov[str(p['objectID'])] = p
procprov = {p['file'][:-4]: p for p in json.load(open(os.path.join(RAW, 'proc', 'provenance.json')))}

def find_raw(oid):
    g = glob.glob(os.path.join(RAW, 'met', '*', oid + '.jpg'))
    return g[0] if g else None

def srgb_lin(a):
    a = a / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)

def to_lab(rgb):
    l = srgb_lin(rgb)
    X = (l @ np.array([0.4124, 0.3576, 0.1805])) / 0.95047
    Y = l @ np.array([0.2126, 0.7152, 0.0722])
    Z = (l @ np.array([0.0193, 0.1192, 0.9505])) / 1.08883
    f = lambda t: np.where(t > 216 / 24389, np.cbrt(t), (24389 / 27 * t + 16) / 116)
    fx, fy, fz = f(X), f(Y), f(Z)
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], -1)

def lab_to_hex(lab):
    L, a, b = lab
    fy = (L + 16) / 116; fx = fy + a / 500; fz = fy - b / 200
    finv = lambda t: t ** 3 if t ** 3 > 216 / 24389 else (116 * t - 16) / (24389 / 27)
    X, Y, Z = finv(fx) * 0.95047, finv(fy), finv(fz) * 1.08883
    rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z]
    out = []
    for c in rgb:
        c = max(0, min(1, c)); c = 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
        out.append(int(round(c * 255)))
    return '#%02x%02x%02x' % tuple(out)

def autotrim(im):
    a = np.asarray(im.convert('RGB')).astype(float)
    h, w, _ = a.shape
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    med = np.median(border, 0)
    diff = np.abs(a - med).sum(-1) > 60
    rows = np.where(diff.mean(1) > 0.35)[0]; cols = np.where(diff.mean(0) > 0.35)[0]
    if len(rows) < h * 0.3 or len(cols) < w * 0.3: return im
    y0, y1, x0, x1 = rows[0], rows[-1], cols[0], cols[-1]
    pad = int(min(h, w) * 0.012)
    box = (x0 + pad, y0 + pad, x1 - pad, y1 - pad)
    if (box[2] - box[0]) * (box[3] - box[1]) < 0.35 * w * h: return im
    return im.crop(box)

session = None
def cutout(im):
    global session
    from rembg import new_session, remove
    if session is None: session = new_session(os.environ.get('CUT_MODEL', 'isnet-general-use'))
    return remove(im, session=session)

items = []
only = sys.argv[1:]
def handle(id_, src_path, cat, credit):
    im = Image.open(src_path).convert('RGB')
    if cat != 'object' and credit.get('license', '').startswith('CC0 1.0 (The Met'):
        im = autotrim(im)
    im.thumbnail((1600, 1600), Image.LANCZOS)
    w, h = im.size
    im.save(os.path.join(OUT, id_ + '.jpg'), quality=86, optimize=True)
    th = im.copy(); th.thumbnail((360, 360), Image.LANCZOS); th.save(os.path.join(OUT, 'thumb', id_ + '.jpg'), quality=82)
    small = np.asarray(im.resize((96, max(1, int(96 * h / w))))).reshape(-1, 3).astype(float)
    lab = to_lab(small)
    km = KMeans(5, n_init=4, random_state=0).fit(lab)
    cnt = np.bincount(km.labels_, minlength=5)
    order = np.argsort(-cnt)
    palette = [lab_to_hex(km.cluster_centers_[i]) for i in order]
    lg = np.asarray(im.resize((16, 16), Image.BILINEAR)).astype(float)
    lum = (srgb_lin(lg) @ np.array([0.2126, 0.7152, 0.0722])).reshape(-1)
    focus = {'x': 0.5, 'y': 0.45}
    cut = None
    if id_.split('-', 1)[1] in CUT and (not only or id_ in only or 'cut' in only):
        cp = os.path.join(OUT, 'cut', id_ + '.png')
        if not os.path.exists(cp):
            src = im.copy(); src.thumbnail((1024, 1024), Image.LANCZOS)
            c = cutout(src)
            c.thumbnail((1200, 1200), Image.LANCZOS)
            c.save(cp, optimize=True)
        c = Image.open(cp)
        al = np.asarray(c.split()[-1]).astype(float) / 255
        if al.mean() > 0.1:  # reject weak / fragmentary cut-outs
            ys, xs = np.mgrid[0:al.shape[0], 0:al.shape[1]]
            focus = {'x': round(float((xs * al).sum() / al.sum() / al.shape[1]), 3), 'y': round(float((ys * al).sum() / al.sum() / al.shape[0]), 3)}
            cut = '/images/cut/' + id_ + '.png'
    items.append(dict(id=id_, src='/images/' + id_ + '.jpg', thumb='/images/thumb/' + id_ + '.jpg', w=w, h=h, palette=palette, lum=[round(float(v), 3) for v in lum], lumW=16, lumH=16, focus=focus, cutout=cut, category=cat, title=credit.get('title', ''), credit=credit))
    print(id_, w, h, palette, 'cut' if cut else '', flush=True)

for cat, ids in SEL.items():
    for oid in ids:
        p = find_raw(oid)
        if not p: print('missing', oid); continue
        pr = prov.get(oid, {})
        handle(f'{cat}-{oid}', p, cat, dict(title=pr.get('title', ''), artist=pr.get('artist', ''), date=pr.get('date', ''), url=pr.get('url', ''), license='CC0 1.0 (The Met Open Access)'))
for f in sorted(glob.glob(os.path.join(RAW, 'proc', '*.jpg'))):
    name = os.path.basename(f)[:-4]
    cat = name.split('-')[0]
    cat = {'fluid': 'abstract', 'aura': 'abstract', 'dunes': 'abstract', 'pattern': 'abstract'}.get(cat, cat)
    handle(f'{cat}-{name}', f, cat, dict(title=name, artist='Poster Printer (procedural)', license='CC0 1.0 — original procedural artwork (scripts/gen-procedural.py)'))
# contemporary CC0 photographs from Wikimedia Commons (scripts/fetch-commons.py; licence verified per file)
COMMONS_CAT = {'arch': 'architecture', 'interior': 'architecture', 'still': 'still', 'food': 'still', 'object': 'still', 'plant': 'nature', 'land': 'nature', 'sky': 'nature', 'urban': 'city', 'figure': 'nature'}
COMMONS_FIX = {'figure-171647544': 'architecture', 'object-143875268': 'city', 'urban-59157180': 'nature', 'urban-61967456': 'nature'}
COMMONS_CUT = {'food-52782748', 'food-160758645', 'still-151468251', 'sky-22762070', 'plant-32254575', 'object-61337727', 'object-141290511'}
cpf = os.path.join(RAW, 'commons', 'provenance.json')
for pr in (json.load(open(cpf)) if os.path.exists(cpf) else []):
    cid = pr['id']; cat = COMMONS_FIX.get(cid, COMMONS_CAT.get(cid.split('-')[0], 'nature'))
    CUT.add(cid.replace('-', '')) if cid in COMMONS_CUT else None
    handle(f"{cat}-{cid.replace('-', '')}", os.path.join(RAW, 'commons', cid + '.jpg'), cat, dict(title=pr['title'].rsplit('.', 1)[0], artist=pr.get('artist', ''), date=pr.get('date', ''), url=pr['page'], license=pr['license']))
# original flat illustrations (scripts/gen-illustrations.py)
ipf = os.path.join(RAW, 'illus', 'provenance.json')
for pr in (json.load(open(ipf)) if os.path.exists(ipf) else []):
    name = pr['file'][:-4]
    handle(name, os.path.join(RAW, 'illus', pr['file']), 'illustration', dict(title=pr['title'], artist='Poster Printer (original illustration)', license='CC0 1.0 — original illustration (scripts/gen-illustrations.py)'))
TIER = {'photo': 3.0, 'illus': 1.6, 'museum': 0.7, 'proc': 0.25}
for it in items:
    lic = it['credit'].get('license', '')
    it['tier'] = 'photo' if 'Wikimedia' in lic else 'illus' if 'illustration' in lic else 'museum' if 'Met' in lic else 'proc'
json.dump(items, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False)
print(len(items), 'images')
