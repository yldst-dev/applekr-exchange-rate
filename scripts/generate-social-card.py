from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

scale = 2
image = Image.new("RGB", (1200 * scale, 630 * scale), "#f5f5f7")
draw = ImageDraw.Draw(image)
font_path = "/System/Library/Fonts/AppleSDGothicNeo.ttc"


def text(position, value, size, weight, color):
    font = ImageFont.truetype(font_path, size * scale, index=weight)
    draw.text(tuple(point * scale for point in position), value, font=font,
              fill=color, anchor="lt")


text((80, 65), "Apple 환율 계산기", 30, 4, "#1d1d1f")
text((76, 185), "Apple 가격에", 104, 6, "#1d1d1f")
text((76, 308), "담긴 환율.", 104, 6, "#1d1d1f")
text((80, 521), "한국·미국 공식 가격으로 보는 Apple 추정 환율", 31, 0, "#6e6e73")

destination = Path(__file__).resolve().parent.parent / "public/social-card-v1.png"
image.resize((1200, 630), Image.Resampling.LANCZOS).save(destination, optimize=True)
print(destination.name)
