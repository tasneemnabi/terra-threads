"""
Woven Taxonomy — Canvas Expression (Refined)
Systematic naturalism: organic fiber structure meets analytical precision.
"""

from PIL import Image, ImageDraw, ImageFont
import math
import random

random.seed(42)

W, H = 2100, 2800

# Palette
CREAM = (250, 247, 242)
LINEN = (234, 227, 216)
SAND = (214, 203, 189)
DUSTY_ROSE = (163, 83, 90)
ROSE_MID = (183, 113, 118)
SLATE = (71, 86, 88)
UMBER = (44, 36, 32)
WARM_GRAY = (184, 170, 156)

FONTS_DIR = "/Users/zain/.claude/plugins/marketplaces/anthropic-agent-skills/skills/canvas-design/canvas-fonts"


def load_font(name, size):
    try:
        return ImageFont.truetype(f"{FONTS_DIR}/{name}", size)
    except:
        return ImageFont.load_default()


img = Image.new("RGB", (W, H), CREAM)
draw = ImageDraw.Draw(img, "RGBA")

# Fonts
f_title = load_font("InstrumentSerif-Regular.ttf", 80)
f_subtitle = load_font("InstrumentSans-Regular.ttf", 20)
f_label = load_font("IBMPlexMono-Regular.ttf", 16)
f_label_bold = load_font("IBMPlexMono-Bold.ttf", 16)
f_tiny = load_font("IBMPlexMono-Regular.ttf", 12)
f_micro = load_font("IBMPlexMono-Regular.ttf", 10)
f_section = load_font("InstrumentSans-Bold.ttf", 14)
f_large_num = load_font("InstrumentSerif-Regular.ttf", 120)

MARGIN = 140
CONTENT_W = W - 2 * MARGIN

# ═══════════════════════════════════════════════
# BACKGROUND: Ultra-subtle woven texture
# ═══════════════════════════════════════════════

for x in range(MARGIN, W - MARGIN, 12):
    opacity = random.randint(6, 14)
    draw.line([(x, MARGIN), (x, H - MARGIN)], fill=(44, 36, 32, opacity), width=1)

for y in range(MARGIN, H - MARGIN, 16):
    opacity = random.randint(4, 10)
    draw.line([(MARGIN, y), (W - MARGIN, y)], fill=(44, 36, 32, opacity), width=1)

# ═══════════════════════════════════════════════
# HEADER
# ═══════════════════════════════════════════════

draw.text((MARGIN, 130), "Woven Taxonomy", fill=UMBER, font=f_title)

# Rose accent line under title
draw.rectangle([MARGIN, 228, MARGIN + 260, 231], fill=DUSTY_ROSE)

draw.text(
    (MARGIN, 250),
    "a systematic study of natural fiber composition",
    fill=SLATE,
    font=f_subtitle,
)

# Plate reference, top right
bbox = draw.textbbox((0, 0), "plate 001", font=f_tiny)
draw.text((W - MARGIN - (bbox[2] - bbox[0]), 145), "plate 001", fill=WARM_GRAY, font=f_tiny)
draw.text((W - MARGIN - (bbox[2] - bbox[0]), 162), "2026.03.30", fill=WARM_GRAY, font=f_micro)

# ═══════════════════════════════════════════════
# SECTION 1: Fiber cross-section specimen grid
# ═══════════════════════════════════════════════

grid_top = 340
draw.text((MARGIN, grid_top - 28), "fig. 01 — fiber cross-section array", fill=WARM_GRAY, font=f_micro)

grid_x = MARGIN + 120  # room for row labels
cell = 48
cols = 14
rows = 7

fibers = ["merino", "cotton", "silk", "linen", "hemp", "alpaca", "modal"]

# Row labels
for i, fiber in enumerate(fibers):
    y = grid_top + i * cell + cell // 2 - 5
    draw.text((MARGIN, y), fiber, fill=SLATE, font=f_tiny)

# Column header percentages
for col in range(cols):
    x = grid_x + col * cell + cell // 2
    pct = f"{(col + 1) * 7}"
    bbox = draw.textbbox((0, 0), pct, font=f_micro)
    tw = bbox[2] - bbox[0]
    draw.text((x - tw // 2, grid_top - 16), pct, fill=WARM_GRAY, font=f_micro)

# Specimen dots
for row in range(rows):
    for col in range(cols):
        cx = grid_x + col * cell + cell // 2
        cy = grid_top + row * cell + cell // 2
        r = 13 + random.uniform(-1.5, 1.5)

        # Determine fill based on position — create a visual pattern
        # Higher percentages (right cols) for natural fibers get rose
        pct_val = (col + 1) * 7
        is_highlight = (
            (row < 4 and pct_val > 60)  # natural fibers at high pct
            or (row == 0 and col > 8)    # merino dominance
            or (row == 2 and col in [5, 6])  # silk sweet spot
        )

        if is_highlight:
            fill = (*DUSTY_ROSE, 80)
            outline = DUSTY_ROSE
        elif pct_val < 20:
            fill = (*SAND, 30)
            outline = (*SAND, 80)
        else:
            fill = (*SAND, 50)
            outline = SAND

        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=outline, width=1)

        # Inner ring for highlighted specimens
        if is_highlight and random.random() > 0.3:
            ir = r * 0.5
            draw.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], outline=(*DUSTY_ROSE, 120), width=1)

# Light grid lines
for col in range(cols + 1):
    x = grid_x + col * cell
    draw.line([(x, grid_top), (x, grid_top + rows * cell)], fill=(44, 36, 32, 12), width=1)
for row in range(rows + 1):
    y = grid_top + row * cell
    draw.line([(grid_x, y), (grid_x + cols * cell, y)], fill=(44, 36, 32, 12), width=1)

# ═══════════════════════════════════════════════
# SECTION 2: Composition analysis bars
# ═══════════════════════════════════════════════

bar_top = 740
draw.line([(MARGIN, bar_top), (W - MARGIN, bar_top)], fill=(*UMBER, 40), width=1)
draw.text((MARGIN, bar_top + 12), "fig. 02 — material composition analysis", fill=WARM_GRAY, font=f_micro)

bar_y = bar_top + 42
bar_h = 32
bar_gap = 12

compositions = [
    ("merino wool", 92, DUSTY_ROSE),
    ("organic cotton", 78, SLATE),
    ("silk", 45, ROSE_MID),
    ("linen", 67, WARM_GRAY),
    ("elastane", 8, SAND),
]

for i, (name, pct, color) in enumerate(compositions):
    y = bar_y + i * (bar_h + bar_gap)

    # Track background
    draw.rectangle([MARGIN, y, MARGIN + CONTENT_W, y + bar_h], fill=LINEN)

    # Filled bar
    filled_w = int(CONTENT_W * pct / 100)
    draw.rectangle([MARGIN, y, MARGIN + filled_w, y + bar_h], fill=color)

    # Name label (white on dark bars, dark on light)
    text_color = CREAM if pct > 30 else UMBER
    draw.text((MARGIN + 14, y + 7), name, fill=text_color, font=f_label)

    # Percentage right-aligned inside bar
    pct_text = f"{pct}%"
    bbox = draw.textbbox((0, 0), pct_text, font=f_label_bold)
    tw = bbox[2] - bbox[0]
    if pct > 15:
        draw.text((MARGIN + filled_w - tw - 14, y + 7), pct_text, fill=(*CREAM, 200), font=f_label_bold)
    else:
        draw.text((MARGIN + filled_w + 10, y + 7), pct_text, fill=UMBER, font=f_label_bold)

# ═══════════════════════════════════════════════
# SECTION 3: Thread density map
# Dense visual texture — the centerpiece
# ═══════════════════════════════════════════════

weave_top = 1060
weave_h = 800
draw.line([(MARGIN, weave_top), (W - MARGIN, weave_top)], fill=(*UMBER, 40), width=1)
draw.text((MARGIN, weave_top + 12), "fig. 03 — thread density map", fill=WARM_GRAY, font=f_micro)

weave_y = weave_top + 36

thread_palette = [
    DUSTY_ROSE,
    SLATE,
    UMBER,
    WARM_GRAY,
    SAND,
    ROSE_MID,
    (120, 100, 88),
]

# Vertical threads — dense, with more contrast
for i in range(220):
    x = MARGIN + (i * CONTENT_W // 220)
    color = thread_palette[i % len(thread_palette)]

    # Vary opacity by position — denser in center
    dist_from_center = abs(x - W // 2) / (CONTENT_W // 2)
    base_opacity = int(60 + 50 * (1 - dist_from_center))

    points = []
    for y_step in range(0, weave_h - 36, 2):
        y = weave_y + y_step
        wave = math.sin(y_step * 0.018 + i * 0.25) * (1.5 + random.uniform(0, 1))
        points.append((x + wave, y))

    opacity = min(base_opacity + random.randint(-15, 15), 120)

    for j in range(len(points) - 1):
        draw.line([points[j], points[j + 1]], fill=(*color, opacity), width=1)

# Horizontal threads — fewer, creating weave intersections
for j in range(80):
    y = weave_y + (j * (weave_h - 36) // 80)
    color = thread_palette[(j + 3) % len(thread_palette)]

    dist_from_center = abs(y - (weave_y + weave_h // 2)) / (weave_h // 2)
    base_opacity = int(30 + 35 * (1 - dist_from_center))

    points = []
    for x_step in range(0, CONTENT_W, 3):
        x = MARGIN + x_step
        wave = math.sin(x_step * 0.012 + j * 0.4) * 1.2
        points.append((x, y + wave))

    opacity = min(base_opacity + random.randint(-10, 10), 70)

    for k in range(len(points) - 1):
        draw.line([points[k], points[k + 1]], fill=(*color, opacity), width=1)

# ═══════════════════════════════════════════════
# SECTION 4: Large accent number
# A single oversized percentage — visual punctuation
# ═══════════════════════════════════════════════

num_y = 1940
draw.line([(MARGIN, num_y), (W - MARGIN, num_y)], fill=(*UMBER, 40), width=1)

# Large "100%" in dusty rose — the aspirational number
draw.text((MARGIN, num_y + 10), "100", fill=(*DUSTY_ROSE, 50), font=f_large_num)

# Annotation beside it
draw.text((MARGIN + 340, num_y + 50), "% natural fiber", fill=SLATE, font=f_subtitle)
draw.text(
    (MARGIN + 340, num_y + 80),
    "the standard we hold every product to.",
    fill=WARM_GRAY,
    font=f_tiny,
)

# ═══════════════════════════════════════════════
# SECTION 5: Classification index
# ═══════════════════════════════════════════════

index_y = 2140
draw.text((MARGIN, index_y - 20), "fig. 04 — material classification index", fill=WARM_GRAY, font=f_micro)
draw.line([(MARGIN, index_y), (W - MARGIN, index_y)], fill=UMBER, width=2)

categories = [
    ("NATURAL", ["wool", "cotton", "silk", "linen", "hemp", "alpaca", "cashmere"], DUSTY_ROSE),
    ("PLANT-DERIVED", ["lyocell", "modal", "viscose", "tencel", "cupro", "bamboo"], SLATE),
    ("RESTRICTED", ["elastane ≤10%"], WARM_GRAY),
    ("PROHIBITED", ["polyester", "nylon", "acrylic"], SAND),
]

col_w = CONTENT_W // 4
for i, (cat_name, items, dot_color) in enumerate(categories):
    x = MARGIN + i * col_w
    draw.text((x, index_y + 18), cat_name, fill=UMBER, font=f_section)

    for j, item in enumerate(items):
        iy = index_y + 48 + j * 24
        draw.ellipse([x, iy + 2, x + 7, iy + 9], fill=dot_color)
        draw.text((x + 14, iy), item, fill=SLATE, font=f_tiny)

# ═══════════════════════════════════════════════
# FOOTER
# ═══════════════════════════════════════════════

foot_y = H - 160
draw.line([(MARGIN, foot_y), (W - MARGIN, foot_y)], fill=(*UMBER, 30), width=1)

draw.text((MARGIN, foot_y + 16), "FIBER", fill=UMBER, font=f_section)
draw.text(
    (MARGIN, foot_y + 38),
    "every fiber, listed. no polyester. no nylon. no compromise.",
    fill=WARM_GRAY,
    font=f_tiny,
)

# Right-aligned
for text, offset in [("woven-taxonomy.001", 16), ("natural fiber clothing aggregator", 34)]:
    bbox = draw.textbbox((0, 0), text, font=f_tiny)
    tw = bbox[2] - bbox[0]
    draw.text((W - MARGIN - tw, foot_y + offset), text, fill=WARM_GRAY, font=f_tiny)

# ═══════════════════════════════════════════════
# ACCENT: Small rose squares at section breaks
# ═══════════════════════════════════════════════

for y in [grid_top, bar_top, weave_top, num_y, index_y]:
    draw.rectangle([MARGIN - 8, y - 4, MARGIN - 2, y + 4], fill=DUSTY_ROSE)

# Outer frame — hairline
draw.rectangle(
    [MARGIN - 30, 100, W - MARGIN + 30, H - 100],
    outline=(*UMBER, 18),
    width=1,
)

# Save
output = "/Users/zain/Coding/shopping/canvas/woven-taxonomy.png"
img.save(output, "PNG", quality=95)
print(f"Saved: {output} ({W}x{H})")
