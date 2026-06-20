import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { SCHEMA_SQL, DEFAULT_SETTINGS, DEFAULT_CATEGORIES, DEFAULT_LOSS_TYPES } from './schema'

let SQL: SqlJsStatic
let db: Database
let dbPath = ''
let dirty = false
let flushTimer: NodeJS.Timeout | null = null

function wasmPath(): string {
  // En production le .wasm est copié via extraResources ; en dev il est dans node_modules.
  const prod = path.join(process.resourcesPath || '', 'sql-wasm.wasm')
  if (fs.existsSync(prod)) return prod
  return path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
}

export async function initDatabase(): Promise<void> {
  SQL = await initSqlJs({ locateFile: () => wasmPath() })

  const dir = app.getPath('userData')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  dbPath = path.join(dir, 'eline-mobile.db')

  if (fs.existsSync(dbPath)) {
    const bytes = fs.readFileSync(dbPath)
    db = new SQL.Database(bytes)
  } else {
    db = new SQL.Database()
  }

  db.run(SCHEMA_SQL)
  migrate()
  ensureDefaultSettings()
  seedDefaultCategoriesOnce()
  flushNow()
  startPeriodicFlush()
}

// Insère les catégories par défaut (sans doublon).
function insertDefaultCategories(): void {
  for (const [name, color] of DEFAULT_CATEGORIES) {
    db.run('INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)', [name, color])
  }
}

// Une seule fois (au tout premier lancement) : ne se relance pas si l'utilisateur supprime des catégories.
function seedDefaultCategoriesOnce(): void {
  const seeded = row<{ value: string }>("SELECT value FROM settings WHERE key='defaults_seeded'")?.value
  if (seeded === '1') return
  const count = row<{ c: number }>('SELECT COUNT(*) AS c FROM categories')?.c ?? 0
  if (count === 0) insertDefaultCategories()
  const ltCount = row<{ c: number }>('SELECT COUNT(*) AS c FROM loss_types')?.c ?? 0
  if (ltCount === 0) {
    for (const name of DEFAULT_LOSS_TYPES) {
      db.run('INSERT OR IGNORE INTO loss_types (name) VALUES (?)', [name])
    }
  }
  db.run("INSERT INTO settings (key,value) VALUES ('defaults_seeded','1') ON CONFLICT(key) DO UPDATE SET value='1'")
}

// Migrations idempotentes : ajoute les colonnes manquantes aux tables existantes.
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = rows<{ name: string }>(`PRAGMA table_info(${table})`)
  if (!cols.some((c) => c.name === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
}

function migrate(): void {
  // v3 : état (occasion) sur les unités IMEI
  ensureColumn('imei_units', 'condition', "condition TEXT DEFAULT 'Neuf'")
  // v4 : solde de départ (ancien crédit repris d'un autre logiciel)
  ensureColumn('customers', 'opening_balance', 'opening_balance REAL DEFAULT 0')
  // v5 : quantité remboursée par ligne (remboursement partiel)
  ensureColumn('sale_items', 'refunded_qty', 'refunded_qty REAL DEFAULT 0')
  // v6 : fournisseur lié au produit
  ensureColumn('products', 'supplier_id', 'supplier_id INTEGER')
  // v7 : 2ème prix de vente
  ensureColumn('products', 'sale_price2', 'sale_price2 REAL DEFAULT 0')
  // v8 : 3ème prix de vente
  ensureColumn('products', 'sale_price3', 'sale_price3 REAL DEFAULT 0')
  // v9 : référence unique des bons de réception
  ensureColumn('purchase_orders', 'ref', 'ref TEXT')
}

function ensureDefaultSettings(): void {
  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    stmt.run([k, v])
  }
  stmt.free()
}

// ----- Persistance sur disque (écriture atomique, anti-rebond) -----
function scheduleFlush(): void {
  dirty = true
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    if (dirty) flushNow()
  }, 400)
}

// Flush périodique de sécurité : même sans écriture, persiste toutes les 5 min
// pour minimiser la perte en cas de crash/coupure de courant.
let periodicFlushTimer: NodeJS.Timeout | null = null
function startPeriodicFlush(): void {
  if (periodicFlushTimer) return
  periodicFlushTimer = setInterval(() => {
    if (db) flushNow()
  }, 5 * 60 * 1000)
}

export function flushNow(): void {
  if (!db) return
  try {
    const data = Buffer.from(db.export())
    const tmp = dbPath + '.tmp'
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, dbPath)
    dirty = false
  } catch (err) {
    console.error('Erreur de sauvegarde de la base:', err)
  }
}

export function getDbPath(): string {
  return dbPath
}

// Efface toutes les données métier (garde les paramètres et la licence).
export function resetBusinessData(): void {
  const tables = [
    'purchase_order_items',
    'purchase_orders',
    'losses',
    'loss_types',
    'sale_items',
    'sales',
    'customer_payments',
    'stock_movements',
    'imei_units',
    'tradeins',
    'products',
    'categories',
    'suppliers',
    'customers'
  ]
  db.run('BEGIN')
  try {
    for (const t of tables) db.run(`DELETE FROM ${t}`)
    // sqlite_sequence n'existe que si une table AUTOINCREMENT a déjà reçu une ligne.
    try {
      db.run('DELETE FROM sqlite_sequence')
    } catch {
      /* table absente sur une base vierge : sans importance */
    }
    insertDefaultCategories() // remet les catégories par défaut (état "install neuve")
    db.run('COMMIT')
  } catch (err) {
    try {
      db.run('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw err
  }
  flushNow()
}

export function exportBytes(): Buffer {
  return Buffer.from(db.export())
}

export function replaceDatabase(bytes: Uint8Array): void {
  db = new SQL.Database(bytes)
  db.run(SCHEMA_SQL)
  migrate() // applique les colonnes récentes si la sauvegarde restaurée vient d'une ancienne version
  ensureDefaultSettings()
  flushNow()
}

// ----- Helpers requêtes -----
function rows<T = any>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out: T[] = []
  while (stmt.step()) out.push(stmt.getAsObject() as T)
  stmt.free()
  return out
}

function row<T = any>(sql: string, params: any[] = []): T | undefined {
  const r = rows<T>(sql, params)
  return r[0]
}

function run(sql: string, params: any[] = []): { id: number; changes: number } {
  db.run(sql, params)
  scheduleFlush()
  const id = (row<{ id: number }>('SELECT last_insert_rowid() AS id')?.id) ?? 0
  const changes = (row<{ c: number }>('SELECT changes() AS c')?.c) ?? 0
  return { id, changes }
}

function exec(sql: string): void {
  db.exec(sql)
  scheduleFlush()
}

function transaction<T>(fn: () => T): T {
  db.run('BEGIN')
  try {
    const result = fn()
    db.run('COMMIT')
    scheduleFlush()
    return result
  } catch (err) {
    try {
      db.run('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw err
  }
}

// API interne exposée aux repositories
export const api = { rows, row, run, exec, transaction, flushNow }
export type Db = typeof api
