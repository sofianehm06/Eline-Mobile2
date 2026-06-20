import { contextBridge, ipcRenderer } from 'electron'

const api = {
  invoke: (action: string, params?: unknown) => ipcRenderer.invoke('api', { action, params }),
  dialogMessage: (opts: unknown) => ipcRenderer.invoke('dialog.message', opts)
}

contextBridge.exposeInMainWorld('api', api)

export type ExposedApi = typeof api
