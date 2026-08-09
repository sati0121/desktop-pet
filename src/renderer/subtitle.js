// subtitle.js — 字幕管理：编辑/添加/删除，改动即时保存
const listEl = document.getElementById('list');
const addBtn = document.getElementById('add');

let subs = [];

/* ---------------- 渲染 ---------------- */
function render() {
  listEl.innerHTML = '';
  subs.forEach((text, i) => {
    const row = document.createElement('div');
    row.className = 'row';

    const input = document.createElement('input');
    input.value = text;
    input.maxLength = 40;
    input.addEventListener('input', () => {
      subs[i] = input.value;
      save();
    });
    // 聚焦时选中内容方便修改
    input.addEventListener('focus', () => input.select());

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = '删除';
    del.addEventListener('click', () => {
      subs.splice(i, 1);
      render();
      save();
    });

    row.appendChild(input);
    row.appendChild(del);
    listEl.appendChild(row);
  });
}

/* ---------------- 保存 ---------------- */
let saveTimer = null;
function save() {
  // 防抖：连续输入时延迟保存
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const clean = subs
      .map((s) => (s || '').trim())
      .filter((s) => s.length > 0);
    window.petAPI.setSubtitles(clean);
    flashSaved();
  }, 400);
}

function flashSaved() {
  let el = document.querySelector('.saved');
  if (!el) {
    el = document.createElement('div');
    el.className = 'saved';
    document.querySelector('.app').appendChild(el);
  }
  el.textContent = '已保存 ✓';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

/* ---------------- 添加 ---------------- */
addBtn.addEventListener('click', () => {
  subs.push('');
  render();
  // 聚焦新行输入框
  const inputs = listEl.querySelectorAll('input');
  inputs[inputs.length - 1].focus();
});

/* ---------------- 初始化 ---------------- */
async function init() {
  subs = await window.petAPI.getSubtitles();
  if (!subs || subs.length === 0) subs = ['嘿嘿～', '陪你玩～', '么么哒'];
  render();
}

init();
