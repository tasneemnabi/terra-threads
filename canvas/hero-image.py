"""
FIBER Hero Image — Abstract textile composition
Warm, organic, editorial. Woven texture meets bold form.
"""

from PIL import Image, ImageDraw, ImageFont
import math
import random

random.seed(17)

W, H = 1200, 1400

# Palette
CREAM = (250, 247, 242)
LINEN = (234, 227, 216)
SAND = (214, 203, 189)
DUSTY_ROSE = (163, 83, 90)
ROSE_LIGHT = (195, 140, 145)
ROSE_PALE = (220, 180, 182)
SLATE = (71, 86, 88)
UMBER = (44, 36, 32)
WARM_GRAY = (184, 170, 156)

img = Image.new("RGBA", (W, H), CREAM)
draw = ImageDraw.Draw(img, "RGBA")


def draw_thread(draw, x1, y1, x2, y2, color, opacity=80, width=1, wave_amp=2, wave_freq=0.02):
    """Draw a wavy thread between two points."""
    dx = x2 - x1
    dy = y2 - y1
    length = math.sqrt(dx * dx + dy * dy)
    steps = max(int(length / 2), 10)

    points = []
    for s in range(steps + 1):
        t = s / steps
        x = x1 + dx * t
        y = y1 + dy * t
        # Perpendicular wave
        perp_x = -dy / length if length > 0 else 0
        perp_y = dx / length if length > 0 else 0
        wave = math.sin(s * wave_freq * 10 + random.uniform(0, 1)) * wave_amp
        x += perp_x * wave
        y += perp_y * wave
        points.append((x, y))

    col = (*color[:3], opacity)
    for i in range(len(points) - 1):
        draw.line([points[i], points[i + 1]], fill=col, width=width)


# ═══════════════════════════════════════════════
# LAYER 1: Soft background texture — linen grain
# ═══════════════════════════════════════════════

for _ in range(40000):
    x = random.randint(0, W)
    y = random.randint(0, H)
    opacity = random.randint(3, 12)
    draw.point((x, y), fill=(*SAND, opacity))

# ═══════════════════════════════════════════════
# LAYER 2: Large circle — primary form
# Center-right, filled with dense woven texture
# ═══════════════════════════════════════════════

# Main circle
cx, cy = 620, 640
radius = 420

# Create a mask for the circle
circle_mask = Image.new("L", (W, H), 0)
mask_draw = ImageDraw.Draw(circle_mask)
mask_draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=255)

# Woven texture layer (drawn on separate image, then masked)
weave_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
weave_draw = ImageDraw.Draw(weave_layer, "RGBA")

# Fill circle area with base color
weave_draw.ellipse(
    [cx - radius, cy - radius, cx + radius, cy + radius],
    fill=(*ROSE_PALE, 60),
)

# Dense vertical threads inside circle
thread_colors_v = [DUSTY_ROSE, ROSE_LIGHT, ROSE_PALE, SAND, LINEN, DUSTY_ROSE, WARM_GRAY]
for i in range(300):
    x = cx - radius + (i * radius * 2 // 300)
    # Check if this x intersects the circle
    dx = x - cx
    if abs(dx) >= radius:
        continue
    half_chord = math.sqrt(radius * radius - dx * dx)
    y_start = cy - half_chord
    y_end = cy + half_chord

    color = thread_colors_v[i % len(thread_colors_v)]
    # Opacity gradient — denser toward center
    dist = abs(dx) / radius
    opacity = int(40 + 80 * (1 - dist * dist))

    draw_thread(
        weave_draw, x, y_start, x, y_end,
        color, opacity=opacity, width=1,
        wave_amp=1.5 + random.uniform(0, 1),
        wave_freq=0.015,
    )

# Horizontal threads — fewer, creating crosshatch
for j in range(120):
    y = cy - radius + (j * radius * 2 // 120)
    dy = y - cy
    if abs(dy) >= radius:
        continue
    half_chord = math.sqrt(radius * radius - dy * dy)
    x_start = cx - half_chord
    x_end = cx + half_chord

    color = thread_colors_v[(j + 2) % len(thread_colors_v)]
    dist = abs(dy) / radius
    opacity = int(20 + 50 * (1 - dist * dist))

    draw_thread(
        weave_draw, x_start, y, x_end, y,
        color, opacity=opacity, width=1,
        wave_amp=1, wave_freq=0.012,
    )

# Apply circle mask
weave_layer.putalpha(circle_mask)
img = Image.alpha_composite(img, weave_layer)
draw = ImageDraw.Draw(img, "RGBA")

# Circle outline — thin, precise
for angle in range(0, 3600):
    a = math.radians(angle / 10)
    x = cx + radius * math.cos(a)
    y = cy + radius * math.sin(a)
    draw.point((x, y), fill=(*DUSTY_ROSE, 90))

# ═══════════════════════════════════════════════
# LAYER 3: Secondary circle — overlapping, slate
# ═══════════════════════════════════════════════

cx2, cy2 = 340, 920
r2 = 240

circle_mask2 = Image.new("L", (W, H), 0)
mask_draw2 = ImageDraw.Draw(circle_mask2)
mask_draw2.ellipse([cx2 - r2, cy2 - r2, cx2 + r2, cy2 + r2], fill=255)

weave2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
weave2_draw = ImageDraw.Draw(weave2, "RGBA")

weave2_draw.ellipse([cx2 - r2, cy2 - r2, cx2 + r2, cy2 + r2], fill=(*LINEN, 70))

# Slate-toned threads
thread_colors_2 = [SLATE, WARM_GRAY, SAND, SLATE, LINEN]
for i in range(180):
    x = cx2 - r2 + (i * r2 * 2 // 180)
    dx = x - cx2
    if abs(dx) >= r2:
        continue
    half_chord = math.sqrt(r2 * r2 - dx * dx)

    color = thread_colors_2[i % len(thread_colors_2)]
    dist = abs(dx) / r2
    opacity = int(30 + 60 * (1 - dist * dist))

    draw_thread(
        weave2_draw, x, cy2 - half_chord, x, cy2 + half_chord,
        color, opacity=opacity, width=1,
        wave_amp=1.2, wave_freq=0.018,
    )

for j in range(70):
    y = cy2 - r2 + (j * r2 * 2 // 70)
    dy = y - cy2
    if abs(dy) >= r2:
        continue
    half_chord = math.sqrt(r2 * r2 - dy * dy)

    color = thread_colors_2[(j + 1) % len(thread_colors_2)]
    dist = abs(dy) / r2
    opacity = int(15 + 40 * (1 - dist * dist))

    draw_thread(
        weave2_draw, cx2 - half_chord, y, cx2 + half_chord, y,
        color, opacity=opacity, width=1,
        wave_amp=0.8, wave_freq=0.015,
    )

weave2.putalpha(circle_mask2)
img = Image.alpha_composite(img, weave2)
draw = ImageDraw.Draw(img, "RGBA")

# Outline
for angle in range(0, 3600):
    a = math.radians(angle / 10)
    x = cx2 + r2 * math.cos(a)
    y = cy2 + r2 * math.sin(a)
    draw.point((x, y), fill=(*SLATE, 70))

# ═══════════════════════════════════════════════
# LAYER 4: Small accent circle — top left
# ═══════════════════════════════════════════════

cx3, cy3 = 200, 280
r3 = 100

draw.ellipse(
    [cx3 - r3, cy3 - r3, cx3 + r3, cy3 + r3],
    fill=(*DUSTY_ROSE, 30),
    outline=(*DUSTY_ROSE, 60),
    width=1,
)

# Fill with subtle radial lines
for angle in range(0, 360, 4):
    a = math.radians(angle)
    x_end = cx3 + r3 * 0.85 * math.cos(a)
    y_end = cy3 + r3 * 0.85 * math.sin(a)
    opacity = random.randint(20, 50)
    draw.line(
        [(cx3, cy3), (x_end, y_end)],
        fill=(*DUSTY_ROSE, opacity),
        width=1,
    )

# ═══════════════════════════════════════════════
# LAYER 5: Floating thread lines
# Loose threads escaping the forms — organic movement
# ═══════════════════════════════════════════════

# Threads radiating from the main circle
for i in range(25):
    angle = random.uniform(0, math.pi * 2)
    start_x = cx + radius * math.cos(angle)
    start_y = cy + radius * math.sin(angle)

    length = random.uniform(60, 200)
    end_x = start_x + length * math.cos(angle + random.uniform(-0.3, 0.3))
    end_y = start_y + length * math.sin(angle + random.uniform(-0.3, 0.3))

    # Keep within bounds
    end_x = max(20, min(W - 20, end_x))
    end_y = max(20, min(H - 20, end_y))

    color = random.choice([DUSTY_ROSE, ROSE_LIGHT, WARM_GRAY])
    draw_thread(
        draw, start_x, start_y, end_x, end_y,
        color, opacity=random.randint(25, 60), width=1,
        wave_amp=3, wave_freq=0.025,
    )

# ═══════════════════════════════════════════════
# LAYER 6: Small specimen dots scattered
# Cross-section specimens floating in space
# ═══════════════════════════════════════════════

specimen_positions = [
    (920, 200, 12), (980, 260, 8), (1050, 180, 10),
    (100, 600, 7), (60, 680, 9),
    (900, 1100, 11), (1000, 1050, 8), (1080, 1150, 6),
    (150, 1250, 10), (250, 1300, 7),
    (800, 1300, 9), (700, 1350, 6),
]

for sx, sy, sr in specimen_positions:
    color = random.choice([DUSTY_ROSE, SLATE, WARM_GRAY])
    draw.ellipse(
        [sx - sr, sy - sr, sx + sr, sy + sr],
        fill=(*color, 40),
        outline=(*color, 80),
        width=1,
    )
    if random.random() > 0.4:
        ir = sr * 0.5
        draw.ellipse(
            [sx - ir, sy - ir, sx + ir, sy + ir],
            outline=(*color, 60),
            width=1,
        )

# ═══════════════════════════════════════════════
# FINAL: Convert to RGB and save
# ═══════════════════════════════════════════════

final = Image.new("RGB", (W, H), CREAM)
final.paste(img, mask=img.split()[3])

output = "/Users/zain/Coding/shopping/public/hero-texture.png"
final.save(output, "PNG", quality=95)
print(f"Saved: {output} ({W}x{H})")
