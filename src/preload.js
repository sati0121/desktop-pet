// preload.js — 通过 contextBridge 暴露安全的 IPC 接口
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  // 宠物窗口
  getInit: () => ipcRenderer.invoke('pet:get-init'),
  ready: () => ipcRenderer.send('pet:ready'),
  actionStart: () => ipcRenderer.send('pet:action-start'),
  actionEnd: () => ipcRenderer.send('pet:action-end'),
  dragStart: () => ipcRenderer.send('pet:drag-start'),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  onWalking: (cb) => ipcRenderer.on('pet:walking', (_e, v) => cb(v)),
  onDirection: (cb) => ipcRenderer.on('pet:direction', (_e, d) => cb(d)),
  onSpriteUpdated: (cb) => ipcRenderer.on('pet:sprite-updated', (_e, info) => cb(info)),
  onSubtitlesUpdated: (cb) => ipcRenderer.on('pet:subtitles-updated', (_e, list) => cb(list)),
  // 区域编辑窗口
  editorDragStart: (type) => ipcRenderer.send('area:drag-start', type),
  editorDragEnd: () => ipcRenderer.send('area:drag-end'),
  editorSave: () => ipcRenderer.send('area:save'),
  // 字幕管理窗口
  getSubtitles: () => ipcRenderer.invoke('subtitle:get'),
  setSubtitles: (list) => ipcRenderer.send('subtitle:set', list),
  // 尺寸调整窗口
  getSize: () => ipcRenderer.invoke('size:get'),
  setSize: (h) => ipcRenderer.send('size:set', h)
});
