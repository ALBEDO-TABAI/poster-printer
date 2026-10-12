"""Justified-row contact sheet for posters of mixed aspect ratios.
usage: python3 scripts/contact_sheet.py out.jpg [--width 2400] [--row 360] [--labels] img1.png img2.png ..."""
import sys, os
from PIL import Image, ImageDraw, ImageFont
args = sys.argv[1:]
out = args.pop(0)
W, ROW, labels = 2400, 360, False
files = []
while args:
    a = args.pop(0)
    if a == '--width': W = int(args.pop(0))
    elif a == '--row': ROW = int(args.pop(0))
    elif a == '--labels': labels = True
    else: files.append(a)
GAP, PAD, LAB = 16, 40, (22 if labels else 0)
ims = [Image.open(f).convert('RGB') for f in files]
rows, cur, cw = [], [], 0
for f, im in zip(files, ims):
    w = im.width * ROW / im.height
    if cur and cw + w + GAP * len(cur) > W - 2 * PAD:
        rows.append(cur); cur, cw = [], 0
    cur.append((f, im, w)); cw += w
if cur: rows.append(cur)
layout, y = [], PAD
for i, r in enumerate(rows):
    total = sum(w for _, _, w in r); avail = W - 2 * PAD - GAP * (len(r) - 1)
    s = avail / total if i < len(rows) - 1 or total > avail * 0.75 else 1
    h = ROW * s; x = PAD
    for f, im, w in r:
        layout.append((f, im, int(x), int(y), int(w * s), int(h))); x += w * s + GAP
    y += h + GAP + LAB
H = int(y + PAD - GAP)
sheet = Image.new('RGB', (W, H), (236, 233, 226))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
except Exception: font = ImageFont.load_default()
for f, im, x, y, w, h in layout:
    sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    if labels: d.text((x, y + h + 4), os.path.splitext(os.path.basename(f))[0], fill=(60, 60, 60), font=font)
sheet.save(out, quality=88)
print(out, sheet.size)
