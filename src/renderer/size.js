// size.js — 尺寸调整：滑块实时调整形象大小（受区域上限约束）
const slider = document.getElementById('slider');
const pct = document.getElementById('pct');
const hint = document.getElementById('hint');
const resetBtn = document.getElementById('reset');

let min, max, def, current;

function fmtPct(h) {
  return Math.round((h / def) * 100) + '%';
}

function updateUI() {
  pct.textContent = fmtPct(slider.value);
  hint.textContent = '当前 ' + slider.value + 'px · 区域上限 ' + max + 'px';
}

slider.addEventListener('input', () => {
  current = Number(slider.value);
  updateUI();
  window.petAPI.setSize(current);
});

resetBtn.addEventListener('click', () => {
  slider.value = Math.min(def, max);
  current = Number(slider.value);
  updateUI();
  window.petAPI.setSize(current);
});

async function init() {
  const info = await window.petAPI.getSize();
  min = info.min;
  max = info.max;
  def = info.def;
  current = Math.min(Math.max(info.current, min), max);

  slider.min = min;
  slider.max = max;
  slider.value = current;
  updateUI();

  if (max <= min) {
    hint.textContent = '活动区域太小，无法调整尺寸';
  }
}

init();
