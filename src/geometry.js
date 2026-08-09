// geometry.js — 纯几何函数：默认活动区域、区域/宠物钳制
// 所有坐标均为逻辑像素(DIP)。可在 node --test 下直接测试。

const MIN_SIZE = 100;

// 默认活动区域：屏幕右上角，宽=工作区宽/3，高=工作区高/2 → 正好 1/6 面积
function defaultArea(workArea) {
  const w = Math.round(workArea.width / 3);
  const h = Math.round(workArea.height / 2);
  const x = workArea.x + workArea.width - w;
  const y = workArea.y;
  return { x, y, w, h };
}

// 把区域钳制在工作区内，且不小于 MIN_SIZE×MIN_SIZE
function clampArea(area, workArea, minSize = MIN_SIZE) {
  let { x, y, w, h } = area;
  w = Math.max(minSize, w);
  h = Math.max(minSize, h);
  w = Math.min(w, workArea.width);
  h = Math.min(h, workArea.height);
  x = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - w);
  y = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - h);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

// 把宠物（pet: {x,y,w,h}）钳制在区域内
function clampPetToArea(pet, area) {
  const x = Math.min(Math.max(pet.x, area.x), area.x + area.w - pet.w);
  const y = Math.min(Math.max(pet.y, area.y), area.y + area.h - pet.h);
  return { x: Math.round(x), y: Math.round(y), w: pet.w, h: pet.h };
}

// 根据手柄类型计算新区域（拖拽时用）
// type: 'move'|'n'|'s'|'w'|'e'|'nw'|'ne'|'sw'|'se'
function resizeArea(base, type, dx, dy, workArea, minSize = MIN_SIZE) {
  let { x, y, w, h } = base;
  switch (type) {
    case 'move':
      x = base.x + dx; y = base.y + dy;
      break;
    case 'n':
      y = base.y + dy; h = base.h - dy;
      break;
    case 's':
      h = base.h + dy;
      break;
    case 'w':
      x = base.x + dx; w = base.w - dx;
      break;
    case 'e':
      w = base.w + dx;
      break;
    case 'nw':
      x = base.x + dx; y = base.y + dy; w = base.w - dx; h = base.h - dy;
      break;
    case 'ne':
      y = base.y + dy; w = base.w + dx; h = base.h - dy;
      break;
    case 'sw':
      x = base.x + dx; w = base.w - dx; h = base.h + dy;
      break;
    case 'se':
      w = base.w + dx; h = base.h + dy;
      break;
    default:
      return { x, y, w, h };
  }
  return clampArea({ x, y, w, h }, workArea, minSize);
}

module.exports = { defaultArea, clampArea, clampPetToArea, resizeArea, MIN_SIZE };
