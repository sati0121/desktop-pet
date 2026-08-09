// editor.js — 区域编辑交互：手柄缩放 + 内部移动，交给主进程 setBounds
let dragging = null;

document.querySelectorAll('.handle').forEach((h) => {
  h.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dragging = h.dataset.h;
    document.body.setPointerCapture(e.pointerId);
    window.petAPI.editorDragStart(dragging);
  });
});

document.getElementById('area').addEventListener('pointerdown', (e) => {
  if (e.target.classList.contains('handle')) return;
  dragging = 'move';
  document.body.setPointerCapture(e.pointerId);
  window.petAPI.editorDragStart('move');
});

document.addEventListener('pointerup', () => {
  if (dragging) {
    window.petAPI.editorDragEnd();
    dragging = null;
  }
});

document.addEventListener('pointercancel', () => {
  if (dragging) {
    window.petAPI.editorDragEnd();
    dragging = null;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.petAPI.editorSave();
});

document.getElementById('save').addEventListener('click', () => window.petAPI.editorSave());
