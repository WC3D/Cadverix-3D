const { contextBridge, ipcRenderer } = require("electron");

const desktopApi = {
  mcpAvailable: true,
  getVersion: () => ipcRenderer.invoke("sketchforge:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("sketchforge:check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("sketchforge:install-update"),
};
contextBridge.exposeInMainWorld("cadverixDesktop", desktopApi);
contextBridge.exposeInMainWorld("sketchforgeDesktop", desktopApi);
