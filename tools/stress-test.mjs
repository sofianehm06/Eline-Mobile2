#!/usr/bin/env node
/**
 * Stress test — simule un magasin réel sous pression 19h/24h.
 * 50 000 produits, 100 000 ventes, mesure RAM + latence + taille DB.
 * Usage : node tools/stress-test.mjs
 */
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmPath = join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')

if (!fs.existsSync(wasmPath)) {
  console.error('sql-wasm.wasm introuvable. Lancez depuis la racine du projet après npm install.')
  process.exit(1)
}

const initSqlJs = require('sql.js')
const SQL = await initSqlJs({ locateFile: () => wasmPath })

const db = new SQL.Database()

// ── Schéma complet avec indexes ─────────────────────────────────────────────
db.run(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = MEMORY;
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE,
    barcode TEXT,
    name TEXT NOT NULL,
    brand TEXT,
    category_id INTEGER,
    stock_qty REAL DEFAULT 0,
    cost_price REAL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    tracks_imei INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT NOT NULL UNIQUE,
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
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
  CREATE INDEX IF NOT EXISTS idx_sales_datetime ON sales(datetime);
  CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
  CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
  CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
  CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
`)

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const mem = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
const dbMb = () => (db.export().byteLength / 1024 / 1024).toFixed(1)
const lastId = () => db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]
const brands = ['Samsung', 'Xiaomi', 'Apple', 'Oppo', 'Realme', 'Tecno', 'Huawei', 'Nokia', 'Infinix', 'Honor']
const categories = Array.from({ length: 12 }, (_, i) => i + 1)

console.log('══════════════════════════════════════════════════════════════')
console.log('  STRESS TEST — simulation magasin réel 19h')
console.log('══════════════════════════════════════════════════════════════')

// ── Phase 1 : Insertion de 50 000 produits ──────────────────────────────────
const TOTAL_PRODUCTS = 50_000
console.log(`\n▶ Phase 1 : Insertion de ${TOTAL_PRODUCTS.toLocaleString()} produits...`)
let t0 = performance.now()

db.run('BEGIN')
for (let i = 1; i <= TOTAL_PRODUCTS; i++) {
  db.run(
    `INSERT INTO products (sku, barcode, name, brand, category_id, stock_qty, cost_price, sale_price, is_active)
     VALUES (?, ?, ?, ?, ?, 9999, ?, ?, 1)`,
    [
      `ACC-${String(i).padStart(5, '0')}`,
      `1${String(i).padStart(13, '0')}`,
      `Produit ${brands[i % brands.length]} ${i}`,
      brands[i % brands.length],
      categories[i % categories.length],
      500 + rnd(0, 5000),
      1000 + rnd(0, 10000)
    ]
  )
}
db.run('COMMIT')
console.log(`  ✓ ${TOTAL_PRODUCTS.toLocaleString()} produits insérés en ${((performance.now() - t0) / 1000).toFixed(1)}s`)
console.log(`  RAM : ${mem()} MB  |  DB : ${dbMb()} MB`)

// ── Phase 1b : Insertion de 200 clients ──────────────────────────────────
db.run('BEGIN')
for (let i = 1; i <= 200; i++) {
  db.run('INSERT INTO customers (name, phone) VALUES (?, ?)', [`Client ${i}`, `05${String(rnd(10000000, 99999999))}`])
}
db.run('COMMIT')

// ── Phase 2 : Recherches rapides (scan code-barres) ─────────────────────
console.log('\n▶ Phase 2 : Test recherche par code-barres (1000 scans)...')
const scanTimes = []
for (let i = 0; i < 1000; i++) {
  const code = `1${String(rnd(1, TOTAL_PRODUCTS)).padStart(13, '0')}`
  const st = performance.now()
  const result = db.exec(`SELECT * FROM products WHERE barcode=? AND is_active=1`, [code])
  scanTimes.push(performance.now() - st)
}
const avgScan = scanTimes.reduce((s, t) => s + t, 0) / scanTimes.length
const p99Scan = [...scanTimes].sort((a, b) => a - b)[Math.floor(scanTimes.length * 0.99)]
console.log(`  ✓ Scan barcode : moy ${avgScan.toFixed(2)}ms | p99 ${p99Scan.toFixed(2)}ms`)

// ── Phase 2b : Recherche par nom (LIKE) ──────────────────────────────────
console.log('\n▶ Phase 2b : Test recherche par nom (500 LIKE queries)...')
const likeTimes = []
for (let i = 0; i < 500; i++) {
  const term = `%${brands[rnd(0, brands.length - 1)]} ${rnd(1, 1000)}%`
  const st = performance.now()
  db.exec(`SELECT * FROM products WHERE name LIKE ? AND is_active=1 ORDER BY name LIMIT 50`, [term])
  likeTimes.push(performance.now() - st)
}
const avgLike = likeTimes.reduce((s, t) => s + t, 0) / likeTimes.length
const p99Like = [...likeTimes].sort((a, b) => a - b)[Math.floor(likeTimes.length * 0.99)]
console.log(`  ✓ LIKE search : moy ${avgLike.toFixed(2)}ms | p99 ${p99Like.toFixed(2)}ms`)

// ── Phase 3 : 100 000 ventes ─────────────────────────────────────────────
const TOTAL_SALES = 100_000
const CHECKPOINT = 10_000
console.log(`\n▶ Phase 3 : Simulation de ${TOTAL_SALES.toLocaleString()} ventes...`)
console.log(`  (= ~19h × 88 ventes/h en accéléré)\n`)

let errors = 0
const timings = []
const ramHistory = []

for (let i = 0; i < TOTAL_SALES; i++) {
  const st = performance.now()
  const itemCount = rnd(1, 5)
  const used = new Set()
  const items = []
  for (let j = 0; j < itemCount; j++) {
    let pid
    do { pid = rnd(1, TOTAL_PRODUCTS) } while (used.has(pid))
    used.add(pid)
    items.push({ pid, qty: rnd(1, 3), price: rnd(500, 15000) })
  }

  try {
    db.run('BEGIN')
    const total = items.reduce((s, it) => s + it.qty * it.price, 0)
    const ref = `V-${String(i + 1).padStart(7, '0')}`
    const cid = rnd(1, 200)
    db.run(
      `INSERT INTO sales (ref,customer_id,subtotal,discount,tax,total,paid,change_due,payment_method,status)
       VALUES (?,?,?,0,0,?,?,0,'cash','completed')`,
      [ref, cid, total, total, total]
    )
    const saleId = lastId()
    for (const it of items) {
      db.run(
        `INSERT INTO sale_items (sale_id,product_id,name,qty,unit_price,cost_price,discount,tax_rate,line_total)
         VALUES (?,?,?,?,?,1000,0,0,?)`,
        [saleId, it.pid, `Produit ${it.pid}`, it.qty, it.price, it.qty * it.price]
      )
      db.run(`UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE id=?`, [it.qty, it.pid])
      db.run(
        `INSERT INTO stock_movements (product_id,type,qty,reason) VALUES (?,'sale',?,'Vente')`,
        [it.pid, it.qty]
      )
    }
    db.run('COMMIT')
  } catch (e) {
    try { db.run('ROLLBACK') } catch {}
    errors++
  }

  timings.push(performance.now() - st)

  if ((i + 1) % CHECKPOINT === 0) {
    const slice = timings.slice(-CHECKPOINT)
    const avg = Math.round(slice.reduce((s, t) => s + t, 0) / slice.length * 10) / 10
    const p99 = [...slice].sort((a, b) => a - b)[Math.floor(slice.length * 0.99)]
    const curMem = mem()
    ramHistory.push(curMem)
    console.log(
      `  Vente ${String(i + 1).padStart(7).toLocaleString()} / ${TOTAL_SALES.toLocaleString()}` +
      `  | RAM : ${String(curMem).padStart(4)} MB` +
      `  | moy : ${String(avg).padStart(5)} ms` +
      `  | p99 : ${String(Math.round(p99 * 10) / 10).padStart(5)} ms` +
      `  | err : ${errors}`
    )
  }
}

// ── Phase 4 : Requêtes tableau de bord sous charge ──────────────────────
console.log('\n▶ Phase 4 : Requêtes tableau de bord (avec 100K ventes en base)...')

const dashQueries = [
  ["CA du jour", "SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS rev FROM sales WHERE status<>'refunded' AND date(datetime)=date('now','localtime')"],
  ["CA du mois", "SELECT COALESCE(SUM(total),0) AS rev FROM sales WHERE status<>'refunded' AND strftime('%Y-%m',datetime)=strftime('%Y-%m','now','localtime')"],
  ["Produits total", "SELECT COUNT(*) AS c FROM products WHERE is_active=1"],
  ["Valeur stock", "SELECT COALESCE(SUM(stock_qty*cost_price),0) AS v FROM products WHERE tracks_imei=0 AND is_active=1"],
  ["Top produits 30j", `SELECT name, SUM(qty) AS qty, SUM(line_total) AS revenue FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.status<>'refunded' AND date(s.datetime) >= date('now','localtime','-30 days') GROUP BY name ORDER BY revenue DESC LIMIT 6`],
  ["Crédit clients", `SELECT c.id, c.name, (SELECT COALESCE(SUM(s.total - s.paid),0) FROM sales s WHERE s.customer_id=c.id AND s.payment_method='credit' AND s.status<>'refunded') AS balance FROM customers c LIMIT 50`]
]

for (const [label, sql] of dashQueries) {
  const st = performance.now()
  db.exec(sql)
  console.log(`  ${label.padEnd(20)} : ${(performance.now() - st).toFixed(1)} ms`)
}

// ── Phase 5 : Export DB pour vérifier la taille ──────────────────────────
console.log('\n▶ Phase 5 : Export DB...')
const exportT = performance.now()
const exported = db.export()
const exportMs = performance.now() - exportT
console.log(`  ✓ Export : ${(exported.byteLength / 1024 / 1024).toFixed(1)} MB en ${exportMs.toFixed(0)} ms`)

// ── Résultats ─────────────────────────────────────────────────────────────
const sorted = [...timings].sort((a, b) => a - b)
const p50 = sorted[Math.floor(TOTAL_SALES * 0.50)]
const p95 = sorted[Math.floor(TOTAL_SALES * 0.95)]
const p99 = sorted[Math.floor(TOTAL_SALES * 0.99)]
const avgMs = timings.reduce((s, t) => s + t, 0) / timings.length
const finalMem = mem()
const ramMin = Math.min(...ramHistory)
const ramMax = Math.max(...ramHistory)
const ramDrift = ramMax - ramMin

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  RÉSULTATS FINAUX')
console.log('══════════════════════════════════════════════════════════════')
console.log(`  Produits          : ${TOTAL_PRODUCTS.toLocaleString()}`)
console.log(`  Ventes simulées   : ${TOTAL_SALES.toLocaleString()}  (erreurs : ${errors})`)
console.log(`  Latence vente     : moy ${avgMs.toFixed(1)} ms | p50 ${p50.toFixed(1)} ms | p95 ${p95.toFixed(1)} ms | p99 ${p99.toFixed(1)} ms`)
console.log(`  Scan barcode      : moy ${avgScan.toFixed(2)} ms | p99 ${p99Scan.toFixed(2)} ms`)
console.log(`  Recherche LIKE    : moy ${avgLike.toFixed(2)} ms | p99 ${p99Like.toFixed(2)} ms`)
console.log(`  Taille DB         : ${(exported.byteLength / 1024 / 1024).toFixed(1)} MB`)
console.log(`  RAM (min/max)     : ${ramMin} / ${ramMax} MB  (drift: ${ramDrift} MB)`)
console.log(`  RAM finale        : ${finalMem} MB`)
console.log()

const pass =
  errors === 0 &&
  avgMs < 30 &&
  p99 < 200 &&
  avgScan < 1 &&
  ramDrift < 100

if (pass) {
  console.log('  ✅  PASS — performance acceptable pour 19h de caisse')
} else {
  if (errors > 0) console.log(`  ❌  ${errors} erreur(s) de transaction`)
  if (avgMs >= 30) console.log(`  ⚠️   Latence moyenne trop haute (${avgMs.toFixed(1)} ms)`)
  if (p99 >= 200) console.log(`  ⚠️   P99 trop haut (${p99.toFixed(1)} ms)`)
  if (avgScan >= 1) console.log(`  ⚠️   Scan barcode lent (${avgScan.toFixed(2)} ms)`)
  if (ramDrift >= 100) console.log(`  ⚠️   Fuite mémoire possible (drift ${ramDrift} MB)`)
}
console.log('══════════════════════════════════════════════════════════════')
db.close()
