const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  openThemes:()=>ipcRenderer.invoke('sanka:themes'),
  getState: () => ipcRenderer.invoke('sanka:state'),
  onState: (cb) => ipcRenderer.on('sanka:state', (_, s) => cb(s)),
  action: (a) => ipcRenderer.invoke('sanka:action', a),
  login: () => ipcRenderer.invoke('sanka:login'),
  logout: () => ipcRenderer.invoke('sanka:logout'),
  startDrag: () => ipcRenderer.send('sanka:drag'),
  addAsset: (name, data) => ipcRenderer.invoke('sanka:asset:add', name, data),
  saveDesign: (d, select) => ipcRenderer.invoke('sanka:design:save', d, select),
  deleteDesign: (id) => ipcRenderer.invoke('sanka:design:delete', id),
  exportDesign: (id) => ipcRenderer.invoke('sanka:design:export', id),
  importDesign: () => ipcRenderer.invoke('sanka:design:import'),
  copy: (t) => ipcRenderer.invoke('sanka:copy', t),
  urls: () => ipcRenderer.invoke('sanka:urls'),
  setMini: (on) => ipcRenderer.invoke('sanka:mini:set', on),
  setPinned: (on) => ipcRenderer.invoke('sanka:pin:set', on),
  uiFlags: () => ipcRenderer.invoke('sanka:ui:flags'),
  onMini: (cb) => ipcRenderer.on('sanka:mini', (_, v) => cb(v)),
  onPinned: (cb) => ipcRenderer.on('sanka:pinned', (_, v) => cb(v)),
  updateState: () => ipcRenderer.invoke('sanka:update:state'),
  onUpdate: (cb) => ipcRenderer.on('sanka:update', (_, v) => cb(v)),
  checkUpdate: () => ipcRenderer.invoke('sanka:update:check'),
  installUpdate: () => ipcRenderer.invoke('sanka:update:install'),
  openReleases: () => ipcRenderer.invoke('sanka:update:releases'),
});


