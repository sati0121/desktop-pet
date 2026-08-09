// test/geometry.test.js — node --test test
const test = require('node:test');
const assert = require('node:assert');
const { defaultArea, clampArea, clampPetToArea, resizeArea, MIN_SIZE } = require('../src/geometry');

test('默认区域：右上角，约 1/6 屏幕面积', () => {
  const work = { x: 0, y: 0, width: 1920, height: 1080 };
  const a = defaultArea(work);
  assert.strictEqual(a.x, 1920 - 640);   // 右上角
  assert.strictEqual(a.y, 0);
  assert.strictEqual(a.w, 640);          // 宽 = 1/3
  assert.strictEqual(a.h, 540);          // 高 = 1/2
  assert.strictEqual(a.w * a.h, Math.round(1920 * 1080 / 6)); // 面积 = 1/6
});

test('默认区域：支持负坐标显示器（多屏左侧）', () => {
  const work = { x: -1280, y: -100, width: 1280, height: 720 };
  const a = defaultArea(work);
  assert.strictEqual(a.x, work.x + work.width - a.w);
  assert.strictEqual(a.y, work.y);
});

test('clampArea：保持最小尺寸', () => {
  const work = { x: 0, y: 0, width: 1920, height: 1080 };
  const a = clampArea({ x: 10, y: 10, w: 5, h: 5 }, work);
  assert.ok(a.w >= MIN_SIZE && a.h >= MIN_SIZE);
});

test('clampArea：不越出工作区', () => {
  const work = { x: 0, y: 0, width: 1000, height: 800 };
  const a = clampArea({ x: 900, y: 700, w: 500, h: 400 }, work);
  assert.ok(a.x + a.w <= work.x + work.width);
  assert.ok(a.y + a.h <= work.y + work.height);
});

test('clampArea：右上角缩放时右下角保持不动（nw 手柄）', () => {
  const work = { x: 0, y: 0, width: 1000, height: 800 };
  const nb = resizeArea({ x: 300, y: 200, w: 400, h: 300 }, 'nw', -50, 40, work);
  // 右下角应保持 (700, 500)
  assert.strictEqual(nb.x + nb.w, 700);
  assert.strictEqual(nb.y + nb.h, 500);
});

test('clampPetToArea：宠物不越出区域', () => {
  const area = { x: 0, y: 0, w: 500, h: 400 };
  const p = clampPetToArea({ x: -10, y: 390, w: 100, h: 100 }, area);
  assert.strictEqual(p.x, 0);
  assert.strictEqual(p.y, 300); // 400-100
  assert.strictEqual(p.w, 100);
});

test('resizeArea：se 手柄放大', () => {
  const work = { x: 0, y: 0, width: 1000, height: 800 };
  const nb = resizeArea({ x: 100, y: 100, w: 200, h: 150 }, 'se', 50, 25, work);
  assert.strictEqual(nb.w, 250);
  assert.strictEqual(nb.h, 175);
});
