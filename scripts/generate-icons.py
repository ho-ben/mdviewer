from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONT_CANDIDATES = [
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    scale = size / 512
    image = Image.new("RGB", (size, size), "#f6f3ec")
    draw = ImageDraw.Draw(image)

    def box(values):
        return tuple(round(value * scale) for value in values)

    # Everything stays within Android's circular safe area.
    font_path = next((path for path in FONT_CANDIDATES if path.exists()), None)
    font = ImageFont.truetype(str(font_path), round(180 * scale)) if font_path else ImageFont.load_default(size=round(180 * scale))
    draw.text(box((72, 165)), "M", font=font, fill="#171916", stroke_width=0)

    # A light document outline with a folded corner.
    width = max(3, round(11 * scale))
    page = [box((285, 134)), box((368, 134)), box((418, 184)), box((418, 374)), box((285, 374)), box((285, 134))]
    draw.line(page, fill="#171916", width=width, joint="curve")
    draw.line([box((368, 134)), box((368, 184)), box((418, 184))], fill="#171916", width=width, joint="curve")

    # Cobalt download arrow, sized for recognition at launcher scale.
    arrow_width = max(3, round(17 * scale))
    draw.line([box((351, 215)), box((351, 307))], fill="#3057d5", width=arrow_width)
    draw.line([box((319, 279)), box((351, 313)), box((383, 279))], fill="#3057d5", width=arrow_width, joint="curve")
    return image


draw_icon(192).save(ROOT / "public" / "icon-192.png", optimize=True)
draw_icon(512).save(ROOT / "public" / "icon-512.png", optimize=True)
draw_icon(512, maskable=True).save(ROOT / "public" / "icon-maskable-512.png", optimize=True)
