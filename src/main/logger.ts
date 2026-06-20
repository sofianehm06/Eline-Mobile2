import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

let logStream: fs.WriteStream | null = null

function stamp(): string {
  return new Date().toISOString()
}

function openStream(logPath: string): void {
  logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' })
  logStream.on('error', () => { logStream = null })
}

function rotateIfNeeded(logPath: string, dir: string): void {
  try {
    if (!fs.existsSync(logPath)) return
    if (fs.statSync(logPath).size < 5 * 1024 * 1024) return
    const d = new Date()
    const suf = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
    fs.renameSync(logPath, path.join(dir, `pos-${suf}.log`))
    const olds = fs.readdirSync(dir).filter((f) => f.startsWith('pos-') && f.endsWith('.log')).sort()
    for (const f of olds.slice(0, Math.max(0, olds.length - 3))) {
      try { fs.unlinkSync(path.join(dir, f)) } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function write(level: string, args: unknown[]): void {
  if (!logStream) return
  const msg = args.map((a) => (a instanceof Error ? (a.stack || a.message) : String(a))).join(' ')
  try { logStream.write(`[${stamp()}] [${level}] ${msg}\n`) } catch { /* ignore */ }
}

export function initLogger(): void {
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const logPath = path.join(dir, 'pos.log')
    rotateIfNeeded(logPath, dir)
    openStream(logPath)
    logInfo(`=== Démarrage POS v${app.getVersion()} ===`)
  } catch { /* non-fatal */ }

  const origError = console.error.bind(console)
  const origWarn = console.warn.bind(console)
  console.error = (...args: unknown[]) => { origError(...args); write('ERROR', args) }
  console.warn = (...args: unknown[]) => { origWarn(...args); write('WARN', args) }
}

export function logInfo(msg: string): void {
  write('INFO', [msg])
}
