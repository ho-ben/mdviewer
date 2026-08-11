from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    scale = size / 512
    image = Image.new("RGB", (size, size), "#f6f3ec")
    draw = ImageDraw.Draw(image)

    def box(values):
        return tuple(round(value * scale) for value in values)

    outer = (78, 54, 434, 458) if maskable else (58, 38, 454, 474)
    draw.rounded_rectangle(box(outer), radius=round(78 * scale), fill="#171916")
    draw.rounded_rectangle(box((118, 90, 394, 422)), radius=round(28 * scale), fill="#fffefa")

    draw.rounded_rectangle(box((153, 127, 291, 141)), radius=round(7 * scale), fill="#b9b4a8")
    draw.rounded_rectangle(box((153, 163, 339, 177)), radius=round(7 * scale), fill="#dcd8cd")

    draw.rounded_rectangle(box((235, 206, 277, 324)), radius=round(19 * scale), fill="#3057d5")
    draw.polygon([box((192, 292, 192, 292))[:2], box((320, 292, 320, 292))[:2], box((256, 360, 256, 360))[:2]], fill="#3057d5")

    draw.rounded_rectangle(box((153, 374, 337, 388)), radius=round(7 * scale), fill="#dcd8cd")
    return image


draw_icon(192).save(ROOT / "public" / "icon-192.png", optimize=True)
draw_icon(512).save(ROOT / "public" / "icon-512.png", optimize=True)
draw_icon(512, maskable=True).save(ROOT / "public" / "icon-maskable-512.png", optimize=True)
