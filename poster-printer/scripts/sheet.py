import sys, os, glob
from PIL import Image, ImageDraw
files = sorted(sys.argv[2:])
cols = 8; tw = 200; th = 250
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), 'white')
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB'); im.thumbnail((tw - 6, th - 22))
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x + 3, y + 3)); d.text((x + 4, y + th - 18), os.path.basename(f)[:28], fill='black')
sheet.save(sys.argv[1], quality=85)
