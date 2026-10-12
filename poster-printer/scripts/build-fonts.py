"""Subset fonts from /workspace/fonts into public/fonts/*.woff2 and write manifest.json.
Latin families: Basic Latin + Latin-1 + common punctuation. CJK families: GB2312 level-1 + chars used in src/data.
"""
import json, os, re, sys, glob
from concurrent.futures import ProcessPoolExecutor
from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = os.environ.get('REA_FONTS_SRC', '/workspace/fonts')
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(APP, 'public', 'fonts')
os.makedirs(OUT, exist_ok=True)
cat = json.load(open(os.path.join(ROOT, 'catalog.json')))

LATIN = list(range(0x20, 0x7f)) + list(range(0xa0, 0x180)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x2030, 0x2032, 0x2033, 0x2039, 0x203a, 0x20ac, 0x2116, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2197, 0x2198, 0x00d7, 0x2715, 0x25cf, 0x25cb, 0x25a0, 0x2605, 0x2606, 0x00b7]

def cjk_chars():
    s = set()
    for b1 in range(0xB0, 0xD8):
        for b2 in range(0xA1, 0xFF):
            try: s.add(bytes([b1, b2]).decode('gb2312'))
            except Exception: pass
    # punctuation & fullwidth
    s.update('，。、；：？！「」『』（）《》〈〉【】—…·“”‘’〜～＋－×÷＝％＃＆＠０１２３４５６７８９')
    for f in glob.glob(os.path.join(APP, 'src', '**', '*.ts'), recursive=True) + glob.glob(os.path.join(APP, 'src', '**', '*.tsx'), recursive=True):
        for ch in open(f, encoding='utf-8').read():
            if ord(ch) > 0x2e80: s.add(ch)
    return sorted(ord(c) for c in s)

WEIGHT_WORDS = r'\b(Thin|ExtraLight|Extra Light|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black|SemiExpanded|\d+pt)\b'
FIX = {'lxgw-wenkai': 'LXGW WenKai', 'black-ops-one': 'Black Ops One', 'shadows-into-light': 'Shadows Into Light', 'archivo-black': 'Archivo Black', 'smiley-sans': 'Smiley Sans'}
def clean_name(n):
    n = re.sub(WEIGHT_WORDS, '', n)
    return re.sub(r'\s+', ' ', n).strip()

def job(args):
    fam, path, idx, unicodes = args
    try:
        f = TTFont(path, lazy=False)
    except Exception as e:
        return None
    os2 = f['OS/2'] if 'OS/2' in f else None
    italic = bool(os2 and (os2.fsSelection & 1)) or 'italic' in os.path.basename(path).lower()
    weight = os2.usWeightClass if os2 else 400
    wrange = None
    if 'fvar' in f:
        for a in f['fvar'].axes:
            if a.axisTag == 'wght': wrange = (int(a.minValue), int(a.maxValue))
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False
    s = subset.Subsetter(opts)
    s.populate(unicodes=unicodes)
    try:
        s.subset(f)
    except Exception as e:
        return None
    fn = f"{fam['slug']}-{idx}{'-i' if italic else ''}.woff2"
    f.flavor = 'woff2'
    f.save(os.path.join(OUT, fn))
    return dict(slug=fam['slug'], url='/fonts/' + fn, weight=f"{wrange[0]} {wrange[1]}" if wrange else str(weight), wmin=wrange[0] if wrange else weight, wmax=wrange[1] if wrange else weight, style='italic' if italic else 'normal', bytes=os.path.getsize(os.path.join(OUT, fn)))

if __name__ == '__main__':
    only_cjk = '--cjk' in sys.argv
    cj = cjk_chars()
    print('cjk chars', len(cj))
    SKIP = {'source-han-sans-cn', 'source-han-serif-cn', 'noto-sans-tc', 'noto-serif-tc', 'noto-sans-jp', 'noto-serif-jp', 'rounded-mplus-1c'}
    jobs = []
    fams = []
    for fam in cat['families']:
        if fam['slug'] in SKIP: continue
        is_cjk = fam['group'] == 'cjk'
        if only_cjk and not is_cjk: continue
        files = [os.path.join(ROOT, p) for p in fam['files'] if p.lower().endswith(('.ttf', '.otf'))]
        if not files:
            files = [os.path.join(ROOT, p) for p in fam['files'] if p.lower().endswith('.woff2')]
        keep_italic = fam['group'] in ('classic-serif', 'display-serif')
        if not keep_italic:
            files = [p for p in files if 'italic' not in os.path.basename(p).lower()]
        # de-dup statics: if a variable file exists, drop statics
        var = [p for p in files if '[' in os.path.basename(p)]
        if var: files = var
        if is_cjk and len(files) > 3:  # LXGW etc: keep up to 3 weights
            files = files[:3]
        fams.append(fam)
        for i, p in enumerate(files):
            jobs.append((fam, p, i, cj if is_cjk else LATIN))
    with ProcessPoolExecutor(8) as ex:
        res = [r for r in ex.map(job, jobs) if r]
    man_path = os.path.join(OUT, 'manifest.json')
    old = json.load(open(man_path)) if (only_cjk and os.path.exists(man_path)) else []
    old = [m for m in old if not (only_cjk and m['cjk'])]
    manifest = old
    for fam in fams:
        fl = [r for r in res if r['slug'] == fam['slug']]
        if not fl: print('FAILED', fam['slug']); continue
        name = clean_name(fam['name'])
        name = FIX.get(fam['slug'], name)
        manifest.append(dict(family=name, slug=fam['slug'], group=fam['group'], tags=fam.get('styleTags', []), cjk=fam['group'] == 'cjk',
                             license=fam['license'], source=fam.get('sourceUrl', ''),
                             wmin=min(f['wmin'] for f in fl), wmax=max(f['wmax'] for f in fl),
                             weights=sorted({f['wmin'] for f in fl if f['style']=='normal'}),
                             variable=any(f['wmin'] != f['wmax'] for f in fl),
                             files=[{k: f[k] for k in ('url', 'weight', 'style', 'bytes')} for f in fl]))
    json.dump(manifest, open(man_path, 'w'), ensure_ascii=False, indent=0)
    print(len(manifest), 'families', sum(f['bytes'] for m in manifest for f in m['files'])/1e6, 'MB')
