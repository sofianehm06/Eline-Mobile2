import { app, shell, BrowserWindow, Menu } from 'electron'
import { join } from 'node:path'
import { initDatabase, flushNow } from './db/database'
import { settingsRepo } from './db/repo'
import { autoBackup, periodicBackup } from './backup'
import { registerIpc } from './ipc'
import { initLogger, logInfo } from './logger'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

// ---- File logging (errors + critical events persist in userData/logs/) ----
initLogger()

// ---- Crash protection: flush DB on any unexpected error ----
process.on('uncaughtException', (err) => {
  console.error('[CRASH] uncaughtException:', err)
  try { flushNow() } catch {}
})
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH] unhandledRejection:', reason)
  try { flushNow() } catch {}
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1320',
    title: (() => { try { return settingsRepo.getAll().store_name || 'POS — Gestion de boutique' } catch { return 'POS — Gestion de boutique' } })(),
    icon: join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) mainWindow?.webContents.openDevTools({ mode: 'detach' })
  })

  // Auto-reload if renderer crashes (power surge, memory issue, etc.)
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[CRASH] Renderer crashed:', details.reason)
    flushNow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload()
      }, 1000)
    }
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[WARN] Renderer unresponsive — waiting...')
  })

  mainWindow.webContents.on('responsive', () => {
    console.info('[INFO] Renderer responsive again')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Instance unique
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    try {
      await initDatabase()
      logInfo('Base de données initialisée')
    } catch (err) {
      console.error('Échec initialisation base de données:', err)
    }
    registerIpc()
    createWindow()
    // Sauvegarde automatique toutes les heures pendant la session (19h sans fermeture)
    setInterval(() => periodicBackup(), 60 * 60 * 1000)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    flushNow()
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    flushNow()
    autoBackup()
  })

  // Memory watchdog: warn at 512MB, force reload at 700MB (sql.js keeps DB in RAM)
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.getProcessMemoryInfo().then((mem) => {
      const mb = Math.round(mem.private / 1024)
      if (mem.private > 700 * 1024) {
        console.warn(`[MEM] Renderer using ${mb}MB — forcing reload to recover memory`)
        try { flushNow() } catch {}
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload()
      } else if (mem.private > 512 * 1024) {
        console.warn(`[MEM] Renderer using ${mb}MB — approaching limit`)
      }
    }).catch(() => {})
  }, 60_000)
}
