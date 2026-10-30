#!/usr/bin/env python3
"""Prepare a full-map Nasdara image as public/nasdara-terrain.webp.

Usage: python3 scripts/prepare-terrain.py SOURCE_IMAGE public/nasdara-terrain.webp

The source must cover the whole 16.4 km map edge to edge with no printed names.
Near-black screenshot rows/columns at the edges are trimmed, the image is squared
to 1024 px (16 m per pixel) and darkened slightly so the map's labels and pin read
clearly on top. Needs Pillow and NumPy.
"""
import sys
from PIL import Image, ImageEnhance
import numpy as np

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im.convert('L')).astype(float)
top, bottom, left, right = 0, a.shape[0], 0, a.shape[1]
while bottom > 1 and a[bottom - 1].mean() < 40: bottom -= 1
while top < bottom - 1 and a[top].mean() < 40: top += 1
while right > 1 and a[:, right - 1].mean() < 40: right -= 1
while left < right - 1 and a[:, left].mean() < 40: left += 1
im = im.crop((left, top, right, bottom)).resize((1024, 1024), Image.LANCZOS)
im = ImageEnhance.Brightness(im).enhance(0.78)
im = ImageEnhance.Color(im).enhance(0.9)
im.save(out, 'WEBP', quality=85, method=6)
print(f'trimmed to {right - left}x{bottom - top}, saved {out} 1024x1024')
