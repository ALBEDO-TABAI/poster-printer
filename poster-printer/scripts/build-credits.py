"""Generates licenses/IMAGES.md, licenses/FONTS.md and copies upstream font licence files into licenses/fonts/."""
import json, os, shutil, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = os.path.join(ROOT, 'licenses'); os.makedirs(os.path.join(L, 'fonts'), exist_ok=True)
imgs = json.load(open(os.path.join(ROOT, 'public/images/manifest.json')))
out = ['# Preset image credits', '',
       'Every preset image is public domain / CC0, or an original artwork made for this project and released under CC0 1.0. No copyrighted characters or brands; no identifiable living people.', '',
       '- **photo** — contemporary photographs from Wikimedia Commons whose file page carries the CC0 1.0 licence tag (checked via the Commons API `LicenseShortName=CC0`; fetched by `scripts/fetch-commons.py`). Each row links the original file page and names the author.',
       '- **illus** — original flat illustrations drawn procedurally by `scripts/gen-illustrations.py` (CC0 1.0).',
       '- **museum** — public-domain artworks from The Metropolitan Museum of Art Open Access (CC0), `scripts/fetch-met.py`.',
       '- **proc** — original procedural abstracts from `scripts/gen-procedural.py` (CC0 1.0); kept in the pool for manual use but not drawn by the v2 random plan.',
       '', 'GenerateImage was not available in the build environment, so no AI-generated images are included. Cut-outs (`public/images/cut/`) were produced locally with rembg + IS-Net.', '', 'Phase 5: `scripts/precompute-cutouts.py` re-ran IS-Net offline over every preset photo and kept a mask only when it covered 6–55% of the frame, touched the border on <30% of its edge and was >85% one connected shape; the survivors were then checked by eye. 28 cut-outs are shipped (museum heads, vases and statues, a rose window, food and tea, palm, lantern, bicycle, pylon, lighthouse, flowers). Three earlier masks that only held legs or fragments (figure-48893, figure-773108, still-object61337727) were deleted. Cut-outs are derived from the CC0 sources listed below and stay CC0. No identifiable people are cut out.', '',
       '| id | tier | category | title | artist / source | date | licence | cut-out |', '|---|---|---|---|---|---|---|---|']
for m in sorted(imgs, key=lambda x: (x.get('tier', ''), x['category'], x['id'])):
    c = m.get('credit') or {}
    title = (c.get('title') or m.get('title') or '').replace('|', '/')
    if c.get('url'): title = f"[{title}]({c['url']})"
    out.append(f"| {m['id']} | {m.get('tier','')} | {m['category']} | {title} | {(c.get('artist') or '').replace('|','/')} | {c.get('date','')} | {c.get('license','')} | {'yes' if m.get('cutout') else ''} |")
open(os.path.join(L, 'IMAGES.md'), 'w').write('\n'.join(out) + '\n')
fonts = json.load(open(os.path.join(ROOT, 'public/fonts/manifest.json')))
out = ['# Font credits', '', 'All fonts are open-licensed (SIL Open Font License 1.1, Apache 2.0, or the Ubuntu Font Licence) and were subset to WOFF2 by `scripts/build-fonts.py`. Subsetting is a permitted modification; Reserved Font Names are not used for the subsets as product names. Upstream licence texts are in `licenses/fonts/`.', '',
       '| family | group | licence | source |', '|---|---|---|---|']
copied = 0
for f in sorted(fonts, key=lambda x: x['family']):
    out.append(f"| {f['family']} | {f.get('group','')} | {f['license']} | {f.get('source','')} |")
    for lic in glob.glob(f"/workspace/fonts/*/{f['slug']}/*") :
        b = os.path.basename(lic)
        if b.upper().startswith(('OFL', 'LICENSE', 'UFL')):
            shutil.copy(lic, os.path.join(L, 'fonts', f"{f['slug']}-{b}")); copied += 1
open(os.path.join(L, 'FONTS.md'), 'w').write('\n'.join(out) + '\n')
print(len(imgs), 'images,', len(fonts), 'fonts,', copied, 'licence files')
