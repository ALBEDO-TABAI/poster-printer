"""Before/after comparison sheet: rows of (before | after) pairs with ratings.
usage: python3 scripts/qa/before_after.py out.jpg BEFORE_DIR AFTER_DIR ratings_before ratings_after q001 q002 ..."""
import sys, re
from PIL import Image, ImageDraw, ImageFont
out, bd, ad, rb, ra, *ids = sys.argv[1:]
rd = lambda f: dict(re.findall(r'(q\d{3}) (\d+)', open(f).read()))
RB, RA = rd(rb), rd(ra)
C, G, COLS = 520, 14, 2  # each cell is a pair
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
except Exception: F = ImageFont.load_default()
pw = 2 * C + G; rows = (len(ids) + COLS - 1) // COLS
S = Image.new('RGB', (COLS * pw + (COLS + 1) * 40, rows * (C + 40) + 90), (236, 234, 229))
d = ImageDraw.Draw(S)
d.text((40, 28), 'REA Poster · phase 3 aesthetic pass · before (left) vs after (right), same seed / style / composition / ratio', fill=(40, 40, 40), font=F)
for i, q in enumerate(ids):
    x0 = 40 + (i % COLS) * (pw + 40); y0 = 80 + (i // COLS) * (C + 40)
    for k, dd in enumerate((bd, ad)):
        im = Image.open(f'{dd}/{q}.png').convert('RGB'); im.thumbnail((C, C))
        x = x0 + k * (C + G)
        S.paste(im, (x + (C - im.width) // 2, y0 + (C - im.height) // 2))
    d.text((x0, y0 + C + 6), f'{q}   before {RB.get(q, "?")}/10  →  after {RA.get(q, "?")}/10', fill=(50, 50, 50), font=F)
S.save(out, quality=88)
print(out, S.size)
