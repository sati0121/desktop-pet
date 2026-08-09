#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prep_sprite.py — 把 片.png 预处理成透明背景的宠物精灵图

流程：
1. 优先用 rembg（AI 抠图，质量最好）；未安装则回退 Pillow 边缘 flood-fill 色键
2. 裁剪到内容包围盒 + 少量内边距
3. 缩放到指定高度
4. 输出到 pet/src/renderer/assets/sprite.png

用法：python tools/prep_sprite.py [源图] [输出高度px]
"""
import os
import sys
from PIL import Image, ImageFilter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # pet/
SRC_DEFAULT = os.path.join(os.path.dirname(BASE), '片.png')           # 桌面宝宝一宁/片.png
OUT = os.path.join(BASE, 'src', 'renderer', 'assets', 'sprite.png')


def try_rembg(image: Image.Image, model: str = 'silueta') -> Image.Image:
    """用 rembg 抠图，返回带 alpha 的 RGBA 图；失败返回 None
    model: u2net(精确但~170MB) / silueta(轻量~43MB，人物够用) / u2net_human_seg(人物专用)"""
    try:
        from rembg import remove, new_session
        session = new_session(model)
        return remove(image, session=session).convert('RGBA')
    except Exception as e:
        print(f'[warn] rembg 不可用({e})，回退 flood-fill')
        return None


def flood_fill_remove(image: Image.Image, tol: int = 40) -> Image.Image:
    """从四边种子点 flood-fill 抠背景（适合背景相对干净的图）

    用四角颜色作为背景参考色集合，像素与任一参考色相近即为背景。
    """
    rgba = image.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    # 四角参考色（背景可能不止一种颜色，如木门+浅墙）
    refs = {px[0, 0][:3], px[w - 1, 0][:3], px[0, h - 1][:3], px[w - 1, h - 1][:3]}
    seen = [[False] * w for _ in range(h)]
    stack = []
    for x in range(0, w, 2):
        stack.append((x, 0)); stack.append((x, h - 1))
    for y in range(0, h, 2):
        stack.append((0, y)); stack.append((w - 1, y))

    def similar(c):
        return any(all(abs(c[i] - r[i]) <= tol for i in range(3)) for r in refs)

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        c = px[x, y]
        if c[3] == 0:
            continue
        if similar(c):
            px[x, y] = (c[0], c[1], c[2], 0)
            stack.append((x + 1, y)); stack.append((x - 1, y))
            stack.append((x, y + 1)); stack.append((x, y - 1))
    return rgba


def crop_to_content(image: Image.Image, pad: int = 8) -> Image.Image:
    """裁剪到非透明内容包围盒 + 内边距"""
    bbox = image.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(image.width, right + pad)
    bottom = min(image.height, bottom + pad)
    return image.crop((left, top, right, bottom))


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    target_h = int(sys.argv[2]) if len(sys.argv) > 2 else 512

    if not os.path.exists(src):
        print(f'[error] 找不到源图: {src}')
        sys.exit(1)

    im = Image.open(src).convert('RGB')
    print(f'源图: {src}  {im.size}')

    # 1. 抠图
    out = try_rembg(im)
    if out is None:
        out = flood_fill_remove(im, tol=40)

    # 2. 裁剪
    out = crop_to_content(out)

    # 3. 缩放（保持宽高比）
    ratio = out.height / target_h
    if ratio > 1:
        out = out.resize((max(1, round(out.width / ratio)), target_h), Image.LANCZOS)
    else:
        out = out.resize((out.width, out.height), Image.LANCZOS)

    # 4. 保存
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.save(OUT, 'PNG')
    print(f'完成: {OUT}  {out.size}  mode={out.mode}')


if __name__ == '__main__':
    main()
