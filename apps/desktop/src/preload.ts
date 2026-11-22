import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  printLabels: (options?: { deviceName?: string; images?: string[] }) =>
    ipcRenderer.invoke('print-labels', options),
  getPrinters: () =>
    ipcRenderer.invoke('get-printers'),
});
