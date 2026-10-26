const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('wordbookDesktop', {
  setLanguage: language => ipcRenderer.invoke('ui:language', language),
  listInput: () => ipcRenderer.invoke('input:list'),
  readInput: name => ipcRenderer.invoke('input:read', name),
  saveFile: (name, text) => ipcRenderer.invoke('backup:save', name, text),
});
