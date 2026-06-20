#!/usr/bin/env node
/**
 * Test de charge — simule 19h de caisse accélérée.
 * Mesure : débit SQL, croissance DB, empreinte mémoire Node.js.
 * Usage : node tools/load-test.mjs
 *
 * Exécuter depuis la racine du projet (npm/pnpm install requis).
 */
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmPath = join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')

if (!fs.existsSync(wasmPath)) {
  console.error('❌  sql-wasm.wasm introuvable. Lancez depuis la racine du projet après npm install.')
  process.exit(1)
}

const initSqlJs = require('sql.js')
const SQL = await initSqlJs({ locateFile: () => wasmPath })

// ── Schéma minimal pour simuler les ventes ──────────────────────────────────
const db = new SQL.Database()
db.run(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    stock_qty REAL DEFAULT 0,
    cost_price REAL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    tracks_imei INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT,
    customer_id INTEGER,
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    paid REAL DEFAULT 0,
    change_due REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'completed',
    datetime TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER,
    name TEXT,
    qty REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    cost_price REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    line_total REAL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    type TEXT,
    qty REAL,
    reason TEXT,
    datetime TEXT DEFAULT (datetime('now','localtime'))
  );
`)

// ── Données de départ : 100 produits ─────────────────────────────────────────
for (let i = 1; i <= 100; i++) {
  db.run(
    `INSERT INTO products (name, stock_qty, cost_price, sale_price, tracks_imei, is_active)
     VALUES (?, 9999, ?, ?, 0, 1)`,
    [`Produit Test ${i}`, 1000 + i * 10, 1500 + i * 15]
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const mem = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
const dbKb = () => Math.round(db.export().byteLength / 1024)
const lastId = () => db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]

// ── Simulation ────────────────────────────────────────────────────────────────
// 19h × ~120 ventes/h = ~2280 ventes → on simule 2400 pour la marge
const TOTAL_SALES = 2400
const CHECKPOINT = 400
let errors = 0
const timings = []

console.log('══════════════════════════════════════════════════')
console.log('  TEST DE CHARGE — simulation 19h de caisse')
console.log(`  ${TOTAL_SALES} ventes, 1-4 articles chacune`)
console.log('══════════════════════════════════════════════════')
console.log(`RAM initiale : ${mem()} MB  |  DB initiale : ${dbKb()} KB\n`)

for (let i = 0; i < TOTAL_SALES; i++) {
  const t0 = performance.now()
  const itemCount = rnd(1, 4)
  const used = new Set()
  const items = []
  for (let j = 0; j < itemCount; j++) {
    let pid
    do { pid = rnd(1, 100) } while (used.has(pid))
    used.add(pid)
    items.push({ pid, qty: rnd(1, 3), price: rnd(500, 8000) })
  }

  try {
    db.run('BEGIN')
    const total = items.reduce((s, it) => s + it.qty * it.price, 0)
    db.run(
      `INSERT INTO sales (ref,subtotal,discount,tax,total,paid,change_due,payment_method,status)
       VALUES (?,?,0,0,?,?,0,'cash','completed')`,
      [`V-${String(i + 1).padStart(6, '0')}`, total, total, total]
    )
    const saleId = lastId()
    for (const it of items) {
      db.run(
        `INSERT INTO sale_items (sale_id,product_id,name,qty,unit_price,cost_price,discount,tax_rate,line_total)
         VALUES (?,?,?,?,?,1000,0,0,?)`,
        [saleId, it.pid, `Produit Test ${it.pid}`, it.qty, it.price, it.qty * it.price]
      )
      db.run(`UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE id=?`, [it.qty, it.pid])
      db.run(
        `INSERT INTO stock_movements (product_id,type,qty,reason) VALUES (?,'sale',?,'Vente')`,
        [it.pid, it.qty]
      )
    }
    db.run('COMMIT')
  } catch (e) {
    try { db.run('ROLLBACK') } catch { /* ignore */ }
    errors++
  }

  timings.push(performance.now() - t0)

  if ((i + 1) % CHECKPOINT === 0) {
    const slice = timings.slice(-CHECKPOINT)
    const avg = Math.round(slice.reduce((s, t) => s + t, 0) / slice.length)
    const p99 = [...slice].sort((a, b) => a - b)[Math.floor(slice.length * 0.99)]
    console.log(
      `  Vente ${String(i + 1).padStart(4)} / ${TOTAL_SALES}` +
      `  | RAM : ${String(mem()).padStart(4)} MB` +
      `  | DB : ${String(dbKb()).padStart(5)} KB` +
      `  | moy : ${String(avg).padStart(3)} ms` +
      `  | p99 : ${String(Math.round(p99)).padStart(3)} ms` +
      `  | erreurs : ${errors}`
    )
  }
}

// ── Résultats ─────────────────────────────────────────────────────────────────
const sorted = [...timings].sort((a, b) => a - b)
const p50 = sorted[Math.floor(TOTAL_SALES * 0.50)]
const p95 = sorted[Math.floor(TOTAL_SALES * 0.95)]
const p99 = sorted[Math.floor(TOTAL_SALES * 0.99)]
const avgMs = timings.reduce((s, t) => s + t, 0) / timings.length
const finalDb = dbKb()
const finalMem = mem()

console.log('\n══════════════════════════════════════════════════')
console.log('  RÉSULTATS')
console.log('══════════════════════════════════════════════════')
console.log(`  Ventes simulées : ${TOTAL_SALES}  (erreurs : ${errors})`)
console.log(`  Latence  moy : ${avgMs.toFixed(1)} ms  |  p50 : ${p50.toFixed(1)} ms  |  p95 : ${p95.toFixed(1)} ms  |  p99 : ${p99.toFixed(1)} ms`)
console.log(`  Taille DB finale : ${finalDb} KB`)
console.log(`  RAM Node finale  : ${finalMem} MB`)
console.log()

// Verdict
const ok = errors === 0 && avgMs < 20 && p99 < 100
if (ok) {
  console.log('  ✅  PASS — performance acceptable pour 19h de caisse')
} else {
  if (errors > 0) console.log(`  ❌  ${errors} erreur(s) de transaction détectée(s)`)
  if (avgMs >= 20) console.log(`  ⚠️   Latence moyenne élevée (${avgMs.toFixed(1)} ms > 20 ms seuil)`)
  if (p99 >= 100) console.log(`  ⚠️   P99 élevé (${p99.toFixed(1)} ms > 100 ms seuil)`)
}
console.log('══════════════════════════════════════════════════')
db.close()
