from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONT_CANDIDATES = [
    Path("/System/Library/Fonts/SFNSMono.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
]


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    scale = size / 512
    image = Image.new("RGB", (size, size), "#f6f3ec")
    draw = ImageDraw.Draw(image)

    def box(values):
        return tuple(round(value * scale) for value in values)

    # Reproduce the compact M-down-arrow mark used in the original app header.
    # The rounded square stays entirely inside Android's circular safe area.
    font_path = next((path for path in FONT_CANDIDATES if path.exists()), None)
    font = ImageFont.truetype(str(font_path), round(126 * scale)) if font_path else ImageFont.load_default(size=round(126 * scale))
    stroke = max(2, round(10 * scale))
    draw.rounded_rectangle(box((92, 92, 420, 420)), radius=round(88 * scale), outline="#171916", width=stroke)

    mark = "M↓"
    bounds = draw.textbbox((0, 0), mark, font=font)
    text_width = bounds[2] - bounds[0]
    text_height = bounds[3] - bounds[1]
    position = ((size - text_width) / 2 - bounds[0], (size - text_height) / 2 - bounds[1] - round(4 * scale))
    draw.text(position, mark, font=font, fill="#171916")
    return image


draw_icon(192).save(ROOT / "public" / "icon-mark-192.png", optimize=True)
draw_icon(512).save(ROOT / "public" / "icon-mark-512.png", optimize=True)
draw_icon(512, maskable=True).save(ROOT / "public" / "icon-mark-maskable-512.png", optimize=True)
