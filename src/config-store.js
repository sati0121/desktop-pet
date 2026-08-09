// config-store.js — userData 配置读写，损坏时备份并回退默认
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function load(defaults) {
  const p = configPath();
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg || typeof cfg !== 'object') throw new Error('bad config');
    return Object.assign({}, defaults, cfg);
  } catch (e) {
    // 备份损坏/缺失的配置
    try {
      if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak');
    } catch (_) { /* ignore */ }
    return defaults;
  }
}

function save(cfg) {
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

module.exports = { load, save, configPath };
