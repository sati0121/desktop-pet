#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prep_sprites.py — 把多张 Q 版图处理成多个宠物形象（透明 PNG）

每个形象：rembg 抠图 → 裁到内容 → 缩放 → 存到 assets/sprites/
支持对四宫格图先裁剪出某一格（--crop 参数）。

用法：
  python tools/prep_sprites.py [目标高度px]
"""
import os
import sys
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # pet/
SRC_DIR = os.path.dirname(BASE)                                       # 桌面宝宝一宁/
OUT_DIR = os.path.join(BASE, 'src', 'renderer', 'assets', 'sprites')

# 形象定义: id -> (源图, 可选的预裁剪区域[left,top,right,bottom]或None)
SPRITES = {
    # Q版蹲姿（主形象）
    'qban':      ('Q版.png', None),
    # 从四宫格裁出左下角站立全身
    'zhanli':    ('不同姿态Q照片.png', [8, 1158, 856, 2296]),
    # 站立插口袋半身
    'banli':     ('生成人物不同照片 (1).png', None),
}


def try_rembg(image: Image.Image, session=None) -> Image.Image:
    try:
        from rembg import remove
        return remove(image, session=session).convert('RGBA')
    except Exception as e:
        print(f'  [warn] rembg 失败: {e}')
        return image.convert('RGBA')


def crop_to_content(image: Image.Image, pad: int = 6) -> Image.Image:
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
    target_h = int(sys.argv[1]) if len(sys.argv) > 1 else 512

    from rembg import new_session
    session = new_session('silueta')

    os.makedirs(OUT_DIR, exist_ok=True)
    for sid, (src_name, crop_box) in SPRITES.items():
        src = os.path.join(SRC_DIR, src_name)
        if not os.path.exists(src):
            print(f'[skip] 找不到 {src_name}')
            continue
        im = Image.open(src).convert('RGB')
        if crop_box:
            im = im.crop(crop_box)
        print(f'处理 {src_name} 源尺寸={im.size}')
        out = try_rembg(im, session)
        out = crop_to_content(out)
        ratio = out.height / target_h
        if ratio > 1:
            out = out.resize((max(1, round(out.width / ratio)), target_h), Image.LANCZOS)
        out_path = os.path.join(OUT_DIR, f'{sid}.png')
        out.save(out_path, 'PNG')
        print(f'  完成 -> {out_path}  {out.size}')

    print('全部处理完成')


if __name__ == '__main__':
    main()
