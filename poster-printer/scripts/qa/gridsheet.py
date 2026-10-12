import sys
from PIL import Image, ImageDraw
out=sys.argv[1]; files=sys.argv[2:]
C=560; cols=3; rows=(len(files)+cols-1)//cols
S=Image.new('RGB',(cols*C+(cols+1)*10, rows*(C+22)+10),(235,233,228))
d=ImageDraw.Draw(S)
for i,f in enumerate(files):
    im=Image.open(f).convert('RGB'); im.thumbnail((C,C))
    x=10+(i%cols)*(C+10); y=10+(i//cols)*(C+22)
    S.paste(im,(x+(C-im.width)//2,y+(C-im.height)//2)); d.text((x,y+C+4),f.split('/')[-1][:60],fill=(60,60,60))
S.save(out,quality=88)
