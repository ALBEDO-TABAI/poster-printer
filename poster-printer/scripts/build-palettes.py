"""Build public/data/palettes.json from MIT-licensed palette datasets with computed metrics."""
import json, math, os, shutil
V = os.path.join(os.path.dirname(__file__), 'vendor')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'palettes.json')

def srgb2lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hex2rgb(h):
    h = h.lstrip('#'); return [int(h[i:i+2], 16) for i in (0, 2, 4)]

def lab(h):
    r, g, b = [srgb2lin(x) for x in hex2rgb(h)]
    X = (0.4124*r + 0.3576*g + 0.1805*b) / 0.95047
    Y = (0.2126*r + 0.7152*g + 0.0722*b)
    Z = (0.0193*r + 0.1192*g + 0.9505*b) / 1.08883
    f = lambda t: t ** (1/3) if t > 216/24389 else (24389/27*t + 16) / 116
    fx, fy, fz = f(X), f(Y), f(Z)
    return 116*fy - 16, 500*(fx-fy), 200*(fy-fz)

def metrics(cols):
    labs = [lab(c) for c in cols]
    L = [l[0] for l in labs]; C = [math.hypot(l[1], l[2]) for l in labs]
    mL = sum(L)/len(L); mC = sum(C)/len(C); rL = max(L)-min(L)
    light = 'dark' if mL < 38 else 'calm' if mL < 55 else 'bright' if mL < 72 else 'luminous'
    chroma = 'soft' if mC < 22 else 'mid' if mC < 42 else 'rich'
    contrast = 'gentle' if rL < 30 else 'clear' if rL < 55 else 'strong'
    tags = []
    if mL < 40 and rL >= 25: tags.append('noir')
    if mC < 26 and 45 <= mL <= 78 and rL < 45: tags.append('muted')
    if mL > 72 and 12 < mC < 45: tags.append('pastel')
    # vintage: warm hues, medium chroma
    warm = sum(1 for l in labs if l[2] > 8 and l[1] > -5) / len(labs)
    if warm >= .5 and 15 < mC < 45 and 35 < mL < 75: tags.append('vintage')
    if mC >= 45 and rL >= 40: tags.append('pop')
    return dict(L=round(mL, 1), C=round(mC, 1), dL=round(rL, 1), light=light, chroma=chroma, contrast=contrast, tags=tags)

out = []
colors = json.load(open(os.path.join(V, 'dictionary-of-colour-combinations', 'colors.json')))
combos = {}
for c in colors:
    for k in c['combinations']:
        combos.setdefault(k, []).append((c['hex'], c['name']))
for k in sorted(combos):
    cols = [h for h, _ in combos[k]]
    out.append(dict(id=f'w{k:03d}', src='wada', colors=cols, names=[n for _, n in combos[k]], **metrics(cols)))
nice = json.load(open(os.path.join(V, 'nice-color-palettes', '1000.json')))
seen = set()
for i, p in enumerate(nice):
    key = tuple(p)
    if key in seen: continue
    seen.add(key)
    out.append(dict(id=f'n{i:04d}', src='nice', colors=p, **metrics(p)))
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print(len(out), 'palettes')
L = os.path.join(os.path.dirname(__file__), '..', 'licenses')
shutil.copy(os.path.join(V, 'dictionary-of-colour-combinations', 'LICENSE.md'), os.path.join(L, 'dictionary-of-colour-combinations.LICENSE.md'))
shutil.copy(os.path.join(V, 'nice-color-palettes', 'LICENSE.md'), os.path.join(L, 'nice-color-palettes.LICENSE.md'))
from collections import Counter
print(Counter(p['light'] for p in out), Counter(p['chroma'] for p in out), Counter(p['contrast'] for p in out), Counter(t for p in out for t in p['tags']))
