// pet.js — 宠物渲染层：状态机(idle/walk/action/drag)、点击vs拖动、随机动作、行走浮动
const stage = document.getElementById('stage');
const bubble = document.getElementById('bubble');
const flip = document.getElementById('flip');

const ACTIONS = ['act-jump', 'act-spin', 'act-shake', 'act-bounce', 'act-hop', 'act-dance', 'act-squash'];
let lines = ['嘿嘿～', '陪你玩～', '么么哒', '抱抱～', '啾咪！', '戳我干嘛！', '我在散步～', '加油鸭！'];

let state = 'idle';   // idle | walking | action | drag
let dragging = false;
let moved = false;
let downX = 0, downY = 0;
let bobT = 0;

/* ---------------- 初始化 ---------------- */
async function init() {
  const info = await window.petAPI.getInit();
  stage.src = info.spriteSrc;
  if (Array.isArray(info.subtitles) && info.subtitles.length > 0) lines = info.subtitles;
  // 顶部预留气泡显示区
  document.documentElement.style.setProperty('--bubble-head', (info.bubbleHead || 0) + 'px');
  stage.onload = () => window.petAPI.ready();
}

/* ---------------- 行走浮动 + idle 浮动 ---------------- */
function loop(ts) {
  requestAnimationFrame(loop);
  bobT += ts - (loop._last || ts);
  loop._last = ts;

  if (state === 'walking') {
    document.body.style.transform = 'translateY(' + (Math.sin(bobT * 0.012) * 4) + 'px)';
  } else if (state === 'idle') {
    document.body.style.transform = 'translateY(' + (Math.sin(bobT * 0.004) * 2) + 'px)';
  }
}

/* ---------------- 点击 vs 拖动 ---------------- */
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  dragging = true;
  moved = false;
  downX = e.screenX;
  downY = e.screenY;
  document.body.setPointerCapture(e.pointerId);
});

document.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - downX;
  const dy = e.screenY - downY;
  if (!moved && Math.hypot(dx, dy) > 6) {
    moved = true;
    state = 'drag';
    window.petAPI.dragStart();
  }
});

document.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  if (moved) {
    window.petAPI.dragEnd();
    state = 'idle';
  } else if (e.button === 0) {
    playRandomAction();
  }
});

document.addEventListener('pointercancel', () => {
  if (dragging) {
    dragging = false;
    if (moved) window.petAPI.dragEnd();
    moved = false;
    state = 'idle';
  }
});

/* ---------------- 随机可爱动作 ---------------- */
function actionDuration(cls) {
  const m = { 'act-jump': 900, 'act-spin': 1200, 'act-shake': 600, 'act-bounce': 900, 'act-hop': 1100, 'act-dance': 1000, 'act-squash': 800 };
  return m[cls] || 900;
}

function showBubble(text) {
  bubble.textContent = text;
  bubble.classList.add('show');
  setTimeout(() => bubble.classList.remove('show'), 1600);
}

function playRandomAction() {
  if (state === 'action' || state === 'drag') return;
  state = 'action';
  window.petAPI.actionStart();   // 让主进程暂停游走

  const cls = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  stage.classList.remove('animating');
  void stage.offsetWidth;        // 强制重启动画
  stage.classList.add(cls, 'animating');

  if (Math.random() < 0.5 && lines.length > 0) {
    showBubble(lines[Math.floor(Math.random() * lines.length)]);
  }

  setTimeout(() => {
    stage.classList.remove(cls, 'animating');
    state = 'idle';
    window.petAPI.actionEnd();   // 恢复游走
  }, actionDuration(cls) + 150);
}

/* ---------------- 主进程事件 ---------------- */
window.petAPI.onDirection((d) => {
  flip.style.transform = d === -1 ? 'scaleX(-1)' : 'scaleX(1)';
});
window.petAPI.onWalking((v) => {
  if (v && (state === 'idle' || state === 'walking')) state = 'walking';
  else if (!v && state === 'walking') state = 'idle';
});
window.petAPI.onSpriteUpdated((info) => { stage.src = info.spriteSrc; });
window.petAPI.onSubtitlesUpdated((list) => {
  if (Array.isArray(list) && list.length > 0) lines = list;
});

init();
requestAnimationFrame(loop);
