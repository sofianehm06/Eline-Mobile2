import type {
  Category,
  CreditDebtor,
  CreditSummary,
  Customer,
  CustomerStatement,
  DashboardStats,
  ImeiUnit,
  ImportResult,
  LedgerEntry,
  Loss,
  LossType,
  OpResult,
  Product,
  PurchaseOrder,
  ReportRow,
  Sale,
  Settings,
  StockMovement,
  Supplier,
  TradeIn
} from '@shared/types'

function invoke<T = any>(action: string, params?: unknown): Promise<T> {
  return window.api.invoke(action, params) as Promise<T>
}

export interface PrinterInfo {
  name: string
  displayName: string
  isDefault: boolean
}

export const api = {
  settings: {
    get: () => invoke<Settings>('settings.get'),
    update: (patch: Partial<Settings>) => invoke<OpResult>('settings.update', patch)
  },
  categories: {
    list: () => invoke<(Category & { product_count: number })[]>('categories.list'),
    create: (c: { name: string; color?: string }) => invoke<OpResult>('categories.create', c),
    update: (c: { id: number; name: string; color?: string }) => invoke<OpResult>('categories.update', c),
    remove: (id: number) => invoke<OpResult>('categories.remove', { id })
  },
  products: {
    list: (opts?: { search?: string; category_id?: number | null; supplier_id?: number | null; type?: string; active?: boolean }) =>
      invoke<Product[]>('products.list', opts),
    get: (id: number) => invoke<Product | undefined>('products.get', { id }),
    scan: (code: string) => invoke<{ product?: Product; imei_unit?: ImeiUnit } | null>('products.scan', { code }),
    nextBarcode: () => invoke<string>('products.nextBarcode'),
    create: (p: Partial<Product>) => invoke<OpResult>('products.create', p),
    update: (p: Partial<Product> & { id: number }) => invoke<OpResult>('products.update', p),
    remove: (id: number) => invoke<OpResult>('products.remove', { id }),
    receiveStock: (d: { product_id: number; qty: number; unit_cost?: number; supplier_id?: number | null; reason?: string }) =>
      invoke<OpResult>('products.receiveStock', d),
    adjustStock: (d: { product_id: number; new_qty: number; reason?: string }) =>
      invoke<OpResult>('products.adjustStock', d),
    lowStock: (threshold?: number) => invoke<Product[]>('products.lowStock', { threshold }),
    suggest: (query: string) => invoke<{ name: string; barcode: string | null; brand: string | null; category_id: number | null; type: string }[]>('products.suggest', { query })
  },
  imei: {
    list: (opts?: { product_id?: number; status?: string; search?: string }) => invoke<ImeiUnit[]>('imei.list', opts),
    add: (d: Partial<ImeiUnit> & { product_id: number; imei: string }) => invoke<OpResult>('imei.add', d),
    addBulk: (d: { product_id: number; imeis: string[]; cost_price?: number; sale_price?: number; supplier_id?: number | null; warranty_months?: number }) =>
      invoke<OpResult>('imei.addBulk', d),
    update: (d: Partial<ImeiUnit> & { id: number }) => invoke<OpResult>('imei.update', d),
    remove: (id: number) => invoke<OpResult>('imei.remove', { id }),
    find: (imei: string) => invoke<ImeiUnit | undefined>('imei.find', { imei })
  },
  suppliers: {
    list: () => invoke<Supplier[]>('suppliers.list'),
    create: (s: Partial<Supplier>) => invoke<OpResult>('suppliers.create', s),
    update: (s: Partial<Supplier> & { id: number }) => invoke<OpResult>('suppliers.update', s),
    remove: (id: number) => invoke<OpResult>('suppliers.remove', { id })
  },
  customers: {
    list: (search?: string) => invoke<Customer[]>('customers.list', { search }),
    create: (c: Partial<Customer>) => invoke<OpResult>('customers.create', c),
    update: (c: Partial<Customer> & { id: number }) => invoke<OpResult>('customers.update', c),
    remove: (id: number) => invoke<OpResult>('customers.remove', { id })
  },
  sales: {
    create: (input: unknown) => invoke<OpResult>('sales.create', input),
    list: (opts?: { from?: string; to?: string; search?: string; limit?: number }) => invoke<Sale[]>('sales.list', opts),
    get: (id: number) => invoke<Sale | undefined>('sales.get', { id }),
    refund: (id: number, items?: { sale_item_id: number; qty: number }[]) =>
      invoke<OpResult>('sales.refund', { id, items })
  },
  stock: {
    movements: (opts?: { product_id?: number; limit?: number }) => invoke<StockMovement[]>('stock.movements', opts)
  },
  dashboard: {
    stats: () => invoke<DashboardStats>('dashboard.stats')
  },
  reports: {
    byPeriod: (opts: { from: string; to: string; group: 'day' | 'month' }) => invoke<ReportRow[]>('reports.byPeriod', opts),
    topProducts: (opts: { from: string; to: string; limit?: number }) =>
      invoke<{ name: string; qty: number; revenue: number; profit: number }[]>('reports.topProducts', opts),
    summary: (opts: { from: string; to: string }) =>
      invoke<{ revenue: number; cost: number; profit: number; count: number }>('reports.summary', opts)
  },
  print: {
    receipt: (sale: Sale) => invoke<{ ok: boolean; error?: string }>('print.receipt', { sale }),
    html: (html: string, options?: { deviceName?: string; widthMm?: number; silent?: boolean; label?: boolean }) =>
      invoke<{ ok: boolean; error?: string }>('print.html', { html, options }),
    listPrinters: () => invoke<PrinterInfo[]>('print.listPrinters')
  },
  tradein: {
    list: () => invoke<TradeIn[]>('tradein.list'),
    stats: () => invoke<{ count: number; total_bought: number; in_stock: number; potential_margin: number }>('tradein.stats'),
    create: (d: {
      customer_id?: number | null
      product_id?: number | null
      model?: string
      imei: string
      condition: string
      buy_price: number
      resale_price: number
      note?: string
    }) => invoke<OpResult>('tradein.create', d)
  },
  credit: {
    debtors: () => invoke<CreditDebtor[]>('credit.debtors'),
    summary: () => invoke<CreditSummary>('credit.summary'),
    balance: (customer_id: number) => invoke<number>('credit.balance', { customer_id }),
    ledger: (customer_id: number) => invoke<LedgerEntry[]>('credit.ledger', { customer_id }),
    addPayment: (d: { customer_id: number; amount: number; method?: string; note?: string; sale_id?: number | null }) =>
      invoke<OpResult>('credit.addPayment', d),
    printReceipt: (data: { customer_name: string; amount: number; method: string; new_balance: number }) =>
      invoke<{ ok: boolean; error?: string }>('credit.printReceipt', { data })
  },
  excel: {
    exportAll: () => invoke<OpResult>('excel.exportAll'),
    exportProducts: () => invoke<OpResult>('excel.exportProducts'),
    exportClients: () => invoke<OpResult>('excel.exportClients'),
    exportFournisseurs: () => invoke<OpResult>('excel.exportFournisseurs'),
    exportVentes: (from?: string, to?: string) => invoke<OpResult>('excel.exportVentes', { from, to }),
    exportPertes: (from?: string, to?: string) => invoke<OpResult>('excel.exportPertes', { from, to }),
    exportReceptions: (from?: string, to?: string) => invoke<OpResult>('excel.exportReceptions', { from, to }),
    exportStock: () => invoke<OpResult>('excel.exportStock'),
    exportCredit: () => invoke<OpResult>('excel.exportCredit'),
    exportReprise: (from?: string, to?: string) => invoke<OpResult>('excel.exportReprise', { from, to }),
    exportStatement: (customer_id: number) => invoke<OpResult>('excel.exportStatement', { customer_id }),
    template: (kind: 'produits' | 'clients' | 'imei' | 'fournisseurs') => invoke<OpResult>('excel.template', { kind }),
    importFournisseurs: () => invoke<ImportResult>('excel.importFournisseurs'),
    importProducts: () => invoke<ImportResult>('excel.importProducts'),
    importCustomers: () => invoke<ImportResult>('excel.importCustomers'),
    importImei: () => invoke<ImportResult>('excel.importImei')
  },
  backup: {
    create: () => invoke<OpResult>('backup.create'),
    restore: () => invoke<OpResult>('backup.restore'),
    chooseDir: () => invoke<{ ok: boolean; path?: string }>('backup.chooseDir')
  },
  data: {
    reset: () => invoke<OpResult>('data.reset'),
    loadSamples: () => invoke<OpResult>('data.loadSamples')
  },
  license: {
    status: () => invoke<{ activated: boolean; machineId: string; dev?: boolean }>('license.status'),
    activate: (key: string) => invoke<{ ok: boolean; error?: string }>('license.activate', { key }),
    activateFile: () => invoke<{ ok: boolean; error?: string }>('license.activateFile')
  },
  lossTypes: {
    list: () => invoke<LossType[]>('lossTypes.list'),
    create: (name: string) => invoke<OpResult>('lossTypes.create', { name }),
    remove: (id: number) => invoke<OpResult>('lossTypes.remove', { id })
  },
  losses: {
    list: () => invoke<Loss[]>('losses.list'),
    create: (d: { product_id: number; imei_unit_id?: number | null; loss_type_id?: number | null; qty: number; reason?: string; note?: string }) =>
      invoke<OpResult>('losses.create', d),
    summary: () => invoke<{ count: number; total_cost: number }>('losses.summary')
  },
  po: {
    list: (opts?: { supplier_id?: number; status?: string; search?: string }) => invoke<PurchaseOrder[]>('po.list', opts),
    get: (id: number) => invoke<PurchaseOrder | undefined>('po.get', { id }),
    create: (d: { supplier_id: number; note?: string }) => invoke<OpResult>('po.create', d),
    update: (d: { id: number; note?: string }) => invoke<OpResult>('po.update', d),
    remove: (id: number) => invoke<OpResult>('po.remove', { id }),
    addItem: (d: any) => invoke<OpResult>('po.addItem', d),
    updateItem: (d: any) => invoke<OpResult>('po.updateItem', d),
    removeItem: (id: number) => invoke<OpResult>('po.removeItem', { id }),
    validate: (id: number) => invoke<OpResult>('po.validate', { id }),
    parseExcel: () => invoke<{ ok: boolean; rows?: { product_name: string; qty: number; unit_cost: number; sale_price: number; sale_price2: number; sale_price3: number; barcode: string; brand: string; category: string; notes: string; product_id: number | null }[]; error?: string }>('po.parseExcel')
  },
  customerStatement: {
    get: (customer_id: number) => invoke<CustomerStatement | undefined>('customers.statement', { customer_id })
  },
  warranty: {
    print: (data: {
      product_name: string
      imei: string
      customer_name?: string | null
      start_date: string
      end_date: string
      warranty_months: number
      active: boolean
    }) => invoke<{ ok: boolean; error?: string }>('warranty.print', { data })
  }
}
