import { app, dialog, BrowserWindow } from 'electron'
import crypto from 'node:crypto'
import os from 'node:os'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { settingsRepo } from './db/repo'

// Clé PUBLIQUE uniquement (la clé privée reste chez le développeur, dans tools/genkey.cjs).
// Impossible de forger une licence sans la clé privée.
const PUBLIC_KEY_DER_B64 = 'MCowBQYDK2VwAyEAlHrh8zAmZpBbbnvgQ/ULsQJDc+76sf5pbzpr4xhpF40='
const publicKey = crypto.createPublicKey({
  key: Buffer.from(PUBLIC_KEY_DER_B64, 'base64'),
  format: 'der',
  type: 'spki'
})

// Identifiant matériel stable (MachineGuid Windows), sinon repli.
function rawMachine(): string {
  try {
    const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
      encoding: 'utf8',
      windowsHide: true
    })
    const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i)
    if (m) return m[1]
  } catch {
    /* ignore */
  }
  return `${os.hostname()}|${os.platform()}|${os.arch()}`
}

export function machineId(): string {
  const h = crypto.createHash('sha256').update('eline-mobile::' + rawMachine()).digest('hex').slice(0, 16).toUpperCase()
  return h.match(/.{4}/g)!.join('-') // ex: A1B2-C3D4-E5F6-7890
}

// Forme canonique (sans tirets, majuscules) utilisée pour la signature
function canonical(id: string): string {
  return (id || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function verifyKey(blob: string, id: string): boolean {
  try {
    const sig = Buffer.from((blob || '').trim().replace(/\s+/g, ''), 'base64')
    if (sig.length < 32) return false
    return crypto.verify(null, Buffer.from(canonical(id)), publicKey, sig)
  } catch {
    return false
  }
}

export interface LicenseStatus {
  activated: boolean
  machineId: string
  dev?: boolean
}

export function getLicenseStatus(): LicenseStatus {
  const id = machineId()
  // En développement (non packagé), aucune restriction.
  if (!app.isPackaged) return { activated: true, machineId: id, dev: true }
  const key = settingsRepo.getAll().license_key
  return { activated: !!key && verifyKey(key, id), machineId: id }
}

export function activateLicense(key: string): { ok: boolean; error?: string } {
  const id = machineId()
  if (verifyKey(key, id)) {
    settingsRepo.update({ license_key: (key || '').trim() })
    return { ok: true }
  }
  return { ok: false, error: 'Clé invalide pour ce PC. Vérifiez que la clé correspond bien à cet ordinateur.' }
}

export async function activateFromFile(win: BrowserWindow | null): Promise<{ ok: boolean; error?: string }> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    title: 'Choisir le fichier de licence',
    properties: ['openFile'],
    filters: [{ name: 'Licence', extensions: ['lic', 'txt', 'key'] }]
  })
  if (canceled || !filePaths?.length) return { ok: false, error: 'Annulé' }
  try {
    const content = fs.readFileSync(filePaths[0], 'utf8')
    return activateLicense(content)
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}
