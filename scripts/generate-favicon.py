from pathlib import Path
from PIL import Image, ImageDraw

scale = 8
image = Image.new("RGBA", (64 * scale, 64 * scale))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((0, 0, 64 * scale - 1, 64 * scale - 1),
                       radius=14 * scale, fill="#1d1d1f")
paths = [[(12, 18), (20, 46), (32, 24), (44, 46), (52, 18)],
         [(12, 28), (52, 28)], [(14, 36), (50, 36)]]
for path in paths:
    points = [(x * scale, y * scale) for x, y in path]
    draw.line(points, fill="white", width=4 * scale, joint="curve")
    for x, y in points:
        radius = 2 * scale
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill="white")

destination = Path(__file__).resolve().parent.parent / "public"
image.save(destination / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
image.resize((180, 180), Image.Resampling.LANCZOS).save(destination / "apple-touch-icon.png", optimize=True)
print("favicon.ico, apple-touch-icon.png")
