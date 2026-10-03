const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronNotifier', {
  /**
   * Request native desktop notification display via Electron main process.
   * @param {Object} payload - { title, body }
   */
  sendNotification: (payload) => {
    ipcRenderer.send('electron-notify', payload);
  },
});

contextBridge.exposeInMainWorld('electronEnv', {
  platform: process.platform,
  isPackaged: () => ipcRenderer.invoke('app-is-packaged'),
});
