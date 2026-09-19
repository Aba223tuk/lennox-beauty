# The generated ampoule labels read "SML/0.17FL.OZ". The real ampoule reads 5ML.
# A misprinted label is the single loudest "this was made by a machine" tell on the
# whole set, so the wrong glyph gets repainted the same way all the other type on
# these ads is painted: locally, in a real font, matched to the shot.
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, os, math

AD    = r"C:/Users/illia/sites/lennox-beauty/img/ads"
FONTS = r"C:/Users/illia/AppData/Local/Temp/claude/C--Users-illia/eca1d579-f96c-4c24-8cb6-b580ed65e6c8/scratchpad/fonts"

# volume line per file, identified by the 14 / 6 / 13 cluster signature of
# "Micro Infusion" / "System" / "SML/0.17FL.OZ"
RUNS = {
 "scalp-guarantee-4x5.jpg":  (1076,1103,463,597),
 "scalp-guarantee-9x16.jpg": (1506,1516,478,584),
 "scalp-mechanism-4x5.jpg":  (1156,1166,490,582),
 "scalp-mechanism-9x16.jpg": (1559,1576,466,597),
 "scalp-partline-4x5.jpg":   (1131,1142,490,581),
}

def textmask(a, y1, y2, x1, x2):
    R,G,B = a[:,:,0],a[:,:,1],a[:,:,2]
    blue=(B-R>45)&(B>80); light=(R>150)&(G>180)&(B>200)
    left=np.cumsum(blue,axis=1)>0
    right=(np.cumsum(blue[:,::-1],axis=1)>0)[:,::-1]
    m=np.zeros(R.shape,bool)
    m[y1:y2+1, x1:x2+1] = (light&left&right)[y1:y2+1, x1:x2+1]
    return m

def clusters(m, y1, y2, x1, x2):
    cols = m[y1:y2+1, x1:x2+1].any(axis=0)
    out=[]; s=None
    for i,c in enumerate(cols):
        if c and s is None: s=i
        elif not c and s is not None: out.append((x1+s, x1+i-1)); s=None
    if s is not None: out.append((x1+s, x1+len(cols)-1))
    return out

def run(fn):
    p=os.path.join(AD,fn)
    im=Image.open(p).convert("RGB")
    a=np.asarray(im).astype(int)
    y1,y2,x1,x2 = RUNS[fn]
    m = textmask(a,y1,y2,x1,x2)
    cl = clusters(m,y1,y2,x1,x2)
    if not cl: raise SystemExit("no glyphs in "+fn)

    # baseline angle, from the vertical drift of glyph centroids across the line
    cx,cy=[],[]
    for gx1,gx2 in cl:
        sub=m[y1:y2+1, gx1:gx2+1]
        ys,xs=np.where(sub)
        if len(ys)<3: continue
        cx.append(gx1+xs.mean()); cy.append(y1+ys.mean())
    angle=0.0
    if len(cx)>=3:
        slope=np.polyfit(cx,cy,1)[0]
        angle=math.degrees(math.atan(slope))

    # the "S" is the first glyph
    sx1,sx2 = cl[0]
    sub=m[y1:y2+1, sx1:sx2+1]
    ys,_=np.where(sub)
    sy1,sy2 = y1+ys.min(), y1+ys.max()
    gh = sy2-sy1+1

    # colours: the text itself, and the glass it sits on
    box=a[sy1:sy2+1, sx1:sx2+1]
    msk=m[sy1:sy2+1, sx1:sx2+1]
    ink = box[msk].mean(axis=0) if msk.sum() else np.array([235,245,250])
    print("%-28s glyph %dx%d at (%d,%d) angle %.2f ink %s" %
          (fn, sx2-sx1+1, gh, sx1, sy1, angle, ink.round(0)))

    # 1. erase the S: vertical crossfade between clean glass above and below the line
    pad=4
    top = a[y1-pad-1, sx1-2:sx2+3].astype(float)
    bot = a[y2+pad+1, sx1-2:sx2+3].astype(float)
    ex1,ex2 = sx1-2, sx2+2
    H = (y2+pad) - (y1-pad) + 1
    patch=np.zeros((H, ex2-ex1+1, 3))
    for i in range(H):
        t=i/(H-1)
        patch[i]=top*(1-t)+bot*t
    out=np.asarray(im).astype(float).copy()
    out[y1-pad:y2+pad+1, ex1:ex2+1] = patch
    base=Image.fromarray(out.astype(np.uint8))
    # soften the seam so the repair reads as glass, not as a rectangle
    reg=base.crop((ex1-3, y1-pad-3, ex2+4, y2+pad+4)).filter(ImageFilter.GaussianBlur(1.1))
    base.paste(reg, (ex1-3, y1-pad-3))

    # 2. paint a 5 in its place
    from PIL import ImageFont
    f=ImageFont.truetype(FONTS+"/inter.ttf", max(6,int(round(gh/0.727))))
    try: f.set_variation_by_name("Regular")
    except Exception: pass
    S=8  # supersample
    fb=ImageFont.truetype(FONTS+"/inter.ttf", max(6,int(round(gh/0.727)))*S)
    try: fb.set_variation_by_name("Regular")
    except Exception: pass
    tmp=Image.new("L",(gh*S*3, gh*S*3),0)
    ImageDraw.Draw(tmp).text((gh*S, gh*S//2), "5", font=fb, fill=255)
    bb=tmp.getbbox(); tmp=tmp.crop(bb)
    tw=max(1,int(round((sx2-sx1+1))));  th=max(1,gh)
    tmp=tmp.resize((tw,th), Image.LANCZOS)
    if abs(angle)>0.25:
        tmp=tmp.rotate(-angle, expand=True, resample=Image.BICUBIC)
    tmp=tmp.filter(ImageFilter.GaussianBlur(max(0.35, gh/22)))
    # the printed text is not pure white on glass — match its measured density
    alpha=tmp.point(lambda v: int(v*0.93))
    col=Image.new("RGB", tmp.size, tuple(int(c) for c in ink))
    px = sx1 - (tmp.width-tw)//2
    py = sy1 - (tmp.height-th)//2
    base.paste(col, (px,py), alpha)

    base.save(p, quality=95, subsampling=0)
    return fn

for fn in RUNS: run(fn)
print("done")
