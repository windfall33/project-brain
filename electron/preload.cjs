const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('galaxyAPI', {
  loadMemories: () => ipcRenderer.invoke('memories:load'),
  saveMemories: (data) => ipcRenderer.invoke('memories:save', data),
  loadStarfield: () => ipcRenderer.invoke('memories:load'),
  saveStarfield: (data) => ipcRenderer.invoke('memories:save', data),
  pickImage: () => ipcRenderer.invoke('assets:pickImage'),
  pickVideo: () => ipcRenderer.invoke('assets:pickVideo'),
  importImage: (payload) => ipcRenderer.invoke('assets:importImage', payload),
});
