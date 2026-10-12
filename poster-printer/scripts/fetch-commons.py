"""Collect CC0-licensed photographs from Wikimedia Commons (verified via extmetadata LicenseShortName == 'CC0').
usage: python3 scripts/fetch-commons.py search   -> candidate thumbs + cand.json for manual review
       python3 scripts/fetch-commons.py fetch ID.. -> download 1600px versions of chosen candidates (provenance.json)"""
import json, os, sys, re, time, urllib.request, urllib.parse, html
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, 'img_raw', 'commons'); os.makedirs(os.path.join(D, 'cand'), exist_ok=True)
UA = {'User-Agent': 'Poster-Printer/1.0 (local design tool; CC0 image curation)'}
API = 'https://commons.wikimedia.org/w/api.php?'
TOPICS = {
 'arch': ['modern architecture facade', 'concrete architecture', 'staircase architecture', 'minimalist building', 'skyscraper glass'],
 'interior': ['interior room window light', 'museum interior', 'library interior', 'chair interior'],
 'still': ['still life', 'ceramic vase', 'coffee cup', 'fruit table'],
 'food': ['food plate', 'bread', 'lemons', 'pastry'],
 'plant': ['leaf macro', 'flower macro', 'monstera', 'cactus', 'palm leaves'],
 'land': ['mountain fog', 'desert dunes', 'sea horizon', 'lake mountains', 'forest mist', 'iceland landscape', 'snow mountain'],
 'urban': ['city night lights', 'street rain', 'bridge city', 'subway station', 'neon'],
 'object': ['camera vintage', 'bicycle', 'typewriter', 'shoes', 'hat'],
 'figure': ['silhouette person', 'person back view', 'dancer silhouette', 'umbrella person'],
 'sky': ['clouds sky', 'sunset sky', 'moon'],
}
def api(params):
    url = API + urllib.parse.urlencode(params)
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r: return json.load(r)
        except Exception as e: time.sleep(2 + k * 3)
    return {}
def get(url, path):
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r: open(path, 'wb').write(r.read()); return True
        except Exception: time.sleep(2 + k * 3)
    return False
strip = lambda s: html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()
if sys.argv[1] == 'search':
    cand = {}
    for cat, qs in TOPICS.items():
        for q in qs:
            d = api(dict(action='query', format='json', generator='search', gsrnamespace=6, gsrlimit=14,
                         gsrsearch=f'hastemplate:Cc-zero incategory:Quality_images filetype:bitmap {q}', prop='imageinfo', iiprop='url|size|extmetadata|mime', iiurlwidth=360))
            for p in d.get('query', {}).get('pages', {}).values():
                ii = p['imageinfo'][0]; em = ii['extmetadata']
                if em.get('LicenseShortName', {}).get('value') != 'CC0' or ii.get('mime') != 'image/jpeg': continue
                if min(ii['width'], ii['height']) < 1400: continue
                cid = f"{cat}-{p['pageid']}"
                if any(c.endswith(str(p['pageid'])) for c in cand): continue
                cand[cid] = dict(id=cid, cat=cat, q=q, title=p['title'][5:], w=ii['width'], h=ii['height'], page=ii['descriptionurl'],
                                 artist=strip(em.get('Artist', {}).get('value'))[:80], date=strip(em.get('DateTimeOriginal', {}).get('value'))[:20],
                                 license='CC0 1.0 (Wikimedia Commons, verified LicenseShortName=CC0)', thumb=ii['thumburl'], pageid=p['pageid'])
            print(cat, q, len(cand), flush=True); time.sleep(0.4)
    for c in cand.values():
        tp = os.path.join(D, 'cand', c['id'] + '.jpg')
        if not os.path.exists(tp): get(c['thumb'], tp); time.sleep(0.15)
    json.dump(list(cand.values()), open(os.path.join(D, 'cand.json'), 'w'), indent=1, ensure_ascii=False)
    print(len(cand), 'candidates')
else:
    cand = {c['id']: c for c in json.load(open(os.path.join(D, 'cand.json')))}
    prov = []
    pf = os.path.join(D, 'provenance.json')
    if os.path.exists(pf): prov = json.load(open(pf))
    have = {p['id'] for p in prov}
    for cid in sys.argv[2:]:
        c = cand[cid]
        if cid in have: continue
        d = api(dict(action='query', format='json', pageids=c['pageid'], prop='imageinfo', iiprop='url', iiurlwidth=1800))
        url = list(d['query']['pages'].values())[0]['imageinfo'][0]['thumburl']
        if get(url, os.path.join(D, cid + '.jpg')):
            prov.append({k: c[k] for k in ('id', 'cat', 'title', 'w', 'h', 'page', 'artist', 'date', 'license')}); print('ok', cid, flush=True)
        time.sleep(0.3)
    json.dump(prov, open(pf, 'w'), indent=1, ensure_ascii=False)
