# Draws the app icon: Sadu "teeth" (ضروس) band in red and wool on tent black.
# Run: python scripts/make_icon.py  (writes into app/assets and app/public)
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "app"
GROUND, RED, WOOL = (21, 16, 14), (179, 38, 46), (239, 230, 216)


def icon(size: int, pad: float = 0.0, ground=GROUND) -> Image.Image:
    s = 1024
    im = Image.new("RGBA", (s, s), ground)
    d = ImageDraw.Draw(im)
    inset = int(s * pad)
    w = s - 2 * inset
    n = 5
    tw = w / n
    top, mid, bot = s * 0.30, s * 0.50, s * 0.70
    for i in range(n):
        x = inset + i * tw
        # upper row: red teeth pointing down, lower row: wool teeth pointing up, offset half a tooth
        d.polygon([(x, top), (x + tw, top), (x + tw / 2, mid)], fill=RED)
        d.polygon([(x + tw / 2, bot), (x + tw * 1.5, bot), (x + tw, mid)], fill=WOOL)
    d.polygon([(inset, bot), (inset + tw / 2, bot), (inset, mid)], fill=WOOL)
    d.rectangle([inset, top - s * 0.05, s - inset, top - s * 0.035], fill=WOOL)
    d.rectangle([inset, bot + s * 0.035, s - inset, bot + s * 0.05], fill=RED)
    return im.resize((size, size), Image.LANCZOS)


(ROOT / "public").mkdir(exist_ok=True)
icon(1024).save(ROOT / "assets/icon.png")
icon(48).save(ROOT / "assets/favicon.png")
icon(1024, pad=0.18, ground=(0, 0, 0, 0)).save(ROOT / "assets/android-icon-foreground.png")
Image.new("RGBA", (1024, 1024), GROUND).save(ROOT / "assets/android-icon-background.png")
icon(180).convert("RGB").save(ROOT / "public/apple-touch-icon.png")
icon(192).save(ROOT / "public/logo192.png")
icon(512).save(ROOT / "public/logo512.png")
print("icons written")
