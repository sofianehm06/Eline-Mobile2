import { api as db } from './database'
import type {
  Category,
  CreditDebtor,
  CreditSummary,
  Customer,
  CustomerStatement,
  CustomerStatementEntry,
  DashboardStats,
  ImeiUnit,
  LedgerEntry,
  Loss,
  LossType,
  OpResult,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  ReportRow,
  Sale,
  SaleItem,
  Settings,
  StockMovement,
  Supplier,
  TradeIn
} from '@shared/types'

const now = () => "datetime('now','localtime')"

// Empêche toute valeur négative (prix, stock, seuil…) — sécurité côté données.
const nn = (v: unknown): number => Math.max(0, Number(v) || 0)

// ============================ SETTINGS ============================
export const settingsRepo = {
  getAll(): Settings {
    const rows = db.rows<{ key: string; value: string }>('SELECT key, value FROM settings')
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return {
      store_name: map.store_name ?? '',
      store_address: map.store_address ?? '',
      store_phone: map.store_phone ?? '',
      store_email: map.store_email ?? '',
      store_rc: map.store_rc ?? '',
      store_nif: map.store_nif ?? '',
      store_ai: map.store_ai ?? '',
      currency: map.currency ?? 'DA',
      currency_decimals: Number(map.currency_decimals ?? '2'),
      tax_rate: Number(map.tax_rate ?? '19'),
      receipt_header: map.receipt_header ?? '',
      receipt_footer: map.receipt_footer ?? '',
      receipt_width: (map.receipt_width as '58' | '80') ?? '80',
      printer_name: map.printer_name ?? '',
      label_printer_name: map.label_printer_name ?? '',
      print_dialog: Number(map.print_dialog ?? '0'),
      logo: map.logo ?? '',
      low_stock_alert: Number(map.low_stock_alert ?? '5'),
      pin_code: map.pin_code ?? '',
      auto_backup: Number(map.auto_backup ?? '0'),
      auto_backup_dir: map.auto_backup_dir ?? '',
      license_key: map.license_key ?? ''
    }
  },
  update(patch: Partial<Record<keyof Settings, unknown>>): OpResult {
    const stmt = 'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
    db.transaction(() => {
      for (const [k, v] of Object.entries(patch)) {
        db.run(stmt, [k, v == null ? '' : String(v)])
      }
    })
    return { ok: true }
  }
}

// ============================ CATEGORIES ============================
export const categoriesRepo = {
  list(): Category[] {
    return db.rows<Category>(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS product_count
       FROM categories c ORDER BY c.name`
    )
  },
  create(c: { name: string; color?: string }): OpResult {
    const { id } = db.run('INSERT INTO categories (name,color) VALUES (?,?)', [
      c.name.trim(),
      c.color ?? '#3563ff'
    ])
    return { ok: true, id }
  },
  update(c: { id: number; name: string; color?: string }): OpResult {
    db.run('UPDATE categories SET name=?, color=? WHERE id=?', [c.name.trim(), c.color ?? '#3563ff', c.id])
    return { ok: true }
  },
  remove(id: number): OpResult {
    db.run('DELETE FROM categories WHERE id=?', [id])
    return { ok: true }
  }
}

// ============================ PRODUCTS ============================
const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, sup.name AS supplier_name,
    CASE WHEN p.tracks_imei=1
      THEN (SELECT COUNT(*) FROM imei_units u WHERE u.product_id=p.id AND u.status='in_stock')
      ELSE p.stock_qty END AS available_stock
  FROM products p
  LEFT JOIN categories c ON c.id=p.category_id
  LEFT JOIN suppliers sup ON sup.id=p.supplier_id`

export const productsRepo = {
  list(opts: { search?: string; category_id?: number | null; supplier_id?: number | null; type?: string; active?: boolean } = {}): Product[] {
    const where: string[] = []
    const params: any[] = []
    if (opts.active !== false) where.push('p.is_active=1')
    if (opts.search) {
      where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ? OR p.model LIKE ?)')
      const s = `%${opts.search}%`
      params.push(s, s, s, s, s)
    }
    if (opts.category_id) {
      where.push('p.category_id=?')
      params.push(opts.category_id)
    }
    if (opts.supplier_id) {
      where.push('p.supplier_id=?')
      params.push(opts.supplier_id)
    }
    if (opts.type) {
      where.push('p.type=?')
      params.push(opts.type)
    }
    const sql = `${PRODUCT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.name`
    return db.rows<Product>(sql, params)
  },
  get(id: number): Product | undefined {
    return db.row<Product>(`${PRODUCT_SELECT} WHERE p.id=?`, [id])
  },
  scan(code: string): { product?: Product; imei_unit?: ImeiUnit } | null {
    const c = code.trim()
    if (!c) return null
    let product = db.row<Product>(`${PRODUCT_SELECT} WHERE p.barcode=? AND p.is_active=1`, [c])
    if (product) return { product }
    const unit = db.row<ImeiUnit>(
      `SELECT * FROM imei_units WHERE imei=? AND status='in_stock'`,
      [c]
    )
    if (unit) {
      product = productsRepo.get(unit.product_id)
      if (product) return { product, imei_unit: unit }
    }
    product = db.row<Product>(`${PRODUCT_SELECT} WHERE p.sku=? AND p.is_active=1`, [c])
    if (product) return { product }
    return null
  },
  create(p: Partial<Product>): OpResult {
    // Si pas de code-barres fourni, réutiliser celui d'un produit existant portant le même nom
    let barcode = p.barcode || null
    if (!barcode && p.name) {
      const existing = db.row<{ barcode: string | null }>('SELECT barcode FROM products WHERE name=? COLLATE NOCASE AND barcode IS NOT NULL LIMIT 1', [p.name])
      if (existing?.barcode) barcode = existing.barcode
    }
    const { id } = db.run(
      `INSERT INTO products
       (sku,barcode,name,brand,model,category_id,supplier_id,type,tracks_imei,cost_price,sale_price,sale_price2,sale_price3,tax_rate,stock_qty,min_stock,warranty_months,image,notes,is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [
        p.sku || nextSku(p.type === 'phone' ? 'TEL' : 'ACC'),
        barcode,
        p.name,
        p.brand || null,
        p.model || null,
        p.category_id || null,
        p.supplier_id || null,
        p.type || 'accessory',
        p.tracks_imei ? 1 : 0,
        nn(p.cost_price),
        nn(p.sale_price),
        nn(p.sale_price2),
        nn(p.sale_price3),
        nn(p.tax_rate),
        p.tracks_imei ? 0 : nn(p.stock_qty),
        nn(p.min_stock),
        nn(p.warranty_months),
        p.image || null,
        p.notes || null
      ]
    )
    if (!barcode) {
      db.run('UPDATE products SET barcode=? WHERE id=?', [generateBarcode(id), id])
    }
    if (!p.tracks_imei && (p.stock_qty ?? 0) > 0) {
      db.run(
        `INSERT INTO stock_movements (product_id,type,qty,reason,unit_cost) VALUES (?, 'in', ?, 'Création produit', ?)`,
        [id, p.stock_qty, p.cost_price ?? 0]
      )
    }
    return { ok: true, id }
  },
  suggest(query: string): { name: string; barcode: string | null; brand: string | null; category_id: number | null; type: string }[] {
    if (!query || query.trim().length < 2) return []
    return db.rows(
      `SELECT DISTINCT name, barcode, brand, category_id, type FROM products WHERE name LIKE ? AND is_active=1 ORDER BY name LIMIT 10`,
      [`%${query.trim()}%`]
    )
  },
  nextBarcode(): string {
    const maxId = db.row<{ m: number }>('SELECT COALESCE(MAX(id),0) AS m FROM products')?.m ?? 0
    return generateBarcode(maxId + 1)
  },
  update(p: Partial<Product> & { id: number }): OpResult {
    db.run(
      `UPDATE products SET
        sku=?,barcode=?,name=?,brand=?,model=?,category_id=?,supplier_id=?,type=?,tracks_imei=?,
        cost_price=?,sale_price=?,sale_price2=?,sale_price3=?,tax_rate=?,min_stock=?,warranty_months=?,image=?,notes=?,
        updated_at=${now()}
       WHERE id=?`,
      [
        p.sku,
        p.barcode || null,
        p.name,
        p.brand || null,
        p.model || null,
        p.category_id || null,
        p.supplier_id || null,
        p.type || 'accessory',
        p.tracks_imei ? 1 : 0,
        nn(p.cost_price),
        nn(p.sale_price),
        nn(p.sale_price2),
        nn(p.sale_price3),
        nn(p.tax_rate),
        nn(p.min_stock),
        nn(p.warranty_months),
        p.image || null,
        p.notes || null,
        p.id
      ]
    )
    return { ok: true }
  },
  remove(id: number): OpResult {
    const refs = db.row<{ c: number }>('SELECT COUNT(*) AS c FROM sale_items WHERE product_id=?', [id])?.c ?? 0
    if (refs > 0) {
      db.run('UPDATE products SET is_active=0 WHERE id=?', [id])
      return { ok: true, error: 'archived' }
    }
    db.run('DELETE FROM products WHERE id=?', [id])
    return { ok: true }
  },
  // Réception de stock (accessoires) — entrée quantité
  receiveStock(d: { product_id: number; qty: number; unit_cost?: number; supplier_id?: number | null; reason?: string }): OpResult {
    const qty = nn(d.qty)
    db.transaction(() => {
      db.run('UPDATE products SET stock_qty = stock_qty + ?, updated_at=' + now() + ' WHERE id=?', [qty, d.product_id])
      db.run(
        `INSERT INTO stock_movements (product_id,type,qty,reason,unit_cost) VALUES (?, 'in', ?, ?, ?)`,
        [d.product_id, qty, d.reason || 'Réception', nn(d.unit_cost)]
      )
    })
    return { ok: true }
  },
  // Ajustement (correction d'inventaire) — fixe la quantité à une valeur
  adjustStock(d: { product_id: number; new_qty: number; reason?: string }): OpResult {
    const newQty = nn(d.new_qty)
    const cur = db.row<{ stock_qty: number; cost_price: number }>('SELECT stock_qty, cost_price FROM products WHERE id=?', [d.product_id])
    const diff = newQty - (cur?.stock_qty ?? 0)
    db.transaction(() => {
      db.run('UPDATE products SET stock_qty=?, updated_at=' + now() + ' WHERE id=?', [newQty, d.product_id])
      db.run(
        `INSERT INTO stock_movements (product_id,type,qty,reason,unit_cost) VALUES (?, 'adjust', ?, ?, ?)`,
        [d.product_id, diff, d.reason || 'Ajustement inventaire', cur?.cost_price ?? 0]
      )
    })
    return { ok: true }
  },
  lowStock(threshold?: number): Product[] {
    return db
      .rows<Product>(`${PRODUCT_SELECT} WHERE p.is_active=1`)
      .filter((p) => {
        const limit = p.min_stock > 0 ? p.min_stock : threshold ?? 5
        return (p.available_stock ?? 0) <= limit
      })
      .sort((a, b) => (a.available_stock ?? 0) - (b.available_stock ?? 0))
  }
}

function nextSku(prefix: string): string {
  const n = db.row<{ c: number }>('SELECT COUNT(*) AS c FROM products')?.c ?? 0
  return `${prefix}-${String(n + 1).padStart(4, '0')}`
}

// Code-barres : 14 chiffres, commence par 1, puis des zéros, puis le numéro qui s'incrémente.
// ex: produit n°1 -> 10000000000001, n°2 -> 10000000000002, ...
function generateBarcode(id: number): string {
  return '1' + String(id).padStart(13, '0')
}

// ============================ IMEI UNITS ============================
export const imeiRepo = {
  list(opts: { product_id?: number; status?: string; search?: string } = {}): ImeiUnit[] {
    const where: string[] = []
    const params: any[] = []
    if (opts.product_id) {
      where.push('u.product_id=?')
      params.push(opts.product_id)
    }
    if (opts.status) {
      where.push('u.status=?')
      params.push(opts.status)
    }
    if (opts.search) {
      where.push('(u.imei LIKE ? OR u.serial LIKE ? OR p.name LIKE ?)')
      const s = `%${opts.search}%`
      params.push(s, s, s)
    }
    return db.rows<ImeiUnit>(
      `SELECT u.*, p.name AS product_name, p.warranty_months AS product_warranty, s.name AS supplier_name,
              sl.ref AS sale_ref, sl.datetime AS sale_datetime, cu.name AS sale_customer
       FROM imei_units u
       LEFT JOIN products p ON p.id=u.product_id
       LEFT JOIN suppliers s ON s.id=u.supplier_id
       LEFT JOIN sales sl ON sl.id=u.sale_id
       LEFT JOIN customers cu ON cu.id=sl.customer_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY u.created_at DESC LIMIT 1000`,
      params
    )
  },
  add(d: {
    product_id: number
    imei: string
    serial?: string
    cost_price?: number
    sale_price?: number
    supplier_id?: number | null
    warranty_months?: number
    condition?: string
    reason?: string
    notes?: string
  }): OpResult {
    const exists = db.row<{ c: number }>('SELECT COUNT(*) AS c FROM imei_units WHERE imei=?', [d.imei.trim()])?.c ?? 0
    if (exists > 0) return { ok: false, error: `IMEI ${d.imei} déjà enregistré` }
    let id = 0
    db.transaction(() => {
      const r = db.run(
        `INSERT INTO imei_units (product_id,imei,serial,status,cost_price,sale_price,supplier_id,purchase_date,warranty_months,condition,notes)
         VALUES (?,?,?, 'in_stock', ?,?,?, ${now()}, ?, ?, ?)`,
        [
          d.product_id,
          d.imei.trim(),
          d.serial || null,
          d.cost_price ?? 0,
          d.sale_price ?? null,
          d.supplier_id || null,
          d.warranty_months ?? 0,
          d.condition || 'Neuf',
          d.notes || null
        ]
      )
      id = r.id
      db.run(
        `INSERT INTO stock_movements (product_id,imei_unit_id,type,qty,reason,unit_cost) VALUES (?,?, 'in', 1, ?, ?)`,
        [d.product_id, id, d.reason || 'Réception IMEI', d.cost_price ?? 0]
      )
    })
    return { ok: true, id }
  },
  addBulk(d: {
    product_id: number
    imeis: string[]
    cost_price?: number
    sale_price?: number
    supplier_id?: number | null
    warranty_months?: number
  }): OpResult {
    let added = 0
    const errors: string[] = []
    for (const imei of d.imeis.map((s) => s.trim()).filter(Boolean)) {
      const r = imeiRepo.add({ ...d, imei })
      if (r.ok) added++
      else errors.push(r.error || imei)
    }
    return { ok: added > 0, id: added, error: errors.length ? errors.join(', ') : undefined }
  },
  update(d: Partial<ImeiUnit> & { id: number }): OpResult {
    db.run(
      `UPDATE imei_units SET serial=?, cost_price=?, sale_price=?, supplier_id=?, warranty_months=?, notes=?, status=? WHERE id=?`,
      [
        d.serial || null,
        d.cost_price ?? 0,
        d.sale_price ?? null,
        d.supplier_id || null,
        d.warranty_months ?? 0,
        d.notes || null,
        d.status || 'in_stock',
        d.id
      ]
    )
    return { ok: true }
  },
  remove(id: number): OpResult {
    const u = db.row<{ status: string }>('SELECT status FROM imei_units WHERE id=?', [id])
    if (u && u.status === 'sold') return { ok: false, error: 'Impossible de supprimer un IMEI déjà vendu' }
    db.run('DELETE FROM imei_units WHERE id=?', [id])
    return { ok: true }
  },
  findByImei(imei: string): ImeiUnit | undefined {
    return db.row<ImeiUnit>(
      `SELECT u.*, p.name AS product_name, sl.ref AS sale_ref
       FROM imei_units u LEFT JOIN products p ON p.id=u.product_id
       LEFT JOIN sales sl ON sl.id=u.sale_id WHERE u.imei=?`,
      [imei.trim()]
    )
  }
}

// ============================ SUPPLIERS ============================
export const suppliersRepo = {
  list(): Supplier[] {
    return db.rows<Supplier>('SELECT * FROM suppliers ORDER BY name')
  },
  create(s: Partial<Supplier>): OpResult {
    const { id } = db.run('INSERT INTO suppliers (name,phone,address,notes) VALUES (?,?,?,?)', [
      s.name,
      s.phone || null,
      s.address || null,
      s.notes || null
    ])
    return { ok: true, id }
  },
  update(s: Partial<Supplier> & { id: number }): OpResult {
    db.run('UPDATE suppliers SET name=?,phone=?,address=?,notes=? WHERE id=?', [
      s.name,
      s.phone || null,
      s.address || null,
      s.notes || null,
      s.id
    ])
    return { ok: true }
  },
  remove(id: number): OpResult {
    db.run('DELETE FROM suppliers WHERE id=?', [id])
    return { ok: true }
  }
}

// ============================ CUSTOMERS ============================
export const customersRepo = {
  list(search?: string): Customer[] {
    const params: any[] = []
    let where = ''
    if (search) {
      where = 'WHERE c.name LIKE ? OR c.phone LIKE ?'
      params.push(`%${search}%`, `%${search}%`)
    }
    return db.rows<Customer>(
      `SELECT c.*,
        (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.customer_id=c.id AND s.status<>'refunded') AS total_spent,
        (SELECT COUNT(*) FROM sales s WHERE s.customer_id=c.id AND s.status<>'refunded') AS purchases_count
       FROM customers c ${where} ORDER BY c.name`,
      params
    )
  },
  create(c: Partial<Customer>): OpResult {
    const name = (c.name || '').trim()
    if (!name) return { ok: false, error: 'Le nom est requis' }
    const dup = db.row<{ c: number }>('SELECT COUNT(*) AS c FROM customers WHERE name=? COLLATE NOCASE', [name])?.c ?? 0
    if (dup > 0) return { ok: false, error: `Le client « ${name} » existe déjà` }
    const { id } = db.run('INSERT INTO customers (name,phone,email,address,notes) VALUES (?,?,?,?,?)', [
      name,
      c.phone || null,
      c.email || null,
      c.address || null,
      c.notes || null
    ])
    return { ok: true, id }
  },
  update(c: Partial<Customer> & { id: number }): OpResult {
    const name = (c.name || '').trim()
    if (!name) return { ok: false, error: 'Le nom est requis' }
    const dup = db.row<{ c: number }>('SELECT COUNT(*) AS c FROM customers WHERE name=? COLLATE NOCASE AND id<>?', [name, c.id])?.c ?? 0
    if (dup > 0) return { ok: false, error: `Un autre client porte déjà le nom « ${name} »` }
    db.run('UPDATE customers SET name=?,phone=?,email=?,address=?,notes=? WHERE id=?', [
      name,
      c.phone || null,
      c.email || null,
      c.address || null,
      c.notes || null,
      c.id
    ])
    return { ok: true }
  },
  remove(id: number): OpResult {
    db.run('DELETE FROM customers WHERE id=?', [id])
    return { ok: true }
  }
}

// ============================ SALES ============================
interface SaleInputItem {
  product_id: number
  imei_unit_id: number | null
  name: string
  qty: number
  unit_price: number
  cost_price: number
  discount: number
  tax_rate: number
}
interface SaleInput {
  customer_id?: number | null
  payment_method?: string
  paid: number
  discount?: number // remise globale (montant)
  note?: string
  items: SaleInputItem[]
}

function nextSaleRef(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const c =
    db.row<{ c: number }>(
      "SELECT COUNT(*) AS c FROM sales WHERE date(datetime)=date('now','localtime')"
    )?.c ?? 0
  return `V-${ymd}-${String(c + 1).padStart(4, '0')}`
}

export const salesRepo = {
  create(input: SaleInput): OpResult {
    if (!input.items?.length) return { ok: false, error: 'Panier vide' }
    if (input.payment_method === 'credit' && !input.customer_id) {
      return { ok: false, error: 'Sélectionnez un client pour une vente à crédit' }
    }

    // Validation du stock
    for (const it of input.items) {
      if (it.imei_unit_id) {
        const u = db.row<{ status: string }>('SELECT status FROM imei_units WHERE id=?', [it.imei_unit_id])
        if (!u || u.status !== 'in_stock') return { ok: false, error: `IMEI indisponible pour ${it.name}` }
      } else {
        const p = db.row<{ stock_qty: number; tracks_imei: number }>(
          'SELECT stock_qty, tracks_imei FROM products WHERE id=?',
          [it.product_id]
        )
        if (!p) return { ok: false, error: `Produit introuvable: ${it.name}` }
        if (!p.tracks_imei && p.stock_qty < it.qty) {
          return { ok: false, error: `Stock insuffisant pour ${it.name} (dispo: ${p.stock_qty})` }
        }
      }
    }

    const gross = input.items.reduce((s, it) => s + it.qty * it.unit_price, 0)
    const lineDiscounts = input.items.reduce((s, it) => s + (it.discount || 0), 0)
    const globalDiscount = input.discount || 0
    const subtotal = gross
    const totalDiscount = lineDiscounts + globalDiscount
    const total = Math.max(0, subtotal - totalDiscount)
    // TVA incluse (prix TTC)
    const taxBeforeGlobal = input.items.reduce((s, it) => {
      const lt = it.qty * it.unit_price - (it.discount || 0)
      const r = it.tax_rate || 0
      return s + (lt * r) / (100 + r)
    }, 0)
    const factor = gross - lineDiscounts > 0 ? total / (gross - lineDiscounts) : 1
    const tax = taxBeforeGlobal * factor
    // Crédit : "paid" = acompte versé (0..total), le reste devient une dette.
    const paid =
      input.payment_method === 'cash'
        ? input.paid
        : input.payment_method === 'credit'
          ? Math.min(Math.max(0, input.paid || 0), total)
          : total
    const change = input.payment_method === 'cash' ? Math.max(0, paid - total) : 0

    let saleId = 0
    let ref = ''
    db.transaction(() => {
      ref = nextSaleRef()
      const r = db.run(
        `INSERT INTO sales (ref,customer_id,subtotal,discount,tax,total,paid,change_due,payment_method,status,note)
         VALUES (?,?,?,?,?,?,?,?,?, 'completed', ?)`,
        [
          ref,
          input.customer_id || null,
          round2(subtotal),
          round2(totalDiscount),
          round2(tax),
          round2(total),
          round2(paid),
          round2(change),
          input.payment_method || 'cash',
          input.note || null
        ]
      )
      saleId = r.id

      for (const it of input.items) {
        const lineTotal = it.qty * it.unit_price - (it.discount || 0)
        db.run(
          `INSERT INTO sale_items (sale_id,product_id,imei_unit_id,name,qty,unit_price,cost_price,discount,tax_rate,line_total)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [
            saleId,
            it.product_id,
            it.imei_unit_id,
            it.name,
            it.qty,
            it.unit_price,
            it.cost_price,
            it.discount || 0,
            it.tax_rate || 0,
            round2(lineTotal)
          ]
        )
        if (it.imei_unit_id) {
          db.run(
            `UPDATE imei_units SET status='sold', sale_id=?, sale_price=? WHERE id=?`,
            [saleId, it.unit_price, it.imei_unit_id]
          )
          db.run(
            `INSERT INTO stock_movements (product_id,imei_unit_id,type,qty,reason,ref,unit_cost) VALUES (?,?, 'sale', 1, 'Vente', ?, ?)`,
            [it.product_id, it.imei_unit_id, ref, it.cost_price]
          )
        } else {
          db.run('UPDATE products SET stock_qty = stock_qty - ? WHERE id=?', [it.qty, it.product_id])
          db.run(
            `INSERT INTO stock_movements (product_id,type,qty,reason,ref,unit_cost) VALUES (?, 'sale', ?, 'Vente', ?, ?)`,
            [it.product_id, it.qty, ref, it.cost_price]
          )
        }
      }
    })
    return { ok: true, id: saleId, ref }
  },

  list(opts: { from?: string; to?: string; search?: string; limit?: number } = {}): Sale[] {
    const where: string[] = []
    const params: any[] = []
    if (opts.from) {
      where.push("date(s.datetime) >= date(?)")
      params.push(opts.from)
    }
    if (opts.to) {
      where.push("date(s.datetime) <= date(?)")
      params.push(opts.to)
    }
    if (opts.search) {
      where.push('(s.ref LIKE ? OR cu.name LIKE ?)')
      params.push(`%${opts.search}%`, `%${opts.search}%`)
    }
    return db.rows<Sale>(
      `SELECT s.*, cu.name AS customer_name
       FROM sales s LEFT JOIN customers cu ON cu.id=s.customer_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.datetime DESC LIMIT ?`,
      [...params, opts.limit ?? 200]
    )
  },

  get(id: number): Sale | undefined {
    const sale = db.row<Sale>(
      `SELECT s.*, cu.name AS customer_name FROM sales s LEFT JOIN customers cu ON cu.id=s.customer_id WHERE s.id=?`,
      [id]
    )
    if (!sale) return undefined
    sale.items = db.rows<SaleItem>(
      `SELECT si.*, u.imei FROM sale_items si LEFT JOIN imei_units u ON u.id=si.imei_unit_id WHERE si.sale_id=? ORDER BY si.id`,
      [id]
    )
    return sale
  },

  // Remboursement total OU partiel.
  // items omis  -> rembourse tout le reste de la vente.
  // items fourni -> [{ sale_item_id, qty }] rembourse la quantité indiquée par ligne.
  refund(id: number, items?: { sale_item_id: number; qty: number }[]): OpResult {
    const sale = salesRepo.get(id)
    if (!sale) return { ok: false, error: 'Vente introuvable' }
    if (sale.status === 'refunded') return { ok: false, error: 'Vente déjà remboursée' }

    const lines = sale.items || []
    // Remise globale = remise totale - somme des remises de ligne (à préserver)
    const globalDiscount = Math.max(0, (sale.discount || 0) - lines.reduce((s, it) => s + (it.discount || 0), 0))

    // Plan de remboursement : map sale_item_id -> qty à rembourser
    const plan = new Map<number, number>()
    if (items && items.length) {
      for (const r of items) {
        const it = lines.find((l) => l.id === r.sale_item_id)
        if (!it) continue
        const q = Math.min(Math.max(0, r.qty), it.qty)
        if (q > 0) plan.set(it.id, q)
      }
    } else {
      for (const it of lines) if (it.qty > 0) plan.set(it.id, it.qty)
    }
    if (!plan.size) return { ok: false, error: 'Aucun article à rembourser' }

    let refundedAmount = 0
    db.transaction(() => {
      for (const it of lines) {
        const q = plan.get(it.id)
        if (!q) continue
        const perUnit = it.qty > 0 ? it.line_total / it.qty : it.unit_price
        const lineRefund = round2(perUnit * q)
        refundedAmount += lineRefund

        // Remise en stock
        if (it.imei_unit_id) {
          db.run("UPDATE imei_units SET status='in_stock', sale_id=NULL WHERE id=?", [it.imei_unit_id])
          db.run(
            `INSERT INTO stock_movements (product_id,imei_unit_id,type,qty,reason,ref,unit_cost) VALUES (?,?, 'return', 1, 'Remboursement', ?, ?)`,
            [it.product_id, it.imei_unit_id, sale.ref, it.cost_price]
          )
        } else if (it.product_id) {
          db.run('UPDATE products SET stock_qty = stock_qty + ? WHERE id=?', [q, it.product_id])
          db.run(
            `INSERT INTO stock_movements (product_id,type,qty,reason,ref,unit_cost) VALUES (?, 'return', ?, 'Remboursement', ?, ?)`,
            [it.product_id, q, sale.ref, it.cost_price]
          )
        }

        // Réduit la ligne (la quantité restante = vendue nette) + mémorise la qté remboursée
        const newQty = it.qty - q
        const newDiscount = it.qty > 0 ? round2((it.discount || 0) * (newQty / it.qty)) : 0
        const newLineTotal = round2(it.line_total - lineRefund)
        db.run('UPDATE sale_items SET qty=?, line_total=?, discount=?, refunded_qty=COALESCE(refunded_qty,0)+? WHERE id=?', [
          newQty,
          newLineTotal,
          newDiscount,
          q,
          it.id
        ])
      }

      // Recalcul de l'en-tête de la vente
      const remaining = db.rows<{ qty: number; unit_price: number; line_total: number }>(
        'SELECT qty, unit_price, line_total FROM sale_items WHERE sale_id=?',
        [id]
      )
      const subtotal = round2(remaining.reduce((s, r) => s + r.qty * r.unit_price, 0))
      const itemsTotal = round2(remaining.reduce((s, r) => s + r.line_total, 0))
      const total = Math.max(0, round2(itemsTotal - globalDiscount))
      const tax = sale.total > 0 ? round2((sale.tax || 0) * (total / sale.total)) : 0
      const totalQty = remaining.reduce((s, r) => s + r.qty, 0)
      const status = totalQty <= 0 ? 'refunded' : 'partial'

      db.run('UPDATE sales SET subtotal=?, discount=?, tax=?, total=?, status=? WHERE id=?', [
        subtotal,
        round2(Math.max(0, subtotal - total)),
        tax,
        total,
        status,
        id
      ])
    })
    return { ok: true, id }
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ============================ STOCK MOVEMENTS ============================
export const stockRepo = {
  movements(opts: { product_id?: number; limit?: number } = {}): StockMovement[] {
    const where: string[] = []
    const params: any[] = []
    if (opts.product_id) {
      where.push('m.product_id=?')
      params.push(opts.product_id)
    }
    return db.rows<StockMovement>(
      `SELECT m.*, p.name AS product_name FROM stock_movements m
       LEFT JOIN products p ON p.id=m.product_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY m.datetime DESC, m.id DESC LIMIT ?`,
      [...params, opts.limit ?? 300]
    )
  }
}

// ============================ DASHBOARD ============================
export const dashboardRepo = {
  stats(): DashboardStats {
    const today = db.row<{ c: number; rev: number }>(
      `SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS rev FROM sales
       WHERE status<>'refunded' AND date(datetime)=date('now','localtime')`
    )
    const todayProfit =
      db.row<{ p: number }>(
        `SELECT COALESCE(SUM(si.line_total - si.cost_price*si.qty),0) AS p
         FROM sale_items si JOIN sales s ON s.id=si.sale_id
         WHERE s.status<>'refunded' AND date(s.datetime)=date('now','localtime')`
      )?.p ?? 0
    const month = db.row<{ rev: number }>(
      `SELECT COALESCE(SUM(total),0) AS rev FROM sales
       WHERE status<>'refunded' AND strftime('%Y-%m',datetime)=strftime('%Y-%m','now','localtime')`
    )
    const monthProfit =
      db.row<{ p: number }>(
        `SELECT COALESCE(SUM(si.line_total - si.cost_price*si.qty),0) AS p
         FROM sale_items si JOIN sales s ON s.id=si.sale_id
         WHERE s.status<>'refunded' AND strftime('%Y-%m',s.datetime)=strftime('%Y-%m','now','localtime')`
      )?.p ?? 0
    const totalProducts = db.row<{ c: number }>('SELECT COUNT(*) AS c FROM products WHERE is_active=1')?.c ?? 0
    const stockValue =
      (db.row<{ v: number }>('SELECT COALESCE(SUM(stock_qty*cost_price),0) AS v FROM products WHERE tracks_imei=0 AND is_active=1')?.v ?? 0) +
      (db.row<{ v: number }>("SELECT COALESCE(SUM(cost_price),0) AS v FROM imei_units WHERE status='in_stock'")?.v ?? 0)
    const imeiInStock = db.row<{ c: number }>("SELECT COUNT(*) AS c FROM imei_units WHERE status='in_stock'")?.c ?? 0

    const last14 = db.rows<{ date: string; revenue: number; count: number }>(
      `SELECT date(datetime) AS date, COALESCE(SUM(total),0) AS revenue, COUNT(*) AS count
       FROM sales WHERE status<>'refunded' AND date(datetime) >= date('now','localtime','-13 days')
       GROUP BY date(datetime) ORDER BY date(datetime)`
    )
    const topProducts = db.rows<{ name: string; qty: number; revenue: number }>(
      `SELECT si.name AS name, SUM(si.qty) AS qty, SUM(si.line_total) AS revenue
       FROM sale_items si JOIN sales s ON s.id=si.sale_id
       WHERE s.status<>'refunded' AND date(s.datetime) >= date('now','localtime','-30 days')
       GROUP BY si.name ORDER BY revenue DESC LIMIT 6`
    )
    const recent = salesRepo.list({ limit: 6 })
    const low = productsRepo.lowStock()

    const days: { date: string; revenue: number; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const found = last14.find((x) => x.date === key)
      days.push({ date: key, revenue: found?.revenue ?? 0, count: found?.count ?? 0 })
    }

    return {
      today_sales_count: today?.c ?? 0,
      today_revenue: today?.rev ?? 0,
      today_profit: todayProfit,
      month_revenue: month?.rev ?? 0,
      month_profit: monthProfit,
      total_products: totalProducts,
      low_stock_count: low.length,
      stock_value: stockValue,
      imei_in_stock: imeiInStock,
      sales_last_14_days: days,
      top_products: topProducts,
      recent_sales: recent,
      low_stock_products: low.slice(0, 8)
    }
  }
}

// ============================ REPORTS ============================
export const reportsRepo = {
  byPeriod(opts: { from: string; to: string; group: 'day' | 'month' }): ReportRow[] {
    const fmt = opts.group === 'month' ? '%Y-%m' : '%Y-%m-%d'
    return db.rows<ReportRow>(
      `SELECT strftime('${fmt}', s.datetime) AS period,
        COUNT(DISTINCT s.id) AS count,
        COALESCE(SUM(si.line_total),0) AS revenue,
        COALESCE(SUM(si.cost_price*si.qty),0) AS cost,
        COALESCE(SUM(si.line_total - si.cost_price*si.qty),0) AS profit
       FROM sales s JOIN sale_items si ON si.sale_id=s.id
       WHERE s.status<>'refunded' AND date(s.datetime) BETWEEN date(?) AND date(?)
       GROUP BY period ORDER BY period`,
      [opts.from, opts.to]
    )
  },
  topProducts(opts: { from: string; to: string; limit?: number }): { name: string; qty: number; revenue: number; profit: number }[] {
    return db.rows(
      `SELECT si.name AS name, SUM(si.qty) AS qty, SUM(si.line_total) AS revenue,
        SUM(si.line_total - si.cost_price*si.qty) AS profit
       FROM sale_items si JOIN sales s ON s.id=si.sale_id
       WHERE s.status<>'refunded' AND date(s.datetime) BETWEEN date(?) AND date(?)
       GROUP BY si.name ORDER BY revenue DESC LIMIT ?`,
      [opts.from, opts.to, opts.limit ?? 20]
    )
  },
  summary(opts: { from: string; to: string }): { revenue: number; cost: number; profit: number; count: number } {
    return (
      db.row(
        `SELECT COUNT(DISTINCT s.id) AS count,
          COALESCE(SUM(si.line_total),0) AS revenue,
          COALESCE(SUM(si.cost_price*si.qty),0) AS cost,
          COALESCE(SUM(si.line_total - si.cost_price*si.qty),0) AS profit
         FROM sales s JOIN sale_items si ON si.sale_id=s.id
         WHERE s.status<>'refunded' AND date(s.datetime) BETWEEN date(?) AND date(?)`,
        [opts.from, opts.to]
      ) ?? { revenue: 0, cost: 0, profit: 0, count: 0 }
    )
  }
}

// ============================ CRÉDIT / ARDOISE ============================
// Solde dû d'un client = (somme des ventes à crédit - acomptes versés) - remboursements ultérieurs.
const DEBTOR_SELECT = `
  SELECT c.id, c.name, c.phone,
    COALESCE(c.opening_balance,0)
    + (SELECT COALESCE(SUM(s.total - s.paid),0) FROM sales s
       WHERE s.customer_id=c.id AND s.payment_method='credit' AND s.status<>'refunded')
    - (SELECT COALESCE(SUM(p.amount),0) FROM customer_payments p WHERE p.customer_id=c.id) AS balance,
    (SELECT MAX(d) FROM (
       SELECT MAX(s.datetime) AS d FROM sales s WHERE s.customer_id=c.id AND s.payment_method='credit'
       UNION ALL
       SELECT MAX(p.datetime) AS d FROM customer_payments p WHERE p.customer_id=c.id
     )) AS last_movement
  FROM customers c`

export const creditRepo = {
  debtors(): CreditDebtor[] {
    return db
      .rows<CreditDebtor>(`${DEBTOR_SELECT}`)
      .filter((d) => (d.balance ?? 0) > 0.009)
      .sort((a, b) => b.balance - a.balance)
  },
  summary(): CreditSummary {
    const list = creditRepo.debtors()
    return {
      total_due: list.reduce((s, d) => s + d.balance, 0),
      debtors_count: list.length
    }
  },
  balance(customerId: number): number {
    return db.row<CreditDebtor>(`${DEBTOR_SELECT} WHERE c.id=?`, [customerId])?.balance ?? 0
  },
  ledger(customerId: number): LedgerEntry[] {
    const cust = db.row<{ opening_balance: number; created_at: string }>(
      'SELECT COALESCE(opening_balance,0) AS opening_balance, created_at FROM customers WHERE id=?',
      [customerId]
    )
    const sales = db.rows<{ datetime: string; ref: string; total: number; paid: number }>(
      `SELECT datetime, ref, total, paid FROM sales
       WHERE customer_id=? AND payment_method='credit' AND status<>'refunded'`,
      [customerId]
    )
    const payments = db.rows<{ datetime: string; amount: number; method: string; note: string | null }>(
      `SELECT datetime, amount, method, note FROM customer_payments WHERE customer_id=?`,
      [customerId]
    )
    const entries: LedgerEntry[] = []
    if (cust && cust.opening_balance > 0) {
      entries.push({ type: 'opening', datetime: cust.created_at, ref: 'Solde de départ', debit: cust.opening_balance, credit: 0 })
    }
    for (const s of sales) {
      entries.push({ type: 'sale', datetime: s.datetime, ref: s.ref, debit: s.total - s.paid, credit: 0 })
    }
    for (const p of payments) {
      entries.push({ type: 'payment', datetime: p.datetime, ref: 'Versement', debit: 0, credit: p.amount, method: p.method, note: p.note })
    }
    entries.sort((a, b) => (a.datetime < b.datetime ? -1 : 1))
    let bal = 0
    for (const e of entries) {
      bal += e.debit - e.credit
      e.balance = round2(bal)
    }
    return entries
  },
  addPayment(d: { customer_id: number; amount: number; method?: string; note?: string; sale_id?: number | null }): OpResult {
    if (!d.amount || d.amount <= 0) return { ok: false, error: 'Montant invalide' }
    const { id } = db.run(
      `INSERT INTO customer_payments (customer_id, sale_id, amount, method, note) VALUES (?,?,?,?,?)`,
      [d.customer_id, d.sale_id || null, d.amount, d.method || 'cash', d.note || null]
    )
    return { ok: true, id }
  }
}

// ============================ DONNÉES D'EXEMPLE ============================
export function loadSampleData(): OpResult {
  const count = db.row<{ c: number }>('SELECT COUNT(*) AS c FROM products')?.c ?? 0
  if (count > 0) {
    return { ok: false, error: 'Des produits existent déjà. Videz d\'abord (Paramètres → Tout effacer) pour charger les exemples.' }
  }

  // Catégories : récupère ou crée
  const catId = (name: string): number => {
    const ex = db.row<{ id: number }>('SELECT id FROM categories WHERE name=?', [name])
    if (ex) return ex.id
    return categoriesRepo.create({ name }).id || 0
  }

  // Fournisseurs
  const supA = suppliersRepo.create({ name: 'Grossiste Mobile Alger', phone: '0550 11 22 33', address: 'Alger Centre' }).id!
  const supB = suppliersRepo.create({ name: 'ImportTech Oran', phone: '0660 44 55 66', address: 'Oran' }).id!
  const supC = suppliersRepo.create({ name: 'Accessoires Pro', phone: '0770 77 88 99', address: 'Blida' }).id!

  type P = [string, string, number, number, number, number, number] // nom, catégorie, fournisseur, achat, prix1, prix2, stock
  const products: P[] = [
    ['Samsung Galaxy A15 128Go', 'Téléphones', supA, 28000, 34900, 33500, 5],
    ['Xiaomi Redmi Note 13', 'Téléphones', supA, 32000, 39900, 38000, 4],
    ['iPhone 13 128Go', 'Téléphones', supB, 95000, 119000, 115000, 2],
    ['Coque silicone universelle', 'Coques & Protections', supC, 150, 600, 450, 50],
    ['Verre trempé 9H', 'Verres trempés', supC, 100, 500, 350, 80],
    ['Chargeur secteur 25W USB-C', 'Chargeurs & Câbles', supC, 450, 1500, 1200, 30],
    ['Câble USB-C vers USB-C 1m', 'Chargeurs & Câbles', supC, 200, 800, 600, 60],
    ['Écouteurs Bluetooth TWS', 'Écouteurs & Audio', supC, 1800, 4000, 3500, 20],
    ['Powerbank 10000mAh', 'Powerbanks & Batteries', supC, 1500, 3500, 3000, 15],
    ['Carte mémoire microSD 64Go', 'Cartes mémoire & SIM', supC, 700, 1800, 1500, 25],
    ['Montre connectée Smart', 'Montres connectées', supB, 3500, 7000, 6000, 8],
    ['Support voiture téléphone', 'Accessoires divers', supC, 300, 1000, 800, 18]
  ]
  for (const [name, cat, sup, cost, p1, p2, stock] of products) {
    productsRepo.create({
      name,
      category_id: catId(cat),
      supplier_id: sup,
      type: cat === 'Téléphones' ? 'phone' : 'accessory',
      tracks_imei: 0,
      cost_price: cost,
      sale_price: p1,
      sale_price2: p2,
      tax_rate: 0,
      stock_qty: stock,
      min_stock: cat === 'Téléphones' ? 2 : 5,
      warranty_months: cat === 'Téléphones' ? 12 : 0
    } as any)
  }

  const clients = [
    ['Ahmed Benali', '0550 12 34 56'],
    ['Karim Saidi', '0661 98 76 54'],
    ['Yacine Mansouri', '0770 11 22 33'],
    ['Sofiane Boukhari', '0540 55 66 77'],
    ['Lamia Cherif', '0555 00 11 22'],
    ['Boutique Partenaire (point de vente)', '0560 33 44 55']
  ]
  for (const [name, phone] of clients) customersRepo.create({ name, phone })

  return { ok: true }
}

// ============================ REPRISE D'OCCASION ============================
const USED_CATEGORY = "Téléphones d'occasion"

export const tradeinRepo = {
  create(d: {
    customer_id?: number | null
    product_id?: number | null
    model?: string
    imei: string
    condition: string
    buy_price: number
    resale_price: number
    note?: string
  }): OpResult {
    const imei = (d.imei || '').trim()
    if (!imei) return { ok: false, error: 'IMEI requis' }
    const dup = db.row<{ c: number }>('SELECT COUNT(*) AS c FROM imei_units WHERE imei=?', [imei])?.c ?? 0
    if (dup > 0) return { ok: false, error: `IMEI ${imei} déjà en stock` }

    // Résolution du produit : existant, sinon création (catégorie "occasion")
    let productId = d.product_id || null
    let model = d.model || ''
    if (!productId) {
      if (!model.trim()) return { ok: false, error: 'Choisissez un produit ou saisissez un modèle' }
      const existing = db.row<{ id: number }>("SELECT id FROM products WHERE name=? AND type='phone'", [model.trim()])
      if (existing) {
        productId = existing.id
      } else {
        let catId = db.row<{ id: number }>('SELECT id FROM categories WHERE name=?', [USED_CATEGORY])?.id
        if (!catId) catId = categoriesRepo.create({ name: USED_CATEGORY, color: '#0ea5e9' }).id
        const r = productsRepo.create({
          name: model.trim(),
          type: 'phone',
          tracks_imei: 1,
          category_id: catId || null,
          cost_price: d.buy_price,
          sale_price: d.resale_price,
          tax_rate: 0,
          warranty_months: 0
        } as any)
        productId = r.id || null
      }
    } else {
      model = db.row<{ name: string }>('SELECT name FROM products WHERE id=?', [productId])?.name || model
    }
    if (!productId) return { ok: false, error: 'Produit introuvable' }

    let tradeinId = 0
    db.transaction(() => {
      const unit = imeiRepo.add({
        product_id: productId!,
        imei,
        cost_price: d.buy_price,
        sale_price: d.resale_price,
        warranty_months: 0,
        condition: d.condition,
        reason: 'Reprise occasion',
        notes: d.note
      })
      const r = db.run(
        `INSERT INTO tradeins (customer_id, product_id, imei_unit_id, model, imei, condition, buy_price, resale_price, note)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [d.customer_id || null, productId, unit.id || null, model, imei, d.condition, d.buy_price, d.resale_price, d.note || null]
      )
      tradeinId = r.id
    })
    return { ok: true, id: tradeinId }
  },

  list(): TradeIn[] {
    return db.rows<TradeIn>(
      `SELECT t.*, c.name AS customer_name, u.status AS unit_status
       FROM tradeins t
       LEFT JOIN customers c ON c.id=t.customer_id
       LEFT JOIN imei_units u ON u.id=t.imei_unit_id
       ORDER BY t.datetime DESC, t.id DESC LIMIT 500`
    )
  },

  stats(): { count: number; total_bought: number; in_stock: number; potential_margin: number } {
    return (
      db.row(
        `SELECT COUNT(*) AS count,
          COALESCE(SUM(t.buy_price),0) AS total_bought,
          COALESCE(SUM(CASE WHEN u.status='in_stock' THEN 1 ELSE 0 END),0) AS in_stock,
          COALESCE(SUM(CASE WHEN u.status='in_stock' THEN t.resale_price - t.buy_price ELSE 0 END),0) AS potential_margin
         FROM tradeins t LEFT JOIN imei_units u ON u.id=t.imei_unit_id`
      ) ?? { count: 0, total_bought: 0, in_stock: 0, potential_margin: 0 }
    )
  }
}

// ============================ PERTES ============================
export const lossTypesRepo = {
  list(): LossType[] {
    return db.rows<LossType>('SELECT * FROM loss_types ORDER BY name')
  },
  create(name: string): OpResult {
    const { id } = db.run('INSERT INTO loss_types (name) VALUES (?)', [name.trim()])
    return { ok: true, id }
  },
  remove(id: number): OpResult {
    db.run('DELETE FROM loss_types WHERE id=?', [id])
    return { ok: true }
  }
}

export const lossesRepo = {
  list(): Loss[] {
    return db.rows<Loss>(
      `SELECT l.*, lt.name AS loss_type_name
       FROM losses l LEFT JOIN loss_types lt ON lt.id=l.loss_type_id
       ORDER BY l.datetime DESC LIMIT 500`
    )
  },
  create(d: {
    product_id: number
    imei_unit_id?: number | null
    loss_type_id?: number | null
    qty: number
    reason?: string
    note?: string
  }): OpResult {
    const prod = db.row<{ name: string; cost_price: number; tracks_imei: number; stock_qty: number }>(
      'SELECT name, cost_price, tracks_imei, stock_qty FROM products WHERE id=?',
      [d.product_id]
    )
    if (!prod) return { ok: false, error: 'Produit introuvable' }
    const qty = nn(d.qty)
    let id = 0
    db.transaction(() => {
      const r = db.run(
        `INSERT INTO losses (product_id, imei_unit_id, loss_type_id, qty, unit_cost, product_name, reason, note)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          d.product_id,
          d.imei_unit_id || null,
          d.loss_type_id || null,
          qty,
          prod.cost_price,
          prod.name,
          d.reason || null,
          d.note || null
        ]
      )
      id = r.id
      if (d.imei_unit_id) {
        db.run("UPDATE imei_units SET status='lost' WHERE id=?", [d.imei_unit_id])
      } else {
        db.run('UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE id=?', [qty, d.product_id])
      }
      db.run(
        `INSERT INTO stock_movements (product_id, imei_unit_id, type, qty, reason, unit_cost)
         VALUES (?, ?, 'out', ?, ?, ?)`,
        [d.product_id, d.imei_unit_id || null, qty, d.reason || 'Perte', prod.cost_price]
      )
    })
    return { ok: true, id }
  },
  summary(): { count: number; total_cost: number } {
    return db.row<{ count: number; total_cost: number }>(
      `SELECT COUNT(*) AS count, COALESCE(SUM(qty * unit_cost), 0) AS total_cost FROM losses`
    ) ?? { count: 0, total_cost: 0 }
  }
}

// ============================ BONS DE RÉCEPTION (Purchase Orders) ============================
export const purchaseOrdersRepo = {
  list(opts: { supplier_id?: number; status?: string; search?: string } = {}): PurchaseOrder[] {
    const where: string[] = []
    const params: any[] = []
    if (opts.supplier_id) { where.push('po.supplier_id=?'); params.push(opts.supplier_id) }
    if (opts.status) { where.push('po.status=?'); params.push(opts.status) }
    if (opts.search) {
      where.push("(po.ref LIKE ? OR s.name LIKE ? OR po.note LIKE ?)")
      const s = `%${opts.search}%`
      params.push(s, s, s)
    }
    return db.rows<PurchaseOrder>(
      `SELECT po.*, s.name AS supplier_name
       FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY po.created_at DESC LIMIT 500`,
      params
    )
  },
  get(id: number): PurchaseOrder | undefined {
    const po = db.row<PurchaseOrder>(
      `SELECT po.*, s.name AS supplier_name
       FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?`,
      [id]
    )
    if (!po) return undefined
    const items = db.rows<PurchaseOrderItem>(
      'SELECT * FROM purchase_order_items WHERE order_id=? ORDER BY id',
      [id]
    )
    if (po.status === 'validated') {
      po.items = items.map((item) => {
        const pid = item.product_id
        let qtySold = 0
        let revenue = 0
        if (pid) {
          const r = db.row<{ qty_sold: number; revenue: number }>(
            `SELECT COALESCE(SUM(si.qty - COALESCE(si.refunded_qty,0)),0) AS qty_sold,
                    COALESCE(SUM((si.qty - COALESCE(si.refunded_qty,0)) * si.unit_price),0) AS revenue
             FROM sale_items si JOIN sales s ON s.id=si.sale_id
             WHERE si.product_id=? AND s.status<>'refunded'`,
            [pid]
          )
          qtySold = r?.qty_sold ?? 0
          revenue = r?.revenue ?? 0
        }
        return { ...item, qty_sold: qtySold, revenue, gain: revenue - (qtySold * item.unit_cost) } as any
      })
    } else {
      po.items = items
    }
    return po
  },
  nextRef(): string {
    const today = new Date()
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const prefix = `BR-${ymd}-`
    const last = db.row<{ ref: string }>(`SELECT ref FROM purchase_orders WHERE ref LIKE ? ORDER BY ref DESC LIMIT 1`, [prefix + '%'])
    const seq = last?.ref ? (parseInt(last.ref.slice(-4), 10) || 0) + 1 : 1
    return prefix + String(seq).padStart(4, '0')
  },
  create(d: { supplier_id: number; note?: string }): OpResult {
    const ref = purchaseOrdersRepo.nextRef()
    const { id } = db.run(
      'INSERT INTO purchase_orders (ref, supplier_id, note) VALUES (?,?,?)',
      [ref, d.supplier_id, d.note || null]
    )
    return { ok: true, id, ref }
  },
  update(d: { id: number; note?: string }): OpResult {
    db.run('UPDATE purchase_orders SET note=? WHERE id=? AND status=\'draft\'', [d.note || null, d.id])
    return { ok: true }
  },
  remove(id: number): OpResult {
    const po = db.row<{ status: string }>('SELECT status FROM purchase_orders WHERE id=?', [id])
    if (po?.status === 'validated') return { ok: false, error: 'Impossible de supprimer un bon validé' }
    db.run('DELETE FROM purchase_orders WHERE id=?', [id])
    return { ok: true }
  },
  addItem(d: {
    order_id: number
    product_name: string
    qty: number
    unit_cost: number
    sale_price?: number
    sale_price2?: number
    sale_price3?: number
    barcode?: string
    brand?: string
    category_id?: number | null
    product_id?: number | null
    notes?: string
  }): OpResult {
    const po = db.row<{ status: string }>('SELECT status FROM purchase_orders WHERE id=?', [d.order_id])
    if (!po) return { ok: false, error: 'Bon introuvable' }
    if (po.status === 'validated') return { ok: false, error: 'Bon déjà validé' }
    const { id } = db.run(
      `INSERT INTO purchase_order_items (order_id, product_id, product_name, qty, unit_cost, sale_price, sale_price2, sale_price3, barcode, brand, category_id, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        d.order_id,
        d.product_id || null,
        d.product_name,
        nn(d.qty),
        nn(d.unit_cost),
        nn(d.sale_price),
        nn(d.sale_price2),
        nn(d.sale_price3),
        d.barcode || null,
        d.brand || null,
        d.category_id || null,
        d.notes || null
      ]
    )
    recalcPO(d.order_id)
    return { ok: true, id }
  },
  updateItem(d: {
    id: number
    product_name: string
    qty: number
    unit_cost: number
    sale_price?: number
    sale_price2?: number
    sale_price3?: number
    barcode?: string
    brand?: string
    category_id?: number | null
    product_id?: number | null
    notes?: string
  }): OpResult {
    const item = db.row<{ order_id: number }>('SELECT order_id FROM purchase_order_items WHERE id=?', [d.id])
    if (!item) return { ok: false, error: 'Ligne introuvable' }
    const po = db.row<{ status: string }>('SELECT status FROM purchase_orders WHERE id=?', [item.order_id])
    if (po?.status === 'validated') return { ok: false, error: 'Bon déjà validé' }
    db.run(
      `UPDATE purchase_order_items SET product_id=?, product_name=?, qty=?, unit_cost=?, sale_price=?, sale_price2=?, sale_price3=?, barcode=?, brand=?, category_id=?, notes=? WHERE id=?`,
      [
        d.product_id || null,
        d.product_name,
        nn(d.qty),
        nn(d.unit_cost),
        nn(d.sale_price),
        nn(d.sale_price2),
        nn(d.sale_price3),
        d.barcode || null,
        d.brand || null,
        d.category_id || null,
        d.notes || null,
        d.id
      ]
    )
    recalcPO(item.order_id)
    return { ok: true }
  },
  removeItem(id: number): OpResult {
    const item = db.row<{ order_id: number }>('SELECT order_id FROM purchase_order_items WHERE id=?', [id])
    if (!item) return { ok: false, error: 'Ligne introuvable' }
    db.run('DELETE FROM purchase_order_items WHERE id=?', [id])
    recalcPO(item.order_id)
    return { ok: true }
  },
  validate(id: number): OpResult {
    const po = purchaseOrdersRepo.get(id)
    if (!po) return { ok: false, error: 'Bon introuvable' }
    if (po.status === 'validated') return { ok: false, error: 'Déjà validé' }
    if (!po.items?.length) return { ok: false, error: 'Ajoutez au moins un produit' }

    db.transaction(() => {
      for (const item of po.items!) {
        let productId = item.product_id
        if (!productId) {
          const r = productsRepo.create({
            name: item.product_name,
            barcode: item.barcode || undefined,
            brand: item.brand || undefined,
            category_id: item.category_id || undefined,
            supplier_id: po.supplier_id,
            type: 'accessory',
            tracks_imei: 0,
            cost_price: item.unit_cost,
            sale_price: item.sale_price,
            sale_price2: item.sale_price2,
            sale_price3: item.sale_price3,
            stock_qty: item.qty,
            tax_rate: 0
          } as any)
          productId = r.id || 0
          db.run('UPDATE purchase_order_items SET product_id=? WHERE id=?', [productId, item.id])
        } else {
          productsRepo.receiveStock({
            product_id: productId,
            qty: item.qty,
            unit_cost: item.unit_cost,
            supplier_id: po.supplier_id,
            reason: `Bon de réception #${id}`
          })
          if (item.sale_price > 0) {
            db.run('UPDATE products SET cost_price=?, sale_price=?, sale_price2=?, sale_price3=?, updated_at=' + now() + ' WHERE id=?', [
              item.unit_cost, item.sale_price, item.sale_price2, item.sale_price3, productId
            ])
          }
        }
      }
      db.run(`UPDATE purchase_orders SET status='validated', validated_at=${now()} WHERE id=?`, [id])
    })
    return { ok: true }
  }
}

function recalcPO(orderId: number): void {
  const r = db.row<{ total_cost: number; total_items: number }>(
    `SELECT COALESCE(SUM(qty * unit_cost), 0) AS total_cost, COALESCE(SUM(qty), 0) AS total_items
     FROM purchase_order_items WHERE order_id=?`,
    [orderId]
  )
  db.run('UPDATE purchase_orders SET total_cost=?, total_items=? WHERE id=?', [
    r?.total_cost ?? 0,
    r?.total_items ?? 0,
    orderId
  ])
}

// ============================ RELEVÉ CLIENT ============================
export const customerStatementRepo = {
  get(customerId: number): CustomerStatement | undefined {
    const customer = db.row<Customer>(
      `SELECT c.*, (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.customer_id=c.id AND s.status<>'refunded') AS total_spent,
       (SELECT COUNT(*) FROM sales s WHERE s.customer_id=c.id AND s.status<>'refunded') AS purchases_count
       FROM customers c WHERE c.id=?`,
      [customerId]
    )
    if (!customer) return undefined

    const entries: CustomerStatementEntry[] = []
    const payLabel: Record<string, string> = { cash: 'Espèces', card: 'Carte', transfer: 'Virement', credit: 'Crédit' }

    const sales = db.rows<any>(
      `SELECT s.*, cu.name AS customer_name,
        (SELECT GROUP_CONCAT(si.name || ' x' || CAST(CAST(si.qty AS INT) + COALESCE(si.refunded_qty,0) AS INT), ', ')
         FROM sale_items si WHERE si.sale_id=s.id) AS items_summary,
        (SELECT GROUP_CONCAT(si.name || ' x' || CAST(CAST(si.refunded_qty AS INT) AS INT), ', ')
         FROM sale_items si WHERE si.sale_id=s.id AND COALESCE(si.refunded_qty,0)>0) AS refund_summary,
        (SELECT COALESCE(SUM(si.refunded_qty * si.unit_price),0)
         FROM sale_items si WHERE si.sale_id=s.id AND COALESCE(si.refunded_qty,0)>0) AS refund_amount,
        (SELECT MAX(sm.datetime) FROM stock_movements sm
         WHERE sm.type='return' AND sm.ref=s.ref) AS refund_datetime
       FROM sales s LEFT JOIN customers cu ON cu.id=s.customer_id
       WHERE s.customer_id=? ORDER BY s.datetime DESC`,
      [customerId]
    )
    for (const s of sales) {
      const origItems = db.rows<any>(
        'SELECT unit_price, qty, refunded_qty FROM sale_items WHERE sale_id=?', [s.id]
      )
      const origTotal = origItems.reduce(
        (sum: number, i: any) => sum + ((i.qty + (i.refunded_qty || 0)) * i.unit_price), 0
      )
      entries.push({
        type: 'sale',
        datetime: s.datetime,
        ref: s.ref,
        description: `Vente ${s.ref} (${payLabel[s.payment_method] || s.payment_method})`,
        amount: s.status === 'refunded' ? origTotal : s.total + (s.refund_amount || 0),
        detail: s.items_summary || ''
      })
      if ((s.refund_amount || 0) > 0) {
        entries.push({
          type: 'refund',
          datetime: s.refund_datetime || s.datetime,
          ref: s.ref,
          description: `Remboursement ${s.ref}${s.status === 'refunded' ? ' (total)' : ' (partiel)'}`,
          amount: s.refund_amount,
          detail: s.refund_summary || ''
        })
      }
    }

    const payments = db.rows<{ datetime: string; amount: number; method: string; note: string | null; sale_id: number | null }>(
      'SELECT datetime, amount, method, note, sale_id FROM customer_payments WHERE customer_id=? ORDER BY datetime DESC',
      [customerId]
    )
    for (const p of payments) {
      entries.push({
        type: 'payment',
        datetime: p.datetime,
        ref: 'Encaissement',
        description: `Encaissement ${payLabel[p.method] || p.method}${p.note ? ' — ' + p.note : ''}`,
        amount: p.amount
      })
    }

    const tradeins = db.rows<TradeIn>(
      `SELECT t.*, c.name AS customer_name FROM tradeins t
       LEFT JOIN customers c ON c.id=t.customer_id WHERE t.customer_id=? ORDER BY t.datetime DESC`,
      [customerId]
    )
    for (const t of tradeins) {
      entries.push({
        type: 'tradein',
        datetime: t.datetime,
        ref: `Reprise`,
        description: `Reprise ${t.model} (IMEI: ${t.imei || '—'})`,
        amount: t.buy_price
      })
    }

    entries.sort((a, b) => (a.datetime > b.datetime ? -1 : 1))

    const creditBalance = creditRepo.balance(customerId)
    const totalPurchases = sales.reduce((s: number, v: any) => {
      const origItems = db.rows<any>(
        'SELECT unit_price, qty, refunded_qty FROM sale_items WHERE sale_id=?', [v.id]
      )
      return s + origItems.reduce((sum: number, i: any) => sum + ((i.qty + (i.refunded_qty || 0)) * i.unit_price), 0)
    }, 0)
    const totalRefunded = sales.reduce((s: number, v: any) => s + (v.refund_amount || 0), 0)
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0)

    return {
      customer,
      credit_balance: creditBalance,
      total_purchases: totalPurchases - totalRefunded,
      total_paid: totalPaid,
      entries
    }
  }
}
