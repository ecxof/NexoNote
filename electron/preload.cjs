/**
 * Preload script: exposes a minimal API to the renderer via contextBridge.
 * Renderer must use only these methods; no direct Node or fs access.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  notes: {
    getAll: () => ipcRenderer.invoke('notes:getAll'),
    getById: (id) => ipcRenderer.invoke('notes:getById', id),
    create: (folderId) => ipcRenderer.invoke('notes:create', folderId),
    update: (id, payload) => ipcRenderer.invoke('notes:update', id, payload),
    delete: (id) => ipcRenderer.invoke('notes:delete', id),
  },
  folders: {
    getAll: () => ipcRenderer.invoke('folders:getAll'),
    create: (name, parentId) => ipcRenderer.invoke('folders:create', name, parentId),
    update: (id, payload) => ipcRenderer.invoke('folders:update', id, payload),
    delete: (id) => ipcRenderer.invoke('folders:delete', id),
  },
  pdfs: {
    getAll: () => ipcRenderer.invoke('pdfs:getAll'),
    getById: (id) => ipcRenderer.invoke('pdfs:getById', id),
    add: (filePath, title, folderId) => ipcRenderer.invoke('pdfs:add', filePath, title, folderId),
    update: (id, payload) => ipcRenderer.invoke('pdfs:update', id, payload),
    remove: (id) => ipcRenderer.invoke('pdfs:remove', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings),
  },
});
