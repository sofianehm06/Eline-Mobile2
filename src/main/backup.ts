import { app, BrowserWindow, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { exportBytes, replaceDatabase, flushNow } from './db/database'
import { settingsRepo } from './db/repo'
import type { OpResult } from '@shared/types'

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export async function backupDatabase(win: BrowserWindow | null): Promise<OpResult> {
  flushNow()
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    title: 'Enregistrer la sauvegarde',
    defaultPath: `sauvegarde-${stamp()}.db`,
    filters: [{ name: 'Sauvegarde POS', extensions: ['db'] }]
  })
  if (canceled || !filePath) return { ok: false, error: 'Annulé' }
  try {
    fs.writeFileSync(filePath, exportBytes())
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}

// Choix du dossier de sauvegarde automatique
export async function chooseBackupDir(win: BrowserWindow | null): Promise<{ ok: boolean; path?: string }> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    title: 'Choisir le dossier de sauvegarde automatique',
    properties: ['openDirectory', 'createDirectory']
  })
  if (canceled || !filePaths?.length) return { ok: false }
  return { ok: true, path: filePaths[0] }
}

// Sauvegarde automatique silencieuse (appelée à la fermeture) — garde les 15 dernières
export function autoBackup(): void {
  try {
    const s = settingsRepo.getAll()
    if (!s.auto_backup || !s.auto_backup_dir) return
    if (!fs.existsSync(s.auto_backup_dir)) return
    flushNow()
    const file = path.join(s.auto_backup_dir, `pos-auto-${stamp()}.db`)
    fs.writeFileSync(file, exportBytes())
    const olds = fs
      .readdirSync(s.auto_backup_dir)
      .filter((f) => (f.startsWith('pos-auto-') || f.startsWith('eline-mobile-auto-')) && f.endsWith('.db'))
      .sort()
    if (olds.length > 15) {
      for (const f of olds.slice(0, olds.length - 15)) {
        try {
          fs.unlinkSync(path.join(s.auto_backup_dir, f))
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    console.error('Sauvegarde automatique échouée:', err)
  }
}

// Sauvegarde horaire silencieuse — appelée toutes les heures pendant la session.
// Enregistre dans le dossier configuré (ou userData/auto-backups/ si non configuré).
// Conserve les 24 dernières sauvegardes horaires.
export function periodicBackup(): void {
  try {
    const s = settingsRepo.getAll()
    let dir: string
    if (s.auto_backup && s.auto_backup_dir && fs.existsSync(s.auto_backup_dir)) {
      dir = s.auto_backup_dir
    } else {
      dir = path.join(app.getPath('userData'), 'auto-backups')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    }
    flushNow()
    const file = path.join(dir, `pos-hourly-${stamp()}.db`)
    fs.writeFileSync(file, exportBytes())
    const olds = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('pos-hourly-') && f.endsWith('.db'))
      .sort()
    for (const f of olds.slice(0, Math.max(0, olds.length - 24))) {
      try { fs.unlinkSync(path.join(dir, f)) } catch { /* ignore */ }
    }
  } catch (err) {
    console.error('[BACKUP] Sauvegarde horaire échouée:', err)
  }
}

export async function restoreDatabase(win: BrowserWindow | null): Promise<OpResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    title: 'Restaurer une sauvegarde',
    properties: ['openFile'],
    filters: [{ name: 'Sauvegarde POS', extensions: ['db'] }]
  })
  if (canceled || !filePaths?.length) return { ok: false, error: 'Annulé' }

  const confirm = await dialog.showMessageBox(win!, {
    type: 'warning',
    buttons: ['Annuler', 'Restaurer'],
    defaultId: 0,
    cancelId: 0,
    title: 'Confirmer la restauration',
    message: 'Restaurer cette sauvegarde remplacera toutes les données actuelles. Continuer ?'
  })
  if (confirm.response !== 1) return { ok: false, error: 'Annulé' }

  try {
    const bytes = fs.readFileSync(filePaths[0])
    replaceDatabase(new Uint8Array(bytes))
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}
