"""Fetch CC0 (Open Access, public-domain) images from The Metropolitan Museum of Art collection API.
Writes scripts/img_raw/met/<category>/<objectID>.jpg + provenance.json"""
import json, os, sys, time, urllib.request, urllib.parse, io
from PIL import Image
API = 'https://collectionapi.metmuseum.org/public/collection/v1'
OUT = os.path.join(os.path.dirname(__file__), 'img_raw', 'met')
Q = {
 'east-arch': ['pagoda', 'Hiroshige temple', 'Hasui temple', 'Hiroshige bridge', 'Japanese castle print', 'Chinese pavilion painting', 'shrine gate print'],
 'landscape': ['Hiroshige snow', 'Hokusai Fuji', 'Hudson River School', 'mountain lake landscape painting', 'Monet', 'seascape painting', 'Hasui moon'],
 'figure': ['woman with umbrella print', 'dancer Degas', 'figure in landscape', 'woman in kimono print', 'boatman', 'woman reading painting'],
 'flora': ['iris print', 'peony', 'botanical watercolor', 'flowers and birds', 'lotus painting', 'chrysanthemum print', 'camellia'],
 'street': ['Atget street', 'street photograph Paris', 'New York street photograph', 'rain street photograph', 'city night photograph'],
 'pattern': ['marbled paper', 'katagami stencil'],
 'sculpture': ['marble statue Venus', 'bodhisattva sculpture', 'marble head of a youth', 'bronze statue Hermes', 'Rodin'],
}
PER = 8
import os as _o
if _o.environ.get('MET_Q'): Q = json.loads(_o.environ['MET_Q'])
PROV = _o.environ.get('MET_PROV', 'provenance.json')
def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'poster-printer-asset-fetch/1.0'})
            return urllib.request.urlopen(req, timeout=60).read()
        except Exception as e:
            time.sleep(1 + i)
    return None
prov = []
for cat, qs in Q.items():
    os.makedirs(os.path.join(OUT, cat), exist_ok=True)
    got = 0
    for q in qs:
        if got >= PER * 2: break
        r = get(f"{API}.1/search?hasImages=true&isPublicDomain=true&limit=20&q={urllib.parse.quote(q)}")
        if not r: continue
        ids = (json.loads(r).get('objectIDs') or [])[:12]
        n = 0
        for oid in ids:
            if n >= 3: break
            o = get(f"{API}/objects/{oid}")
            if not o: continue
            o = json.loads(o)
            if not o.get('isPublicDomain') or not o.get('primaryImage'): continue
            title = o.get('title', '')
            if any(w in title.lower() for w in ('portrait', 'nude', 'disrob', 'bath', 'venus', 'aphrodite')): continue
            img = get(o['primaryImage'])
            if not img: continue
            try:
                im = Image.open(io.BytesIO(img)).convert('RGB')
            except Exception: continue
            if max(im.size) < 900: continue
            im.thumbnail((1800, 1800), Image.LANCZOS)
            fn = os.path.join(OUT, cat, f"{oid}.jpg")
            im.save(fn, quality=88)
            prov.append(dict(file=os.path.relpath(fn, OUT), category=cat, query=q, objectID=oid, title=title, artist=o.get('artistDisplayName', ''), date=o.get('objectDate', ''), url=o.get('objectURL', ''), license='CC0 1.0 (The Met Open Access)', size=im.size))
            n += 1; got += 1
            print(cat, oid, title[:60], im.size, flush=True)
json.dump(prov, open(os.path.join(OUT, PROV), 'w'), indent=1, ensure_ascii=False)
print('done', len(prov))
