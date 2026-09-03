#!/usr/bin/env python3
"""يبني أصولَ الهويّة من شعار الجمعيّة المصريّة لأبحاث السرطان.

    python tools/make_icons.py

المصدر: brand/logo-source.png (الختمُ الدائريُّ للجمعيّة)
المُخرَج في theme/static/img:
    logo.png · logo-mark.png · icon-32/180/192/512.png · maskable.png · share.png
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "brand" / "logo-source.png"
OUT = ROOT / "theme" / "static" / "img"

INK = (11, 11, 16, 255)
BRAND = (194, 24, 91, 255)   # ورديُّ الشعار نفسه
SPARK = (0, 171, 203, 255)   # فيروزُ الشعار
PAPER = (255, 255, 255, 255)
SUPER = 3


def load_seal(size: int = 1024) -> Image.Image:
    """يقصّ الختمَ الدائريَّ من الشعار الأصلي ويجعل ما خارجَه شفّافاً."""
    source = Image.open(SOURCE).convert("RGBA")

    # حدودُ الختم: الشفافيّةُ أوّلاً إن وُجدت، وإلّا فالبكسل غيرُ الأبيض.
    # الشعارُ قد يأتي بخلفيّةٍ بيضاء أو شفّافة، وكلتاهما تُقصّ هنا سواء.
    alpha = source.getchannel("A")
    box = alpha.getbbox() if alpha.getextrema()[0] < 250 else None
    if box is None:
        grey = source.convert("L").point(lambda v: 255 if v < 232 else 0)
        box = grey.getbbox()
    box = box or (0, 0, *source.size)
    left, top, right, bottom = box
    cx, cy = (left + right) / 2, (top + bottom) / 2
    radius = max(right - left, bottom - top) / 2

    crop = source.crop((
        int(cx - radius), int(cy - radius), int(cx + radius), int(cy + radius)
    )).resize((size, size), Image.LANCZOS)

    # قناعٌ دائريٌّ بحوافَّ ناعمة
    mask = Image.new("L", (size * 2, size * 2), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size * 2 - 1, size * 2 - 1], fill=255)
    mask = mask.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))

    seal = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    seal.paste(crop, (0, 0), mask)
    return seal


def on_disc(seal: Image.Image, size: int, padding: float = 0.08,
            background: tuple[int, ...] = PAPER, rounded: bool = True) -> Image.Image:
    """يضع الختمَ على خلفيّةٍ مربّعةٍ مستديرة الأركان — أيقونةُ تطبيق."""
    side = size * SUPER
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    if rounded:
        draw.rounded_rectangle([0, 0, side - 1, side - 1], radius=int(side * 0.22), fill=background)
    else:
        draw.rectangle([0, 0, side - 1, side - 1], fill=background)

    inner = int(side * (1 - padding * 2))
    mark = seal.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(mark, (int((side - inner) / 2), int((side - inner) / 2)))
    return canvas.resize((size, size), Image.LANCZOS)


def make_share(seal: Image.Image, width: int = 1200, height: int = 630) -> Image.Image:
    """صورةُ المشاركة: خلفيّةٌ حبريّةٌ بتوهّجٍ وختمٌ على قرصٍ أبيض."""
    canvas = Image.new("RGBA", (width, height), INK)

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    for step in range(80):
        t = step / 80
        radius = int(width * (0.72 - t * 0.6))
        colour = tuple(round(a + (b - a) * t) for a, b in zip(BRAND[:3], SPARK[:3])) + (5,)
        draw.ellipse([width * 0.8 - radius, -radius * 0.4, width * 0.8 + radius, radius * 1.5], fill=colour)
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(24)))

    disc = 380
    ring = Image.new("RGBA", (disc + 26, disc + 26), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([0, 0, disc + 25, disc + 25], fill=PAPER)
    canvas.alpha_composite(ring, (int(width / 2 - (disc + 26) / 2), int(height / 2 - (disc + 26) / 2 - 16)))
    canvas.alpha_composite(seal.resize((disc, disc), Image.LANCZOS),
                           (int(width / 2 - disc / 2), int(height / 2 - disc / 2 - 16)))

    draw = ImageDraw.Draw(canvas)
    draw.line([width / 2 - 110, height - 92, width / 2 + 110, height - 92], fill=SPARK, width=6)
    return canvas


def main() -> int:
    if not SOURCE.exists():
        print(f"  ✗ لم يُعثر على الشعار: {SOURCE}")
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    seal = load_seal(1024)

    outputs = {
        "logo.png": seal.resize((512, 512), Image.LANCZOS),
        "logo-mark.png": seal.resize((128, 128), Image.LANCZOS),
        "icon-32.png": on_disc(seal, 32, padding=0.04, rounded=False),
        "icon-180.png": on_disc(seal, 180, padding=0.06),
        "icon-192.png": on_disc(seal, 192, padding=0.06),
        "icon-512.png": on_disc(seal, 512, padding=0.06),
        "maskable.png": on_disc(seal, 512, padding=0.2),
        "share.png": make_share(seal),
    }
    for name, image in outputs.items():
        path = OUT / name
        image.convert("RGBA").save(path, "PNG", optimize=True)
        print(f"  ✔ {name} — {path.stat().st_size // 1024} ك.ب")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
