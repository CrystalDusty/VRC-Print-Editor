const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  openImageDialog: () => ipcRenderer.invoke('dialog:openImage'),
  openProjectDialog: () => ipcRenderer.invoke('dialog:openProject'),
  saveProjectDialog: () => ipcRenderer.invoke('dialog:saveProject'),
  savePngDialog: () => ipcRenderer.invoke('dialog:savePng'),
  readText: (path) => ipcRenderer.invoke('file:readText', path),
  writeText: (path, text) => ipcRenderer.invoke('file:writeText', path, text),
  readBuffer: (path) => ipcRenderer.invoke('file:readBuffer', path),
  writeBuffer: (path, base64) => ipcRenderer.invoke('file:writeBuffer', path, base64),
});
