"""Original flat 'modern illustration' scenes (released CC0 1.0 by the Ready Poster Printer project). Pure geometry, no references.
Writes scripts/img_raw/illus/*.jpg + provenance.json."""
import os, json, math, random
from PIL import Image, ImageDraw, ImageFilter
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img_raw', 'illus'); os.makedirs(OUT, exist_ok=True)
S = 2  # supersample
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def canvas(w, h, top, bot=None):
    im = Image.new('RGB', (w * S, h * S), hexc(top))
    if bot:
        a, b = hexc(top), hexc(bot); d = ImageDraw.Draw(im)
        for y in range(h * S):
            t = y / (h * S); d.line([(0, y), (w * S, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    return im, ImageDraw.Draw(im)
def P(pts): return [(x * S, y * S) for x, y in pts]
def save(im, name, desc):
    w, h = im.size; im = im.resize((w // S, h // S), Image.LANCZOS)
    # a whisper of tooth so flat fills don't band on export
    n = Image.effect_noise(im.size, 6).convert('L'); im = Image.blend(im, Image.merge('RGB', (n, n, n)), 0.025)
    im.save(os.path.join(OUT, name + '.jpg'), quality=90); prov.append(dict(file=name + '.jpg', title=desc))
prov = []
R = random.Random(7)

# 1 sun over layered dunes
im, d = canvas(1500, 2000, '#f4d9c2', '#eab79a')
d.ellipse(P([(520, 520), (980, 980)]), fill=hexc('#e2553a'))
for i, (c, y0) in enumerate([('#d98c62', 1150), ('#c46a46', 1350), ('#9c4a33', 1560), ('#6e3226', 1780)]):
    pts = [(0, 2000)] + [(x, y0 + 90 * math.sin(x / (260 + i * 70) + i * 1.7) + 40 * math.sin(x / 90 + i)) for x in range(0, 1501, 10)] + [(1500, 2000)]
    d.polygon(P(pts), fill=hexc(c))
save(im, 'illus-dunes-sun', 'Sun over layered dunes')

# 2 arches & shadows (architecture)
im, d = canvas(1500, 2000, '#efe6d8')
for k in range(3):
    x = 170 + k * 420; d.rectangle(P([(x, 700), (x + 320, 2000)]), fill=hexc('#2f4a6d'))
    d.ellipse(P([(x, 540), (x + 320, 860)]), fill=hexc('#2f4a6d'))
    d.polygon(P([(x + 320, 860), (x + 420, 820), (x + 420, 2000), (x + 320, 2000)]), fill=hexc('#d7c7ae'))
d.rectangle(P([(0, 1640), (1500, 2000)]), fill=hexc('#c9b190'))
for k in range(3):
    x = 170 + k * 420; d.polygon(P([(x, 1640), (x + 320, 1640), (x + 470, 1900), (x + 150, 1900)]), fill=hexc('#1f3554'))
save(im, 'illus-arches', 'Three arches with long shadows')

# 3 still life: vase, fruit, table
im, d = canvas(1500, 2000, '#2c3d33')
d.rectangle(P([(0, 1380), (1500, 2000)]), fill=hexc('#b35a3c'))
d.ellipse(P([(560, 640), (940, 1380)]), fill=hexc('#ead9b8'))
d.rectangle(P([(660, 520), (840, 760)]), fill=hexc('#ead9b8'))
d.ellipse(P([(640, 480), (860, 560)]), fill=hexc('#d9c6a1'))
for cx, cy, r, c in [(380, 1300, 120, '#e9a23b'), (1080, 1310, 110, '#e7cf5a'), (1230, 1330, 80, '#d94f2b')]:
    d.ellipse(P([(cx - r, cy - r), (cx + r, cy + r)]), fill=hexc(c))
d.line(P([(750, 520), (700, 250)]), fill=hexc('#5f7d4e'), width=14 * S)
d.ellipse(P([(560, 160), (760, 330)]), fill=hexc('#7d9a5c')); d.ellipse(P([(690, 120), (900, 290)]), fill=hexc('#93ad6e'))
save(im, 'illus-still-life', 'Vase and fruit on a table')

# 4 window with leaves
im, d = canvas(1500, 2000, '#e4e8e1')
d.rectangle(P([(300, 260), (1200, 1500)]), fill=hexc('#a9c3cf')); d.rectangle(P([(300, 260), (1200, 1500)]), outline=hexc('#f6f3ec'), width=40 * S)
d.line(P([(750, 260), (750, 1500)]), fill=hexc('#f6f3ec'), width=26 * S); d.line(P([(300, 880), (1200, 880)]), fill=hexc('#f6f3ec'), width=26 * S)
d.rectangle(P([(240, 1500), (1260, 1560)]), fill=hexc('#d6d2c6'))
d.polygon(P([(560, 1560), (940, 1560), (900, 1900), (600, 1900)]), fill=hexc('#c66b44'))
for a in range(-70, 75, 20):
    r = math.radians(a - 90); L = 520 - abs(a) * 2.2; x0, y0 = 750, 1560
    x1, y1 = x0 + math.cos(r) * L, y0 + math.sin(r) * L
    nx, ny = -math.sin(r) * 70, math.cos(r) * 70
    d.polygon(P([(x0, y0), ((x0 + x1) / 2 + nx, (y0 + y1) / 2 + ny), (x1, y1), ((x0 + x1) / 2 - nx, (y0 + y1) / 2 - ny)]), fill=hexc('#2f6b4a' if a % 40 else '#3f8a5c'))
save(im, 'illus-window-plant', 'Window with a potted plant')

# 5 moon & sea (landscape)
im, d = canvas(2000, 1400, '#14213d', '#27416b')
d.ellipse(P([(1320, 220), (1580, 480)]), fill=hexc('#f2e6c9'))
d.rectangle(P([(0, 860), (2000, 1400)]), fill=hexc('#0e1a30'))
for i in range(26):
    y = 900 + i * 20; w = 30 + (i * 13) % 80; x = 1450 + R.uniform(-60, 60) - w / 2
    d.rectangle(P([(x, y), (x + w, y + 4)]), fill=hexc('#c9bea4'))
d.polygon(P([(0, 860), (300, 700), (620, 860)]), fill=hexc('#0b1526')); d.polygon(P([(420, 860), (760, 740), (1100, 860)]), fill=hexc('#101d33'))
save(im, 'illus-moon-sea', 'Moon over a night sea')

# 6 geometric composition (bauhaus-like shapes)
im, d = canvas(1500, 2000, '#ece4d3')
d.rectangle(P([(0, 0), (750, 1000)]), fill=hexc('#1d3b8f'))
d.pieslice(P([(750, 250), (1750, 1250)]), 90, 270, fill=hexc('#e2452f'))
d.ellipse(P([(220, 1220), (720, 1720)]), fill=hexc('#f0b429'))
d.rectangle(P([(750, 1250), (1500, 2000)]), fill=hexc('#151515'))
d.polygon(P([(750, 1250), (1500, 2000), (750, 2000)]), fill=hexc('#ece4d3'))
save(im, 'illus-geometry', 'Primary geometric shapes')

# 7 palm & sun (portrait)
im, d = canvas(1500, 2000, '#f6c7a9', '#f39c7a')
d.ellipse(P([(820, 300), (1260, 740)]), fill=hexc('#fbe5c8'))
d.rectangle(P([(0, 1600), (1500, 2000)]), fill=hexc('#2e5d6b'))
d.line(P([(560, 1600), (600, 760)]), fill=hexc('#3b2a2a'), width=28 * S)
for a in range(0, 360, 36):
    r = math.radians(a); x1, y1 = 600 + math.cos(r) * 380, 760 + math.sin(r) * 200 + 120
    d.line(P([(600, 760), (x1, y1)]), fill=hexc('#2c4f3a'), width=34 * S)
save(im, 'illus-palm', 'Palm against a low sun')

# 8 stairs & doors (architecture, landscape)
im, d = canvas(2000, 1400, '#f1ebe0')
for k in range(9):
    x = 200 + k * 140; y = 1300 - k * 110
    d.rectangle(P([(x, y), (2000, y + 110)]), fill=hexc('#e2c8a8' if k % 2 else '#d6b893'))
d.rectangle(P([(1420, 140), (1700, 600)]), fill=hexc('#295b4f')); d.ellipse(P([(1420, 0), (1700, 280)]), fill=hexc('#295b4f'))
d.polygon(P([(0, 1400), (0, 900), (520, 1400)]), fill=hexc('#c45a3c'))
save(im, 'illus-stairs-door', 'Stairs climbing to a green door')
json.dump(prov, open(os.path.join(OUT, 'provenance.json'), 'w'), indent=1)
print(len(prov))
