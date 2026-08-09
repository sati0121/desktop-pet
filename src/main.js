// main.js — 主进程：两个窗口、IPC、随机游走、拖动、右键菜单、区域编辑
const { app, BrowserWindow, ipcMain, Menu, screen, dialog, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const configStore = require('./config-store');
const geometry = require('./geometry');

app.setName('desktop-pet');

const PET_HEIGHT = 180;              // 宠物逻辑高度
const MIN_PET_HEIGHT = 60;           // 形象高度下限
const BUBBLE_HEAD = 108;             // 窗口顶部预留的气泡显示区高度（容纳多行长字幕）
const BUBBLE_MIN_W = 190;            // 窗口最小宽度（容纳气泡文字，宽些减少换行）
const ROOT = path.join(__dirname, '..'); // pet/

// 形象文件名 -> 显示名称（未列出的用文件名当名称）
const SPRITE_NAMES = {
  zhanli: '站立背书包', dun: '蹲姿', heshui: '坐姿捧杯', zhengfa: '整理头发',
  q_zhan: '挥手', q_pa: '趴卧卖萌', q_zuo: '坐凳捧杯', q_pachuang: '趴床',
  placeholder: '占位小猫'
};

const SPRITES_DIR = path.join(ROOT, 'src/renderer/assets/sprites');

// 动态扫描形象目录：本地可含多个形象，克隆后只有占位图，均自动识别
function loadSprites() {
  let files = [];
  try {
    files = fs.readdirSync(SPRITES_DIR).filter((f) => f.endsWith('.png'));
  } catch (_) { /* 目录不存在时返回空 */ }
  return files.map((f) => {
    const id = f.replace(/\.png$/, '');
    return { id, name: SPRITE_NAMES[id] || id, path: 'src/renderer/assets/sprites/' + f };
  }).sort((a, b) => (a.id === 'placeholder' ? 1 : b.id === 'placeholder' ? -1 : 0));
}

// 默认字幕（气泡文案）
const DEFAULT_SUBTITLES = ['嘿嘿～', '陪你玩～', '么么哒', '抱抱～', '啾咪！', '戳我干嘛！', '我在散步～', '加油鸭！'];

let petWindow = null;
let editorWindow = null;
let subtitleWindow = null;
let sizeWindow = null;
let config = null;
let spriteSize = { w: 150, h: 180 };
let petPos = { x: 0, y: 0 };

// 游走 / 拖动 / 编辑状态
let walk = { active: false, tick: null, timer: null, target: null, start: null, duration: 0, moveDir: 1 };
let petDrag = null;
let editDrag = null;

/* ---------------- 工具 ---------------- */

function primaryWorkArea() {
  const d = screen.getPrimaryDisplay();
  const a = d.workArea;
  return { x: a.x, y: a.y, width: a.width, height: a.height };
}

function spritePath() {
  const s = config.sprite || { root: 'app', path: 'src/renderer/assets/sprites/placeholder.png' };
  return s.root === 'userData'
    ? path.join(app.getPath('userData'), s.path)
    : path.join(ROOT, s.path);
}

function computeSpriteSize() {
  const img = nativeImage.createFromPath(spritePath());
  if (img.isEmpty()) return { w: BUBBLE_MIN_W, h: PET_HEIGHT + BUBBLE_HEAD };
  const sz = img.getSize();
  const h = config.petHeight || PET_HEIGHT;
  // 窗口宽 = 人物宽与气泡最小宽取大；窗口高 = 人物高 + 顶部气泡区
  const w = Math.max(BUBBLE_MIN_W, Math.round(h * sz.width / sz.height));
  return { w, h: h + BUBBLE_HEAD };
}

// 计算形象高度上限：窗口整体不得超出活动区域
function maxPetHeight() {
  const img = nativeImage.createFromPath(spritePath());
  if (img.isEmpty()) return Math.max(MIN_PET_HEIGHT, config.area.h - BUBBLE_HEAD);
  const sz = img.getSize();
  const ratio = sz.width / sz.height;
  const a = config.area;
  // 高度约束：形象高 + 气泡区 <= 区域高
  let maxH = a.h - BUBBLE_HEAD;
  // 宽度约束：形象宽 = h * 宽高比 <= 区域宽（考虑气泡最小宽）
  const maxByW = (a.w - 4) / ratio;
  maxH = Math.floor(Math.min(maxH, maxByW));
  return Math.max(maxH, MIN_PET_HEIGHT);
}

function notify(channel, payload) {
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send(channel, payload);
}

/* ---------------- 宠物位置 ---------------- */

function movePet(x, y) {
  const nb = geometry.clampPetToArea(
    { x: Math.round(x), y: Math.round(y), w: spriteSize.w, h: spriteSize.h },
    config.area
  );
  if (nb.x !== petPos.x || nb.y !== petPos.y) {
    petPos = nb;
    // 用 setBounds 显式带尺寸移动，避免 Windows 透明窗口 setPosition 导致的尺寸漂移
    petWindow.setBounds({ x: nb.x, y: nb.y, width: spriteSize.w, height: spriteSize.h });
  }
  return nb;
}

function placePetInitial() {
  const a = config.area;
  petPos = geometry.clampPetToArea(
    {
      x: a.x + Math.round((a.w - spriteSize.w) / 2),
      y: a.y + a.h - spriteSize.h,
      w: spriteSize.w, h: spriteSize.h
    },
    a
  );
  if (petWindow) petWindow.setBounds({ x: petPos.x, y: petPos.y, width: spriteSize.w, height: spriteSize.h });
}

/* ---------------- 随机游走 ---------------- */

function startWalking() {
  if (walk.active || !petWindow || editorWindow || petDrag) return;
  walk.active = true;
  notify('pet:walking', true);
  scheduleNextWalk();
}

function stopWalking() {
  walk.active = false;
  if (walk.tick) { clearInterval(walk.tick); walk.tick = null; }
  if (walk.timer) { clearTimeout(walk.timer); walk.timer = null; }
  notify('pet:walking', false);
}

function scheduleNextWalk() {
  if (!walk.active || !petWindow) return;
  const a = config.area;
  const minX = a.x, maxX = a.x + a.w - spriteSize.w;
  const minY = a.y, maxY = a.y + a.h - spriteSize.h;
  const tx = minX + Math.random() * (maxX - minX);
  const ty = minY + Math.random() * (maxY - minY);
  const sx = petPos.x, sy = petPos.y;
  const dist = Math.hypot(tx - sx, ty - sy);
  const speed = 30 + Math.random() * 50;            // DIP/秒
  const duration = Math.max(0.4, dist / speed) * 1000;

  const dir = tx >= sx ? 1 : -1;
  if (dir !== walk.moveDir) { walk.moveDir = dir; notify('pet:direction', dir); }

  walk.start = { x: sx, y: sy, t: performance.now() };
  walk.target = { x: tx, y: ty };
  walk.duration = duration;

  walk.tick = setInterval(() => {
    if (!walk.active || !walk.target) return;
    const p = Math.min((performance.now() - walk.start.t) / walk.duration, 1);
    const e = p < 1 ? p * p * (3 - 2 * p) : 1;      // smoothstep
    movePet(
      walk.start.x + (walk.target.x - walk.start.x) * e,
      walk.start.y + (walk.target.y - walk.start.y) * e
    );
    if (p >= 1) {
      clearInterval(walk.tick); walk.tick = null;
      walk.timer = setTimeout(() => { if (walk.active) scheduleNextWalk(); }, 500 + Math.random() * 1500);
    }
  }, 16);
}

/* ---------------- 宠物窗口 ---------------- */

function createPetWindow() {
  petWindow = new BrowserWindow({
    x: petPos.x, y: petPos.y,
    width: spriteSize.w, height: spriteSize.h,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    useContentSize: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  petWindow.setAlwaysOnTop(true, config.alwaysOnTopLevel || 'floating');
  petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  petWindow.once('ready-to-show', () => petWindow.show());
  petWindow.on('closed', () => { petWindow = null; });
  petWindow.webContents.on('context-menu', () => showPetMenu());
}

function showPetMenu() {
  const currentPath = config.sprite && config.sprite.root === 'app' ? config.sprite.path : '';
  const spriteItems = loadSprites().map((s) => ({
    label: s.name,
    type: 'radio',
    checked: currentPath === s.path,
    click: () => setSprite(s)
  }));
  Menu.buildFromTemplate([
    { label: '形象', submenu: spriteItems },
    { type: 'separator' },
    { label: '字幕管理…', click: openSubtitleEditor },
    { label: '调整尺寸…', click: openSizeSlider },
    { label: '调整活动区域', click: openAreaEditor },
    { label: '更换形象…', click: chooseSprite },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]).popup({ window: petWindow });
}

// 切换到预设形象
function setSprite(s) {
  config.sprite = { root: 'app', path: s.path };
  applySprite();
}

/* ---------------- 区域编辑窗口 ---------------- */

function openAreaEditor() {
  if (editorWindow || !petWindow) return;
  stopWalking();
  const a = config.area;
  editorWindow = new BrowserWindow({
    x: a.x, y: a.y,
    width: a.w, height: a.h,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    useContentSize: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  editorWindow.setAlwaysOnTop(true, 'screen-saver');
  editorWindow.loadFile(path.join(__dirname, 'renderer', 'editor.html'));
  editorWindow.once('ready-to-show', () => editorWindow.show());
  editorWindow.on('closed', () => { editorWindow = null; });
}

function closeAreaEditor() {
  if (editorWindow) { editorWindow.close(); editorWindow = null; }
  if (petWindow) petWindow.setAlwaysOnTop(true, config.alwaysOnTopLevel || 'floating');
}

function saveArea() {
  if (editorWindow) {
    const b = editorWindow.getBounds();
    config.area = geometry.clampArea(
      { x: b.x, y: b.y, w: b.width, h: b.height },
      primaryWorkArea()
    );
    configStore.save(config);
  }
  closeAreaEditor();
  if (petWindow) {
    petPos = geometry.clampPetToArea(petPos, config.area);
    petWindow.setBounds({ x: petPos.x, y: petPos.y, width: spriteSize.w, height: spriteSize.h });
    startWalking();
  }
}

/* ---------------- 字幕管理窗口 ---------------- */

function openSubtitleEditor() {
  if (subtitleWindow) { subtitleWindow.focus(); return; }
  subtitleWindow = new BrowserWindow({
    width: 360, height: 430,
    title: '字幕管理',
    alwaysOnTop: true,
    resizable: true,
    minWidth: 300, minHeight: 320,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  subtitleWindow.loadFile(path.join(__dirname, 'renderer', 'subtitle.html'));
  subtitleWindow.on('closed', () => { subtitleWindow = null; });
}

/* ---------------- 尺寸调整滑块窗口 ---------------- */

function openSizeSlider() {
  if (sizeWindow) { sizeWindow.focus(); return; }
  sizeWindow = new BrowserWindow({
    width: 340, height: 180,
    title: '调整形象尺寸',
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  sizeWindow.loadFile(path.join(__dirname, 'renderer', 'size.html'));
  sizeWindow.on('closed', () => { sizeWindow = null; });
}

// 应用形象高度（受区域上限约束）
function setPetHeight(h) {
  const maxH = maxPetHeight();
  h = Math.round(Math.max(MIN_PET_HEIGHT, Math.min(h, maxH)));
  if (h === config.petHeight) return;
  config.petHeight = h;
  applySprite();
}

/* ---------------- 更换形象 ---------------- */

async function chooseSprite() {
  if (!petWindow) return;
  const res = await dialog.showOpenDialog(petWindow, {
    title: '选择宠物形象 (PNG)',
    properties: ['openFile'],
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  });
  if (res.canceled || !res.filePaths[0]) return;
  const src = res.filePaths[0];
  const img = nativeImage.createFromPath(src);
  if (img.isEmpty()) {
    dialog.showErrorBox('无法读取图片', '请选择有效的 PNG 文件。');
    return;
  }
  const dir = path.join(app.getPath('userData'), 'sprites');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'sprite-' + Date.now() + '.png';
  fs.copyFileSync(src, path.join(dir, name));
  config.sprite = { root: 'userData', path: path.join('sprites', name) };
  applySprite();
}

function applySprite() {
  const img = nativeImage.createFromPath(spritePath());
  if (img.isEmpty()) {
    dialog.showErrorBox('无法加载形象', '形象图片不存在或已损坏。');
    return;
  }
  const sz = img.getSize();
  // 切换形象时若当前尺寸超过新形象上限，自动收回
  const maxH = maxPetHeight();
  if ((config.petHeight || PET_HEIGHT) > maxH) {
    config.petHeight = maxH;
  }
  const h = config.petHeight || PET_HEIGHT;
  const w = Math.max(BUBBLE_MIN_W, Math.round(h * sz.width / sz.height));
  spriteSize = { w, h: h + BUBBLE_HEAD };
  configStore.save(config);
  if (petWindow) {
    petWindow.setContentSize(spriteSize.w, spriteSize.h);
    movePet(petPos.x, petPos.y);
    notify('pet:sprite-updated', {
      spriteSrc: pathToFileURL(spritePath()).toString(),
      width: spriteSize.w, height: spriteSize.h
    });
  }
}

/* ---------------- 默认配置 ---------------- */

function makeDefaults() {
  return {
    version: 1,
    area: geometry.defaultArea(primaryWorkArea()),
    sprite: { root: 'app', path: 'src/renderer/assets/sprites/placeholder.png' },
    petHeight: PET_HEIGHT,
    alwaysOnTopLevel: 'floating',
    subtitles: DEFAULT_SUBTITLES.slice()
  };
}

/* ---------------- IPC ---------------- */

ipcMain.handle('pet:get-init', () => ({
  spriteSrc: pathToFileURL(spritePath()).toString(),
  width: spriteSize.w,
  height: spriteSize.h,
  bubbleHead: BUBBLE_HEAD,
  subtitles: (config.subtitles || DEFAULT_SUBTITLES).slice()
}));

// 字幕管理
ipcMain.handle('subtitle:get', () => (config.subtitles || DEFAULT_SUBTITLES).slice());

ipcMain.on('subtitle:set', (_e, list) => {
  if (!Array.isArray(list)) return;
  const clean = list
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0 && s.length <= 40);
  config.subtitles = clean.length ? clean : DEFAULT_SUBTITLES.slice();
  configStore.save(config);
  notify('pet:subtitles-updated', config.subtitles);
});

// 尺寸调整
ipcMain.handle('size:get', () => ({
  current: config.petHeight || PET_HEIGHT,
  min: MIN_PET_HEIGHT,
  max: maxPetHeight(),
  def: PET_HEIGHT,
  bubbleHead: BUBBLE_HEAD,
  area: config.area
}));

ipcMain.on('size:set', (_e, h) => {
  if (typeof h === 'number' && h >= MIN_PET_HEIGHT) setPetHeight(h);
});

ipcMain.on('pet:ready', startWalking);
ipcMain.on('pet:action-start', stopWalking);
ipcMain.on('pet:action-end', startWalking);

ipcMain.on('pet:drag-start', () => {
  stopWalking();
  const b = petWindow.getBounds();
  const cur = screen.getCursorScreenPoint();
  petDrag = {
    grabX: cur.x - b.x,
    grabY: cur.y - b.y,
    timer: setInterval(() => {
      if (!petWindow || !petDrag) return;
      const c = screen.getCursorScreenPoint();
      movePet(c.x - petDrag.grabX, c.y - petDrag.grabY);
    }, 16)
  };
});

ipcMain.on('pet:drag-end', () => {
  if (petDrag) { clearInterval(petDrag.timer); petDrag = null; }
  startWalking();
});

ipcMain.on('area:drag-start', (_e, type) => {
  if (!editorWindow) return;
  const b = editorWindow.getBounds();
  const cur = screen.getCursorScreenPoint();
  editDrag = {
    type,
    base: { x: b.x, y: b.y, w: b.width, h: b.height },
    startCursor: cur,
    timer: setInterval(() => {
      if (!editorWindow || !editDrag) return;
      const c = screen.getCursorScreenPoint();
      const dx = c.x - editDrag.startCursor.x;
      const dy = c.y - editDrag.startCursor.y;
      const nb = geometry.resizeArea(editDrag.base, editDrag.type, dx, dy, primaryWorkArea());
      const curB = editorWindow.getBounds();
      if (nb.x !== curB.x || nb.y !== curB.y || nb.w !== curB.width || nb.h !== curB.height) {
        editorWindow.setBounds({ x: nb.x, y: nb.y, width: nb.w, height: nb.h });
      }
    }, 16)
  };
});

ipcMain.on('area:drag-end', () => {
  if (editDrag) { clearInterval(editDrag.timer); editDrag = null; }
});

ipcMain.on('area:save', saveArea);

/* ---------------- 生命周期 ---------------- */

app.whenReady().then(() => {
  config = configStore.load(makeDefaults());
  config.area = geometry.clampArea(config.area, primaryWorkArea());
  // 校验形象文件存在，失效则回退默认（避免旧配置路径失效导致崩溃）
  const sp = config.sprite || makeDefaults().sprite;
  const img = nativeImage.createFromPath(
    sp.root === 'userData' ? path.join(app.getPath('userData'), sp.path) : path.join(ROOT, sp.path)
  );
  if (img.isEmpty()) {
    config.sprite = makeDefaults().sprite;
    configStore.save(config);
  }
  spriteSize = computeSpriteSize();
  createPetWindow();
  placePetInitial();

  screen.on('display-metrics-changed', () => {
    if (!config) return;
    config.area = geometry.clampArea(config.area, primaryWorkArea());
    configStore.save(config);
    if (petWindow) {
      petPos = geometry.clampPetToArea(petPos, config.area);
      petWindow.setBounds({ x: petPos.x, y: petPos.y, width: spriteSize.w, height: spriteSize.h });
    }
  });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  stopWalking();
  if (petDrag) { clearInterval(petDrag.timer); petDrag = null; }
  if (editDrag) { clearInterval(editDrag.timer); editDrag = null; }
});
