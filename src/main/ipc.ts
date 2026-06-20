import { ipcMain, BrowserWindow, dialog } from 'electron'
import {
  categoriesRepo,
  creditRepo,
  customerStatementRepo,
  customersRepo,
  dashboardRepo,
  imeiRepo,
  lossesRepo,
  lossTypesRepo,
  productsRepo,
  purchaseOrdersRepo,
  reportsRepo,
  salesRepo,
  settingsRepo,
  stockRepo,
  suppliersRepo,
  tradeinRepo,
  loadSampleData
} from './db/repo'
import { printReceipt, listPrinters, printHtml } from './printing'
import { backupDatabase, restoreDatabase, chooseBackupDir } from './backup'
import { resetBusinessData } from './db/database'
import { printWarranty, printCreditReceipt } from './printing'
import { getLicenseStatus, activateLicense, activateFromFile } from './license'
import {
  exportAll, exportTemplate, importProducts, importCustomers, importImei, importFournisseurs,
  exportProducts, exportClients, exportFournisseurs, exportVentes, exportPertes,
  exportReceptions, exportStock, exportCredit, exportReprise, exportStatement,
  parseReceptionExcel
} from './excel'

type Handler = (params: any, win: BrowserWindow | null) => any

const routes: Record<string, Handler> = {
  // Settings
  'settings.get': () => settingsRepo.getAll(),
  'settings.update': (p, win) => {
    const r = settingsRepo.update(p)
    if (p.store_name !== undefined && win) {
      win.setTitle(p.store_name || 'POS — Gestion de boutique')
    }
    return r
  },

  // Categories
  'categories.list': () => categoriesRepo.list(),
  'categories.create': (p) => categoriesRepo.create(p),
  'categories.update': (p) => categoriesRepo.update(p),
  'categories.remove': (p) => categoriesRepo.remove(p.id),

  // Products
  'products.list': (p) => productsRepo.list(p || {}),
  'products.get': (p) => productsRepo.get(p.id),
  'products.scan': (p) => productsRepo.scan(p.code),
  'products.nextBarcode': () => productsRepo.nextBarcode(),
  'products.create': (p) => productsRepo.create(p),
  'products.update': (p) => productsRepo.update(p),
  'products.remove': (p) => productsRepo.remove(p.id),
  'products.receiveStock': (p) => productsRepo.receiveStock(p),
  'products.adjustStock': (p) => productsRepo.adjustStock(p),
  'products.lowStock': (p) => productsRepo.lowStock(p?.threshold),
  'products.suggest': (p) => productsRepo.suggest(p?.query || ''),

  // IMEI
  'imei.list': (p) => imeiRepo.list(p || {}),
  'imei.add': (p) => imeiRepo.add(p),
  'imei.addBulk': (p) => imeiRepo.addBulk(p),
  'imei.update': (p) => imeiRepo.update(p),
  'imei.remove': (p) => imeiRepo.remove(p.id),
  'imei.find': (p) => imeiRepo.findByImei(p.imei),

  // Suppliers
  'suppliers.list': () => suppliersRepo.list(),
  'suppliers.create': (p) => suppliersRepo.create(p),
  'suppliers.update': (p) => suppliersRepo.update(p),
  'suppliers.remove': (p) => suppliersRepo.remove(p.id),

  // Customers
  'customers.list': (p) => customersRepo.list(p?.search),
  'customers.create': (p) => customersRepo.create(p),
  'customers.update': (p) => customersRepo.update(p),
  'customers.remove': (p) => customersRepo.remove(p.id),

  // Sales
  'sales.create': (p) => salesRepo.create(p),
  'sales.list': (p) => salesRepo.list(p || {}),
  'sales.get': (p) => salesRepo.get(p.id),
  'sales.refund': (p) => salesRepo.refund(p.id, p.items),

  // Stock movements
  'stock.movements': (p) => stockRepo.movements(p || {}),

  // Dashboard & reports
  'dashboard.stats': () => dashboardRepo.stats(),
  'reports.byPeriod': (p) => reportsRepo.byPeriod(p),
  'reports.topProducts': (p) => reportsRepo.topProducts(p),
  'reports.summary': (p) => reportsRepo.summary(p),

  // Impression
  'print.receipt': (p, win) => printReceipt(p.sale, win),
  'print.html': (p, win) => printHtml(p.html, win, p.options),
  'print.listPrinters': (_p, win) => listPrinters(win),

  // Reprise d'occasion
  'tradein.list': () => tradeinRepo.list(),
  'tradein.stats': () => tradeinRepo.stats(),
  'tradein.create': (p) => tradeinRepo.create(p),

  // Crédit / ardoise
  'credit.debtors': () => creditRepo.debtors(),
  'credit.summary': () => creditRepo.summary(),
  'credit.balance': (p) => creditRepo.balance(p.customer_id),
  'credit.ledger': (p) => creditRepo.ledger(p.customer_id),
  'credit.addPayment': (p) => creditRepo.addPayment(p),
  'credit.printReceipt': (p, win) => printCreditReceipt(p.data, win),

  // Import / Export Excel
  'excel.exportAll': (_p, win) => exportAll(win),
  'excel.exportProducts': (_p, win) => exportProducts(win),
  'excel.exportClients': (_p, win) => exportClients(win),
  'excel.exportFournisseurs': (_p, win) => exportFournisseurs(win),
  'excel.exportVentes': (p, win) => exportVentes(win, p?.from, p?.to),
  'excel.exportPertes': (p, win) => exportPertes(win, p?.from, p?.to),
  'excel.exportReceptions': (p, win) => exportReceptions(win, p?.from, p?.to),
  'excel.exportStock': (_p, win) => exportStock(win),
  'excel.exportCredit': (_p, win) => exportCredit(win),
  'excel.exportReprise': (p, win) => exportReprise(win, p?.from, p?.to),
  'excel.exportStatement': (p, win) => exportStatement(win, p.customer_id),
  'excel.template': (p, win) => exportTemplate(win, p.kind),
  'excel.importProducts': (_p, win) => importProducts(win),
  'excel.importCustomers': (_p, win) => importCustomers(win),
  'excel.importImei': (_p, win) => importImei(win),
  'excel.importFournisseurs': (_p, win) => importFournisseurs(win),

  // Sauvegarde / restauration
  'backup.create': (_p, win) => backupDatabase(win),
  'backup.restore': (_p, win) => restoreDatabase(win),
  'backup.chooseDir': (_p, win) => chooseBackupDir(win),
  'data.reset': async (_p, win) => {
    const c = await dialog.showMessageBox(win!, {
      type: 'warning',
      buttons: ['Annuler', 'Tout effacer'],
      defaultId: 0,
      cancelId: 0,
      title: 'Réinitialiser les données',
      message: 'Effacer TOUTES les données (produits, ventes, clients, IMEI, crédit) ?',
      detail: 'Les paramètres et la licence sont conservés. Cette action est IRRÉVERSIBLE.'
    })
    if (c.response !== 1) return { ok: false, error: 'Annulé' }
    resetBusinessData()
    return { ok: true }
  },
  'data.loadSamples': () => loadSampleData(),

  // Pertes
  'lossTypes.list': () => lossTypesRepo.list(),
  'lossTypes.create': (p) => lossTypesRepo.create(p.name),
  'lossTypes.remove': (p) => lossTypesRepo.remove(p.id),
  'losses.list': () => lossesRepo.list(),
  'losses.create': (p) => lossesRepo.create(p),
  'losses.summary': () => lossesRepo.summary(),

  // Bons de réception
  'po.list': (p) => purchaseOrdersRepo.list(p || {}),
  'po.get': (p) => purchaseOrdersRepo.get(p.id),
  'po.create': (p) => purchaseOrdersRepo.create(p),
  'po.update': (p) => purchaseOrdersRepo.update(p),
  'po.remove': (p) => purchaseOrdersRepo.remove(p.id),
  'po.addItem': (p) => purchaseOrdersRepo.addItem(p),
  'po.updateItem': (p) => purchaseOrdersRepo.updateItem(p),
  'po.removeItem': (p) => purchaseOrdersRepo.removeItem(p.id),
  'po.validate': (p) => purchaseOrdersRepo.validate(p.id),
  'po.parseExcel': (_p, win) => parseReceptionExcel(win),

  // Relevé client
  'customers.statement': (p) => customerStatementRepo.get(p.customer_id),

  // Garantie
  'warranty.print': (p, win) => printWarranty(p.data, win),

  // Licence
  'license.status': () => getLicenseStatus(),
  'license.activate': (p) => activateLicense(p.key),
  'license.activateFile': (_p, win) => activateFromFile(win)
}

export function registerIpc(): void {
  ipcMain.handle('api', async (event, payload: { action: string; params?: any }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const handler = routes[payload.action]
    if (!handler) {
      return { ok: false, error: `Action inconnue: ${payload.action}` }
    }
    try {
      return await handler(payload.params || {}, win)
    } catch (err: any) {
      console.error(`[IPC] ${payload.action} a échoué:`, err)
      return { ok: false, error: err?.message || String(err) }
    }
  })

  // Boîte de dialogue de confirmation native (optionnel)
  ipcMain.handle('dialog.message', async (event, opts) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return dialog.showMessageBox(win!, opts)
  })
}
