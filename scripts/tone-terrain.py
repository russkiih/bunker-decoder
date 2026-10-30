#!/usr/bin/env python3
# Turn a full-map Nasdara terrain image into public/nasdara-terrain.webp in the app palette.
# Usage: python3 scripts/tone-terrain.py SOURCE_IMAGE public/index.html public/nasdara-terrain.webp preview.png
# The source must cover the whole map edge to edge (it is stretched to a square). Baked-in names of the
# capital, districts and cities from the PLACES list are filled in from the surrounding terrain.
import sys, re
from PIL import Image, ImageFilter
import numpy as np
src, html, out, prev = sys.argv[1:5]
im = Image.open(src).convert('RGB'); W, H = im.size          # 975 x 1024 covering the full 16384 m map
a = np.asarray(im).astype(np.float32) / 255
L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]

# 1) the source prints names for capital, districts and cities only: whiten their black letters near those spots
places = re.findall(r"\['(capital|district|city)', '([^']+)', (\d+), (\d+)\]", open(html, encoding='utf-8').read())
ink = Image.fromarray(((L < 0.33) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
ink = np.asarray(ink) > 0
win = np.zeros_like(ink)
for kind, name, gx, gy in places:
    px, py = (int(gx) * 100 + 50) / 16384 * W, (int(gy) * 100 + 50) / 16384 * H
    x0, x1, y0, y1 = int(px - 70), int(px + 150), int(py - 14), int(py + 14)
    win[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] = True
def blur(x, r):
    k = np.exp(-0.5 * (np.arange(-3 * r, 3 * r + 1) / r) ** 2); k /= k.sum(); pad = len(k) // 2
    y = np.pad(x, ((0, 0), (pad, pad)), mode='edge'); y = sum(k[i] * y[:, i:i + x.shape[1]] for i in range(len(k)))
    y = np.pad(y, ((pad, pad), (0, 0)), mode='edge'); return sum(k[i] * y[i:i + x.shape[0], :] for i in range(len(k)))
# letters plus their white outline, only inside the label windows
hole = np.asarray(Image.fromarray(((ink & win) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
hole &= win
keep = (~hole).astype(np.float32)
for radius in (4, 8):   # fill from surrounding terrain; second pass closes anything the first could not reach
    wsum = blur(keep, radius)
    for c in range(3):
        fill = blur(a[..., c] * keep, radius) / np.maximum(wsum, 1e-6)
        a[..., c] = np.where(hole & (wsum > 0.05), fill, a[..., c])
    keep = np.maximum(keep, (wsum > 0.05).astype(np.float32))
print('places used:', len(places), '| pixels filled:', int(hole.sum()))

im = Image.fromarray((a * 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)   # square, 16 m per pixel
a = np.asarray(im).astype(np.float32) / 255
r, g, b = a[..., 0], a[..., 1], a[..., 2]
L = 0.299 * r + 0.587 * g + 0.114 * b
# 2) relief to the app's olive palette
t = np.clip((L - 0.50) / 0.50, 0, 1) ** 1.35
lo, hi = np.array([0x0f, 0x11, 0x0b]) / 255, np.array([0x3d, 0x45, 0x31]) / 255
rgb = lo + (hi - lo) * t[..., None]
# 3) roads, tracks and towns (warm pixels) -> sand
warm = np.clip(((r - b) - 0.05) / 0.16, 0, 1) * np.clip((L - 0.45) / 0.3, 0, 1)
rgb = rgb * (1 - 0.8 * warm[..., None]) + (np.array([0x9a, 0x88, 0x5c]) / 255) * (0.8 * warm[..., None])
res = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
res.save(out, 'WEBP', quality=84, method=6)
res.crop((480, 640, 800, 860)).resize((960, 660), Image.LANCZOS).save(prev)
print(out, res.size)
