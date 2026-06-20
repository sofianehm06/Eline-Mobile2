import { BrowserWindow, dialog } from 'electron'
import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import { api as db } from './db/database'
import { categoriesRepo, customerStatementRepo, customersRepo, imeiRepo, productsRepo, purchaseOrdersRepo, settingsRepo, suppliersRepo } from './db/repo'
import type { ImportResult, OpResult } from '@shared/types'

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function storeName(): string {
  return settingsRepo.getAll().store_name || 'Ma Boutique'
}

function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = storeName()
  wb.created = new Date()
  return wb
}

function styleHeader(ws: ExcelJS.Worksheet): void {
  const row = ws.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D40F5' } }
  row.alignment = { vertical: 'middle' }
  row.height = 20
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

// ============================ EXPORT ============================
export async function exportAll(win: BrowserWindow | null): Promise<OpResult> {
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    title: 'Exporter toutes les données vers Excel',
    defaultPath: `export-${stamp()}.xlsx`,
    filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }]
  })
  if (canceled || !filePath) return { ok: false, error: 'Annulé' }

  try {
    const wb = newWorkbook()

    // Produits
    const wsP = wb.addWorksheet('Produits')
    wsP.columns = [
      { header: 'SKU', key: 'sku', width: 14 },
      { header: 'Code-barres', key: 'barcode', width: 16 },
      { header: 'Nom', key: 'name', width: 32 },
      { header: 'Marque', key: 'brand', width: 14 },
      { header: 'Modèle', key: 'model', width: 16 },
      { header: 'Catégorie', key: 'category', width: 18 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Suivi IMEI', key: 'imei', width: 10 },
      { header: 'Prix achat', key: 'cost', width: 12 },
      { header: 'Prix vente', key: 'price', width: 12 },
      { header: 'Prix vente 2', key: 'price2', width: 12 },
      { header: 'Prix vente 3', key: 'price3', width: 12 },
      { header: 'TVA %', key: 'tax', width: 8 },
      { header: 'Stock', key: 'stock', width: 8 },
      { header: 'Stock min', key: 'min', width: 10 },
      { header: 'Garantie (mois)', key: 'warranty', width: 14 },
      { header: 'Actif', key: 'active', width: 8 }
    ]
    for (const p of productsRepo.list({ active: false })) {
      wsP.addRow({
        sku: p.sku, barcode: p.barcode || '', name: p.name, brand: p.brand || '', model: p.model || '',
        category: p.category_name || '', type: p.type === 'phone' ? 'Téléphone' : 'Accessoire',
        imei: p.tracks_imei ? 'Oui' : 'Non', cost: p.cost_price, price: p.sale_price,
        price2: p.sale_price2 || '', price3: p.sale_price3 || '', tax: p.tax_rate,
        stock: p.available_stock ?? 0, min: p.min_stock, warranty: p.warranty_months, active: p.is_active ? 'Oui' : 'Non'
      })
    }
    styleHeader(wsP)

    // Unités IMEI
    const wsI = wb.addWorksheet('Unités IMEI')
    wsI.columns = [
      { header: 'IMEI', key: 'imei', width: 20 },
      { header: 'Produit', key: 'product', width: 30 },
      { header: 'SKU produit', key: 'sku', width: 14 },
      { header: 'Série', key: 'serial', width: 16 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Prix achat', key: 'cost', width: 12 },
      { header: 'Prix vente', key: 'price', width: 12 },
      { header: 'Garantie (mois)', key: 'warranty', width: 14 },
      { header: 'Date achat', key: 'date', width: 18 }
    ]
    const units = db.rows<any>(
      `SELECT u.*, p.name AS product_name, p.sku AS product_sku FROM imei_units u LEFT JOIN products p ON p.id=u.product_id ORDER BY u.id`
    )
    const statusLbl: Record<string, string> = { in_stock: 'En stock', sold: 'Vendu', returned: 'Retourné', reserved: 'Réservé' }
    for (const u of units) {
      wsI.addRow({
        imei: u.imei, product: u.product_name, sku: u.product_sku, serial: u.serial || '',
        status: statusLbl[u.status] || u.status, cost: u.cost_price, price: u.sale_price || '',
        warranty: u.warranty_months, date: u.purchase_date || ''
      })
    }
    styleHeader(wsI)

    // Clients
    const wsC = wb.addWorksheet('Clients')
    wsC.columns = [
      { header: 'Nom', key: 'name', width: 26 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Adresse', key: 'address', width: 30 },
      { header: 'Notes', key: 'notes', width: 24 }
    ]
    for (const c of customersRepo.list()) {
      wsC.addRow({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '' })
    }
    styleHeader(wsC)

    // Fournisseurs
    const wsF = wb.addWorksheet('Fournisseurs')
    wsF.columns = [
      { header: 'Nom', key: 'name', width: 26 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'Adresse', key: 'address', width: 30 },
      { header: 'Notes', key: 'notes', width: 24 }
    ]
    for (const s of db.rows<any>('SELECT * FROM suppliers ORDER BY name')) {
      wsF.addRow({ name: s.name, phone: s.phone || '', address: s.address || '', notes: s.notes || '' })
    }
    styleHeader(wsF)

    // Catégories
    const wsCat = wb.addWorksheet('Catégories')
    wsCat.columns = [
      { header: 'Nom', key: 'name', width: 24 },
      { header: 'Couleur', key: 'color', width: 12 }
    ]
    for (const c of db.rows<any>('SELECT * FROM categories ORDER BY name')) {
      wsCat.addRow({ name: c.name, color: c.color })
    }
    styleHeader(wsCat)

    // Ventes
    const wsV = wb.addWorksheet('Ventes')
    wsV.columns = [
      { header: 'Réf', key: 'ref', width: 18 },
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Client', key: 'customer', width: 22 },
      { header: 'Sous-total', key: 'subtotal', width: 12 },
      { header: 'Remise', key: 'discount', width: 10 },
      { header: 'TVA', key: 'tax', width: 10 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Payé', key: 'paid', width: 12 },
      { header: 'Rendu', key: 'change', width: 10 },
      { header: 'Paiement', key: 'method', width: 12 },
      { header: 'Statut', key: 'status', width: 12 }
    ]
    const payLbl: Record<string, string> = { cash: 'Espèces', card: 'Carte', transfer: 'Virement', credit: 'Crédit' }
    for (const s of db.rows<any>(
      `SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.datetime DESC`
    )) {
      wsV.addRow({
        ref: s.ref, date: s.datetime, customer: s.customer_name || 'Passage', subtotal: s.subtotal,
        discount: s.discount, tax: s.tax, total: s.total, paid: s.paid, change: s.change_due,
        method: payLbl[s.payment_method] || s.payment_method, status: s.status === 'refunded' ? 'Remboursé' : 'Validé'
      })
    }
    styleHeader(wsV)

    // Lignes de vente
    const wsL = wb.addWorksheet('Détails ventes')
    wsL.columns = [
      { header: 'Réf vente', key: 'ref', width: 18 },
      { header: 'Article', key: 'name', width: 32 },
      { header: 'IMEI', key: 'imei', width: 18 },
      { header: 'Qté', key: 'qty', width: 8 },
      { header: 'P.U.', key: 'unit', width: 12 },
      { header: 'Remise', key: 'discount', width: 10 },
      { header: 'Total ligne', key: 'total', width: 12 }
    ]
    for (const it of db.rows<any>(
      `SELECT si.*, s.ref AS sref, u.imei FROM sale_items si JOIN sales s ON s.id=si.sale_id LEFT JOIN imei_units u ON u.id=si.imei_unit_id ORDER BY s.datetime DESC, si.id`
    )) {
      wsL.addRow({ ref: it.sref, name: it.name, imei: it.imei || '', qty: it.qty, unit: it.unit_price, discount: it.discount, total: it.line_total })
    }
    styleHeader(wsL)

    await wb.xlsx.writeFile(filePath)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}

// ============================ EXPORT PAR ENTITÉ ============================
async function saveWorkbook(win: BrowserWindow | null, wb: ExcelJS.Workbook, defaultName: string): Promise<OpResult> {
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    title: 'Exporter vers Excel',
    defaultPath: `${defaultName}-${stamp()}.xlsx`,
    filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }]
  })
  if (canceled || !filePath) return { ok: false, error: 'Annulé' }
  try {
    await wb.xlsx.writeFile(filePath)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}

export async function exportProducts(win: BrowserWindow | null): Promise<OpResult> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Produits')
  ws.columns = [
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Code-barres', key: 'barcode', width: 16 },
    { header: 'Nom', key: 'name', width: 32 },
    { header: 'Marque', key: 'brand', width: 14 },
    { header: 'Modèle', key: 'model', width: 16 },
    { header: 'Catégorie', key: 'category', width: 18 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Prix achat', key: 'cost', width: 12 },
    { header: 'Prix vente', key: 'price', width: 12 },
    { header: 'Prix vente 2', key: 'price2', width: 12 },
    { header: 'Prix vente 3', key: 'price3', width: 12 },
    { header: 'Stock', key: 'stock', width: 8 },
    { header: 'Actif', key: 'active', width: 8 }
  ]
  for (const p of productsRepo.list({ active: false })) {
    ws.addRow({
      sku: p.sku, barcode: p.barcode || '', name: p.name, brand: p.brand || '', model: p.model || '',
      category: p.category_name || '', type: p.type === 'phone' ? 'Téléphone' : 'Accessoire',
      cost: p.cost_price, price: p.sale_price, price2: p.sale_price2 || '', price3: p.sale_price3 || '',
      stock: p.available_stock ?? 0, active: p.is_active ? 'Oui' : 'Non'
    })
  }
  styleHeader(ws)
  return saveWorkbook(win, wb, 'produits')
}

export async function exportClients(win: BrowserWindow | null): Promise<OpResult> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Clients')
  ws.columns = [
    { header: 'Nom', key: 'name', width: 26 },
    { header: 'Téléphone', key: 'phone', width: 16 },
    { header: 'Email', key: 'email', width: 24 },
    { header: 'Adresse', key: 'address', width: 30 },
    { header: 'Notes', key: 'notes', width: 24 }
  ]
  for (const c of customersRepo.list()) {
    ws.addRow({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '' })
  }
  styleHeader(ws)
  return saveWorkbook(win, wb, 'clients')
}

export async function exportFournisseurs(win: BrowserWindow | null): Promise<OpResult> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Fournisseurs')
  ws.columns = [
    { header: 'Nom', key: 'name', width: 26 },
    { header: 'Téléphone', key: 'phone', width: 16 },
    { header: 'Adresse', key: 'address', width: 30 },
    { header: 'Notes', key: 'notes', width: 24 }
  ]
  for (const s of db.rows<any>('SELECT * FROM suppliers ORDER BY name')) {
    ws.addRow({ name: s.name, phone: s.phone || '', address: s.address || '', notes: s.notes || '' })
  }
  styleHeader(ws)
  return saveWorkbook(win, wb, 'fournisseurs')
}

export async function exportVentes(win: BrowserWindow | null, from?: string, to?: string): Promise<OpResult> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Ventes')
  ws.columns = [
    { header: 'Réf', key: 'ref', width: 18 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Client', key: 'customer', width: 22 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Payé', key: 'paid', width: 12 },
    { header: 'Paiement', key: 'method', width: 12 },
    { header: 'Statut', key: 'status', width: 12 }
  ]
  const payLbl: Record<string, string> = { cash: 'Espèces', card: 'Carte', transfer: 'Virement', credit: 'Crédit' }
  const where: string[] = []
  const params: any[] = []
  if (from) { where.push("s.datetime >= ?"); params.push(from) }
  if (to) { where.push("s.datetime < date(?, '+1 day')"); params.push(to) }
  const sql = `SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY s.datetime DESC`
  for (const s of db.rows<any>(sql, params)) {
    ws.addRow({
      ref: s.ref, date: s.datetime, customer: s.customer_name || 'Passage',
      total: s.total, paid: s.paid,
      method: payLbl[s.payment_method] || s.payment_method,
      status: s.status === 'refunded' ? 'Remboursé' : 'Validé'
    })
  }
  styleHeader(ws)
  const suffix = from || to ? `ventes-${from || ''}-${to || ''}` : 'ventes'
  return saveWorkbook(win, wb, suffix)
}

export async function exportPertes(win: BrowserWindow | null, from?: string, to?: string): Promise<OpResult> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Pertes')
  ws.columns = [
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Produit', key: 'product', width: 30 },
    { header: 'Type', key: 'type', width: 16 },
    { header: 'Qté', key: 'qty', width: 8 },
    { header: 'Coût unit.', key: 'cost', width: 12 },
    { header: 'Coût total', key: 'total', width: 12 },
    { header: 'Raison', key: 'reason', width: 24 },
    { header: 'Note', key: 'note', width: 24 }
  ]
  const where: string[] = []
  const params: any[] = []
  if (from) { where.push("l.datetime >= ?"); params.push(from) }
  if (to) { where.push("l.datetime < date(?, '+1 day')"); params.push(to) }
  const sql = `SELECT l.*, lt.name AS loss_type_name FROM losses l LEFT JOIN loss_types lt ON lt.id=l.loss_type_id${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY l.datetime DESC`
  for (const l of db.rows<any>(sql, params)) {
    ws.addRow({
      date: l.datetime, product: l.product_name || '', type: l.loss_type_name || '',
      qty: l.qty, cost: l.unit_cost, total: l.qty * l.unit_cost,
      reason: l.reason || '', note: l.note || ''
    })
  }
  styleHeader(ws)
  return saveWorkbook(win, wb, from || to ? `pertes-${from || ''}-${to || ''}` : 'pertes')
}

export async function exportReceptions(win: BrowserWindow | null, from?: string, to?: string): Promise<OpResult> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Bons de réception')
  ws.columns = [
    { header: 'Réf', key: 'ref', width: 20 },
    { header: 'Fournisseur', key: 'supplier', width: 22 },
    { header: 'Statut', key: 'status', width: 12 },
    { header: 'Articles', key: 'items', width: 10 },
    { header: 'Coût total', key: 'cost', width: 14 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Note', key: 'note', width: 24 }
  ]
  let allPOs = purchaseOrdersRepo.list()
  if (from) allPOs = allPOs.filter(o => o.created_at >= from)
  if (to) allPOs = allPOs.filter(o => o.created_at < to + 'T99')
  for (const o of allPOs) {
    ws.addRow({
      ref: o.ref || `#${o.id}`, supplier: o.supplier_name || '', status: o.status === 'validated' ? 'Validé' : 'En attente',
      items: o.total_items, cost: o.total_cost, date: o.created_at, note: o.note || ''
    })
  }
  styleHeader(ws)
  const wsD = wb.addWorksheet('Détails réceptions')
  wsD.columns = [
    { header: 'Réf bon', key: 'ref', width: 20 },
    { header: 'Produit', key: 'product', width: 30 },
    { header: 'Marque', key: 'brand', width: 14 },
    { header: 'Qté', key: 'qty', width: 8 },
    { header: 'Coût unit.', key: 'cost', width: 12 },
    { header: 'Prix vente', key: 'price', width: 12 },
    { header: 'Total', key: 'total', width: 12 }
  ]
  for (const o of allPOs) {
    const full = purchaseOrdersRepo.get(o.id)
    if (full?.items) {
      for (const it of full.items) {
        wsD.addRow({
          ref: o.ref || `#${o.id}`, product: it.product_name, brand: it.brand || '',
          qty: it.qty, cost: it.unit_cost, price: it.sale_price, total: it.qty * it.unit_cost
        })
      }
    }
  }
  styleHeader(wsD)
  return saveWorkbook(win, wb, from || to ? `receptions-${from || ''}-${to || ''}` : 'receptions')
}

export async function exportStock(win: BrowserWindow | null): Promise<OpResult> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Stock')
  ws.columns = [
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Nom', key: 'name', width: 32 },
    { header: 'Marque', key: 'brand', width: 14 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Stock min', key: 'min', width: 10 },
    { header: 'Prix achat', key: 'cost', width: 12 },
    { header: 'Valeur stock', key: 'value', width: 14 }
  ]
  for (const p of productsRepo.list({ active: false })) {
    const stock = p.available_stock ?? 0
    ws.addRow({
      sku: p.sku, name: p.name, brand: p.brand || '',
      type: p.type === 'phone' ? 'Téléphone' : 'Accessoire',
      stock, min: p.min_stock, cost: p.cost_price, value: stock * p.cost_price
    })
  }
  styleHeader(ws)
  const wsI = wb.addWorksheet('Unités IMEI')
  wsI.columns = [
    { header: 'IMEI', key: 'imei', width: 20 },
    { header: 'Produit', key: 'product', width: 30 },
    { header: 'Statut', key: 'status', width: 12 },
    { header: 'État', key: 'condition', width: 12 },
    { header: 'Prix achat', key: 'cost', width: 12 },
    { header: 'Prix vente', key: 'price', width: 12 }
  ]
  const statusLbl: Record<string, string> = { in_stock: 'En stock', sold: 'Vendu', returned: 'Retourné', reserved: 'Réservé', lost: 'Perdu' }
  for (const u of db.rows<any>(
    `SELECT u.*, p.name AS product_name FROM imei_units u LEFT JOIN products p ON p.id=u.product_id ORDER BY u.id`
  )) {
    wsI.addRow({
      imei: u.imei, product: u.product_name, status: statusLbl[u.status] || u.status,
      condition: u.condition || 'Neuf', cost: u.cost_price, price: u.sale_price || ''
    })
  }
  styleHeader(wsI)
  return saveWorkbook(win, wb, 'stock')
}

export async function exportCredit(win: BrowserWindow | null): Promise<OpResult> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Crédit clients')
  ws.columns = [
    { header: 'Client', key: 'name', width: 26 },
    { header: 'Téléphone', key: 'phone', width: 16 },
    { header: 'Solde dû', key: 'balance', width: 14 },
    { header: 'Dernier mouvement', key: 'last', width: 20 }
  ]
  for (const d of db.rows<any>(
    `SELECT * FROM (
       SELECT c.id, c.name, c.phone,
         COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.customer_id=c.id AND s.payment_method='credit' AND s.status<>'refunded'),0)
         - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp WHERE cp.customer_id=c.id),0)
         + COALESCE(c.opening_balance,0) AS balance,
         (SELECT MAX(datetime) FROM customer_payments cp2 WHERE cp2.customer_id=c.id) AS last_payment
       FROM customers c
     ) WHERE balance > 0.01
     ORDER BY balance DESC`
  )) {
    ws.addRow({ name: d.name, phone: d.phone || '', balance: d.balance, last: d.last_payment || '' })
  }
  styleHeader(ws)
  return saveWorkbook(win, wb, 'credit')
}

export async function exportReprise(win: BrowserWindow | null, from?: string, to?: string): Promise<OpResult> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Reprises')
  ws.columns = [
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Modèle', key: 'model', width: 24 },
    { header: 'IMEI', key: 'imei', width: 20 },
    { header: 'État', key: 'condition', width: 14 },
    { header: 'Client', key: 'customer', width: 22 },
    { header: 'Racheté', key: 'buy', width: 12 },
    { header: 'Revente', key: 'resale', width: 12 },
    { header: 'Note', key: 'note', width: 24 }
  ]
  const where: string[] = []
  const params: any[] = []
  if (from) { where.push("t.datetime >= ?"); params.push(from) }
  if (to) { where.push("t.datetime < date(?, '+1 day')"); params.push(to) }
  const sql = `SELECT t.*, c.name AS customer_name FROM tradeins t LEFT JOIN customers c ON c.id=t.customer_id${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY t.datetime DESC`
  for (const t of db.rows<any>(sql, params)) {
    ws.addRow({
      date: t.datetime, model: t.model, imei: t.imei || '', condition: t.condition || '',
      customer: t.customer_name || '', buy: t.buy_price, resale: t.resale_price, note: t.note || ''
    })
  }
  styleHeader(ws)
  return saveWorkbook(win, wb, from || to ? `reprises-${from || ''}-${to || ''}` : 'reprises')
}

export async function exportStatement(win: BrowserWindow | null, customerId: number): Promise<OpResult> {
  const data = customerStatementRepo.get(customerId)
  if (!data) return { ok: false, error: 'Client introuvable' }
  const wb = newWorkbook()
  const ws = wb.addWorksheet(`Relevé ${data.customer.name}`)
  ws.columns = [
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Réf', key: 'ref', width: 18 },
    { header: 'Description', key: 'desc', width: 40 },
    { header: 'Montant', key: 'amount', width: 14 },
    { header: 'Détail', key: 'detail', width: 30 }
  ]
  const typeLbl: Record<string, string> = { sale: 'Vente', payment: 'Encaissement', tradein: 'Reprise', refund: 'Remboursement' }
  for (const e of data.entries) {
    ws.addRow({
      date: e.datetime, type: typeLbl[e.type] || e.type, ref: e.ref,
      desc: e.description, amount: e.amount, detail: e.detail || ''
    })
  }
  styleHeader(ws)
  ws.addRow({})
  ws.addRow({ date: '', type: '', ref: '', desc: 'Total achats', amount: data.total_purchases })
  ws.addRow({ date: '', type: '', ref: '', desc: 'Total payé', amount: data.total_paid })
  ws.addRow({ date: '', type: '', ref: '', desc: 'Solde crédit', amount: data.credit_balance })
  return saveWorkbook(win, wb, `releve-${data.customer.name.replace(/[^a-zA-Z0-9]/g, '_')}`)
}

// ============================ MODÈLES (TEMPLATES) ============================
export async function exportTemplate(win: BrowserWindow | null, kind: 'produits' | 'clients' | 'imei' | 'fournisseurs'): Promise<OpResult> {
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    title: 'Enregistrer le modèle Excel',
    defaultPath: `modele-${kind}.xlsx`,
    filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }]
  })
  if (canceled || !filePath) return { ok: false, error: 'Annulé' }
  try {
    const wb = new ExcelJS.Workbook()
    if (kind === 'produits') {
      const ws = wb.addWorksheet('Produits')
      ws.columns = [
        { header: 'Nom', key: 'name', width: 32 },
        { header: 'Type', key: 'type', width: 14 },
        { header: 'Marque', key: 'brand', width: 14 },
        { header: 'Modèle', key: 'model', width: 16 },
        { header: 'Catégorie', key: 'category', width: 18 },
        { header: 'Code-barres', key: 'barcode', width: 16 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'Prix achat', key: 'cost', width: 12 },
        { header: 'Prix vente', key: 'price', width: 12 },
        { header: 'Prix vente 2', key: 'price2', width: 12 },
        { header: 'Prix vente 3', key: 'price3', width: 12 },
        { header: 'TVA %', key: 'tax', width: 8 },
        { header: 'Stock', key: 'stock', width: 8 },
        { header: 'Stock min', key: 'min', width: 10 },
        { header: 'Garantie (mois)', key: 'warranty', width: 14 }
      ]
      ws.addRow({ name: 'Coque silicone', type: 'Accessoire', brand: 'Generic', category: 'Accessoires', barcode: '6001240010015', cost: 150, price: 500, price2: 450, price3: 400, tax: 19, stock: 30, min: 5, warranty: 0 })
      ws.addRow({ name: 'Samsung Galaxy A15', type: 'Téléphone', brand: 'Samsung', model: 'A15', category: 'Téléphones', cost: 28000, price: 34900, price2: 33500, tax: 19, warranty: 12 })
      styleHeader(ws)
    } else if (kind === 'clients') {
      const ws = wb.addWorksheet('Clients')
      ws.columns = [
        { header: 'Nom', key: 'name', width: 26 },
        { header: 'Téléphone', key: 'phone', width: 16 },
        { header: 'Email', key: 'email', width: 24 },
        { header: 'Adresse', key: 'address', width: 30 },
        { header: 'Notes', key: 'notes', width: 24 }
      ]
      ws.addRow({ name: 'Ahmed Benali', phone: '0550 12 34 56', address: 'Alger' })
      styleHeader(ws)
    } else if (kind === 'fournisseurs') {
      const ws = wb.addWorksheet('Fournisseurs')
      ws.columns = [
        { header: 'Nom', key: 'name', width: 26 },
        { header: 'Téléphone', key: 'phone', width: 16 },
        { header: 'Adresse', key: 'address', width: 30 },
        { header: 'Notes', key: 'notes', width: 24 }
      ]
      ws.addRow({ name: 'Grossiste Mobile Alger', phone: '0550 11 22 33', address: 'Alger Centre' })
      styleHeader(ws)
    } else {
      const ws = wb.addWorksheet('IMEI')
      ws.columns = [
        { header: 'IMEI', key: 'imei', width: 20 },
        { header: 'Produit (SKU ou Nom)', key: 'product', width: 30 },
        { header: 'Série', key: 'serial', width: 16 },
        { header: 'Prix achat', key: 'cost', width: 12 },
        { header: 'Prix vente', key: 'price', width: 12 },
        { header: 'Garantie (mois)', key: 'warranty', width: 14 }
      ]
      ws.addRow({ imei: '350000000000017', product: 'Samsung Galaxy A15', cost: 28000, price: 34900, warranty: 12 })
      styleHeader(ws)
    }
    await wb.xlsx.writeFile(filePath)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}

// ============================ IMPORT ============================
// La lecture utilise SheetJS : prend en charge .xlsx, .xls (ancien format),
// .csv et même les "Excel" exportés en HTML par d'anciens logiciels.
function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

type Grid = string[][]

// Ouvre un fichier et renvoie la feuille sous forme de tableau de lignes (1ère = en-têtes)
async function openGrid(win: BrowserWindow | null, preferredSheet?: string): Promise<{ grid?: Grid; error?: string; canceled?: boolean }> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    title: 'Choisir le fichier à importer',
    properties: ['openFile'],
    filters: [
      { name: 'Tableurs (Excel, CSV)', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  })
  if (canceled || !filePaths?.length) return { canceled: true }
  try {
    const wb = XLSX.readFile(filePaths[0], { raw: false, cellText: true })
    let sheetName = wb.SheetNames[0]
    if (preferredSheet) {
      const found = wb.SheetNames.find((n) => norm(n).includes(norm(preferredSheet)))
      if (found) sheetName = found
    }
    const ws = wb.Sheets[sheetName]
    if (!ws) return { error: 'Aucune feuille trouvée dans le fichier' }
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false }) as Grid
    return { grid }
  } catch (err: any) {
    return { error: 'Fichier illisible : ' + (err?.message || err) }
  }
}

function headerMap(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    const k = norm(h)
    if (k && map[k] === undefined) map[k] = i
  })
  return map
}

// Récupère une cellule : correspondance exacte d'abord, puis "l'en-tête contient le mot".
function cell(row: string[], map: Record<string, number>, names: string[]): string {
  for (const n of names) {
    const k = norm(n)
    if (map[k] !== undefined) {
      const v = row[map[k]]
      if (v != null && String(v).trim() !== '') return String(v).trim()
    }
  }
  for (const n of names) {
    const k = norm(n)
    for (const h of Object.keys(map)) {
      if (h.includes(k)) {
        const v = row[map[h]]
        if (v != null && String(v).trim() !== '') return String(v).trim()
      }
    }
  }
  return ''
}

function toNum(s: string): number {
  if (!s) return 0
  const n = Number(String(s).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

export async function importProducts(win: BrowserWindow | null): Promise<ImportResult> {
  const { grid, error, canceled } = await openGrid(win, 'Produits')
  if (canceled) return { ok: false, created: 0, updated: 0, errors: [], error: 'Annulé' }
  if (error || !grid?.length) return { ok: false, created: 0, updated: 0, errors: [], error: error || 'Fichier vide' }

  const map = headerMap(grid[0])
  let created = 0
  let updated = 0
  const errors: string[] = []
  const cats = new Map<string, number>()
  for (const c of categoriesRepo.list()) cats.set(norm(c.name), c.id)

  db.transaction(() => {
    for (let i = 1; i < grid.length; i++) {
      const row = grid[i]
      const name = cell(row, map, ['Nom du produit', 'Nom', 'Designation', 'Désignation', 'Produit', 'Libellé', 'Article'])
      if (!name) continue
      try {
        const catName = cell(row, map, ['Catégorie', 'Categorie', 'Famille', 'Rayon'])
        let categoryId: number | null = null
        if (catName) {
          const key = norm(catName)
          if (cats.has(key)) categoryId = cats.get(key)!
          else {
            const r = categoriesRepo.create({ name: catName })
            categoryId = r.id || null
            if (categoryId) cats.set(key, categoryId)
          }
        }
        const typeRaw = norm(cell(row, map, ['Type']))
        const isPhone = typeRaw.includes('tel') || typeRaw.includes('phone')
        const sku = cell(row, map, ['SKU', 'Référence', 'Reference', 'Code produit', 'Code'])
        const barcode = cell(row, map, ['Code-barres', 'Code barre', 'Barcode', 'EAN', 'Code à barres'])
        const costS = cell(row, map, ['Prix achat', "Prix d'achat", 'Achat', 'Cout', 'Coût', 'PA'])
        const priceS = cell(row, map, ['Prix vente', 'Prix de vente', 'Vente', 'Prix', 'PV', 'Prix TTC'])
        const cost = toNum(costS)
        const price = toNum(priceS)
        const price2 = toNum(cell(row, map, ['Prix vente 2', 'Prix vente2', '2ème prix', '2eme prix', 'Prix 2', 'PV2']))
        const price3 = toNum(cell(row, map, ['Prix vente 3', 'Prix vente3', '3ème prix', '3eme prix', 'Prix 3', 'PV3']))
        const stock = toNum(cell(row, map, ['Stock', 'Quantité', 'Quantite', 'Qté', 'Qte', 'Stock actuel']))
        const min = toNum(cell(row, map, ['Stock min', 'Seuil', 'Minimum', 'Stock minimum']))
        const warranty = toNum(cell(row, map, ['Garantie (mois)', 'Garantie'])) || (isPhone ? 12 : 0)

        let existing: any = null
        if (sku) existing = db.row('SELECT * FROM products WHERE sku=?', [sku])
        if (!existing && barcode) existing = db.row('SELECT * FROM products WHERE barcode=?', [barcode])

        if (existing) {
          db.run(
            `UPDATE products SET name=?, brand=?, model=?, category_id=?, type=?, tracks_imei=?, cost_price=?, sale_price=?, sale_price2=?, sale_price3=?, min_stock=?, warranty_months=?, barcode=?, updated_at=datetime('now','localtime') WHERE id=?`,
            [
              name,
              cell(row, map, ['Marque', 'Brand']) || existing.brand,
              cell(row, map, ['Modèle', 'Modele', 'Model']) || existing.model,
              categoryId ?? existing.category_id,
              isPhone ? 'phone' : 'accessory',
              isPhone ? 1 : 0,
              cost, price,
              price2 || existing.sale_price2,
              price3 || existing.sale_price3,
              min, warranty,
              barcode || existing.barcode,
              existing.id
            ]
          )
          updated++
        } else {
          productsRepo.create({
            name, sku: sku || undefined, barcode: barcode || undefined,
            brand: cell(row, map, ['Marque', 'Brand']) || undefined,
            model: cell(row, map, ['Modèle', 'Modele', 'Model']) || undefined,
            category_id: categoryId,
            type: isPhone ? 'phone' : 'accessory',
            tracks_imei: isPhone ? 1 : 0,
            cost_price: cost, sale_price: price, sale_price2: price2, sale_price3: price3, tax_rate: 0,
            stock_qty: isPhone ? 0 : stock, min_stock: min, warranty_months: warranty
          } as any)
          created++
        }
      } catch (e: any) {
        errors.push(`Ligne ${i + 1} (${name}) : ${e?.message || e}`)
      }
    }
  })

  return { ok: created + updated > 0, created, updated, errors }
}

export async function importCustomers(win: BrowserWindow | null): Promise<ImportResult> {
  const { grid, error, canceled } = await openGrid(win, 'Clients')
  if (canceled) return { ok: false, created: 0, updated: 0, errors: [], error: 'Annulé' }
  if (error || !grid?.length) return { ok: false, created: 0, updated: 0, errors: [], error: error || 'Fichier vide' }

  const map = headerMap(grid[0])
  let created = 0
  let updated = 0
  const errors: string[] = []
  db.transaction(() => {
    for (let i = 1; i < grid.length; i++) {
      const row = grid[i]
      const name = cell(row, map, ['Nom du client', 'Nom complet', 'Nom', 'Client', 'Raison sociale', 'Désignation'])
      if (!name) continue
      try {
        const phone = cell(row, map, ['Téléphone', 'Telephone', 'Contact', 'Mobile', 'GSM', 'Tél', 'Tel', 'Numéro', 'Portable'])
        const email = cell(row, map, ['Email', 'E-mail', 'Mail'])
        const address = cell(row, map, ['Adresse', 'Adress', 'Ville'])
        let notes = cell(row, map, ['Notes', 'Note', 'Remarque', 'Observation'])
        // Le solde de l'ancien logiciel devient un "solde de départ" visible dans Crédit
        const soldeS = cell(row, map, ['Solde CLS', 'Solde client', 'Solde', 'Crédit', 'Credit', 'Reste', 'Dû', 'Du'])
        const solde = toNum(soldeS)
        const code = cell(row, map, ['Code client', 'Code'])
        if (code) notes = notes ? `${notes} · Code: ${code}` : `Code: ${code}`

        // Dédoublonnage par NOM, insensible à la casse (des clients distincts peuvent partager un téléphone)
        const existing: any = db.row('SELECT * FROM customers WHERE name=? COLLATE NOCASE', [name])
        if (existing) {
          db.run('UPDATE customers SET name=?, phone=?, email=?, address=?, notes=?, opening_balance=? WHERE id=?', [name, phone || existing.phone, email || existing.email, address || existing.address, notes || existing.notes, solde, existing.id])
          updated++
        } else {
          const r = customersRepo.create({ name, phone, email, address, notes })
          if (r.id && solde > 0) db.run('UPDATE customers SET opening_balance=? WHERE id=?', [solde, r.id])
          created++
        }
      } catch (e: any) {
        errors.push(`Ligne ${i + 1} (${name}) : ${e?.message || e}`)
      }
    }
  })
  return { ok: created + updated > 0, created, updated, errors }
}

export async function importFournisseurs(win: BrowserWindow | null): Promise<ImportResult> {
  const { grid, error, canceled } = await openGrid(win, 'Fournisseurs')
  if (canceled) return { ok: false, created: 0, updated: 0, errors: [], error: 'Annulé' }
  if (error || !grid?.length) return { ok: false, created: 0, updated: 0, errors: [], error: error || 'Fichier vide' }

  const map = headerMap(grid[0])
  let created = 0
  let updated = 0
  const errors: string[] = []
  db.transaction(() => {
    for (let i = 1; i < grid.length; i++) {
      const row = grid[i]
      const name = cell(row, map, ['Nom', 'Fournisseur', 'Raison sociale', 'Désignation', 'Nom du fournisseur'])
      if (!name) continue
      try {
        const phone = cell(row, map, ['Téléphone', 'Telephone', 'Contact', 'Mobile', 'GSM', 'Tél', 'Tel', 'Numéro'])
        const address = cell(row, map, ['Adresse', 'Adress', 'Ville'])
        const notes = cell(row, map, ['Notes', 'Note', 'Remarque', 'Observation'])
        const existing: any = db.row('SELECT * FROM suppliers WHERE name=? COLLATE NOCASE', [name])
        if (existing) {
          db.run('UPDATE suppliers SET name=?, phone=?, address=?, notes=? WHERE id=?', [name, phone || existing.phone, address || existing.address, notes || existing.notes, existing.id])
          updated++
        } else {
          suppliersRepo.create({ name, phone, address, notes })
          created++
        }
      } catch (e: any) {
        errors.push(`Ligne ${i + 1} (${name}) : ${e?.message || e}`)
      }
    }
  })
  return { ok: created + updated > 0, created, updated, errors }
}

export async function importImei(win: BrowserWindow | null): Promise<ImportResult> {
  const { grid, error, canceled } = await openGrid(win, 'IMEI')
  if (canceled) return { ok: false, created: 0, updated: 0, errors: [], error: 'Annulé' }
  if (error || !grid?.length) return { ok: false, created: 0, updated: 0, errors: [], error: error || 'Fichier vide' }

  const map = headerMap(grid[0])
  let created = 0
  const errors: string[] = []
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i]
    const imei = cell(row, map, ['IMEI', 'IMEI 1', 'Numéro de série', 'Numero de serie', 'Serial'])
    const productRef = cell(row, map, ['Produit (SKU ou Nom)', 'Produit', 'SKU', 'Nom', 'Modèle', 'Modele'])
    if (!imei || !productRef) continue
    try {
      let product: any = db.row('SELECT * FROM products WHERE sku=?', [productRef])
      if (!product) product = db.row('SELECT * FROM products WHERE name=?', [productRef])
      if (!product) {
        errors.push(`Ligne ${i + 1} : produit « ${productRef} » introuvable`)
        continue
      }
      const r = imeiRepo.add({
        product_id: product.id,
        imei,
        serial: cell(row, map, ['Série', 'Serie', 'Serial']) || undefined,
        cost_price: toNum(cell(row, map, ['Prix achat', 'Achat'])) || product.cost_price,
        sale_price: toNum(cell(row, map, ['Prix vente', 'Vente'])) || product.sale_price,
        warranty_months: toNum(cell(row, map, ['Garantie (mois)', 'Garantie'])) || product.warranty_months
      })
      if (r.ok) created++
      else errors.push(`Ligne ${i + 1} : ${r.error}`)
    } catch (e: any) {
      errors.push(`Ligne ${i + 1} : ${e?.message || e}`)
    }
  }
  return { ok: created > 0, created, updated: 0, errors }
}

// Parse un fichier Excel fournisseur pour pré-remplir un bon de réception.
// Retourne les lignes parsées (preview) sans toucher la base.
export interface ParsedReceptionRow {
  product_name: string
  qty: number
  unit_cost: number
  sale_price: number
  sale_price2: number
  sale_price3: number
  barcode: string
  brand: string
  category: string
  notes: string
  product_id: number | null
}

export async function parseReceptionExcel(win: BrowserWindow | null): Promise<{ ok: boolean; rows?: ParsedReceptionRow[]; error?: string }> {
  const { grid, error, canceled } = await openGrid(win)
  if (canceled) return { ok: false, error: 'Annulé' }
  if (error || !grid?.length) return { ok: false, error: error || 'Fichier vide' }

  const map = headerMap(grid[0])
  const rows: ParsedReceptionRow[] = []

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i]
    const name = cell(row, map, ['Nom du produit', 'Nom', 'Designation', 'Désignation', 'Produit', 'Libellé', 'Article', 'Description'])
    if (!name) continue
    const barcode = cell(row, map, ['Code-barres', 'Code barre', 'Barcode', 'EAN', 'Code à barres'])
    const qty = toNum(cell(row, map, ['Quantité', 'Quantite', 'Qté', 'Qte', 'Qty', 'Qt', 'Nbr', 'Nombre'])) || 1
    const cost = toNum(cell(row, map, ['Prix achat', "Prix d'achat", 'Achat', 'Cout', 'Coût', 'PA', 'Prix unitaire', 'PU']))
    const price = toNum(cell(row, map, ['Prix vente', 'Prix de vente', 'Vente', 'Prix', 'PV', 'Prix TTC']))
    const price2 = toNum(cell(row, map, ['Prix vente 2', 'Prix vente2', '2ème prix', '2eme prix', 'Prix 2', 'PV2']))
    const price3 = toNum(cell(row, map, ['Prix vente 3', 'Prix vente3', '3ème prix', '3eme prix', 'Prix 3', 'PV3']))
    const brand = cell(row, map, ['Marque', 'Brand'])
    const category = cell(row, map, ['Catégorie', 'Categorie', 'Famille', 'Rayon'])
    const notes = cell(row, map, ['Notes', 'Note', 'Remarque', 'Remarques', 'Observation'])

    let product_id: number | null = null
    if (barcode) {
      const p = db.row<{ id: number }>('SELECT id FROM products WHERE barcode=? AND is_active=1', [barcode])
      if (p) product_id = p.id
    }
    if (!product_id) {
      const p = db.row<{ id: number }>('SELECT id FROM products WHERE name=? COLLATE NOCASE AND is_active=1', [name])
      if (p) product_id = p.id
    }

    if (product_id) {
      const existing = db.row<{ cost_price: number; sale_price: number; sale_price2: number; sale_price3: number; brand: string | null; barcode: string | null }>(
        'SELECT cost_price, sale_price, sale_price2, sale_price3, brand, barcode FROM products WHERE id=?', [product_id]
      )
      rows.push({
        product_name: name, qty,
        unit_cost: cost || existing?.cost_price || 0,
        sale_price: price || existing?.sale_price || 0,
        sale_price2: price2 || existing?.sale_price2 || 0,
        sale_price3: price3 || existing?.sale_price3 || 0,
        barcode: barcode || existing?.barcode || '',
        brand: brand || existing?.brand || '',
        category, notes, product_id
      })
    } else {
      rows.push({
        product_name: name, qty, unit_cost: cost, sale_price: price,
        sale_price2: price2, sale_price3: price3,
        barcode, brand, category, notes, product_id: null
      })
    }
  }

  if (!rows.length) return { ok: false, error: 'Aucun produit trouvé dans le fichier' }
  return { ok: true, rows }
}
