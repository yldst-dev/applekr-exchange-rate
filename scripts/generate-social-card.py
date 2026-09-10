from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

scale = 2
image = Image.new("RGB", (1200 * scale, 630 * scale), "#f5f5f7")
draw = ImageDraw.Draw(image)
project_root = Path(__file__).resolve().parent.parent
source_font = TTFont(project_root / "assets/fonts/PretendardVariable-1.3.9.woff2")
source_font.flavor = None
font_buffer = BytesIO()
source_font.save(font_buffer)
font_bytes = font_buffer.getvalue()


def text(position, value, size, weight, color):
    font = ImageFont.truetype(BytesIO(font_bytes), size * scale)
    font.set_variation_by_axes([weight])
    draw.text(tuple(point * scale for point in position), value, font=font,
              fill=color, anchor="lt")


text((80, 65), "Apple 환율 계산기", 30, 600, "#1d1d1f")
text((76, 185), "Apple 가격에", 104, 700, "#1d1d1f")
text((76, 308), "담긴 환율.", 104, 700, "#1d1d1f")
text((80, 521), "한국·미국 공식 가격으로 보는 Apple 추정 환율", 31, 400, "#6e6e73")

for filename in ["social-card-v1.png", "social-card-v2.png"]:
    destination = project_root / "public" / filename
    image.resize((1200, 630), Image.Resampling.LANCZOS).save(destination, optimize=True)
    print(destination.name)
