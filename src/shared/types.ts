// Types partagés entre le processus principal (base de données) et l'interface.

export type ProductType = 'phone' | 'accessory'

export interface Category {
  id: number
  name: string
  color: string
  created_at: string
}

export interface Product {
  id: number
  sku: string
  barcode: string | null
  name: string
  brand: string | null
  model: string | null
  category_id: number | null
  category_name?: string | null
  supplier_id: number | null
  supplier_name?: string | null
  type: ProductType
  tracks_imei: 0 | 1
  cost_price: number
  sale_price: number
  sale_price2: number
  sale_price3: number
  tax_rate: number
  stock_qty: number // pour les produits sans IMEI
  min_stock: number
  warranty_months: number
  image: string | null
  notes: string | null
  is_active: 0 | 1
  created_at: string
  updated_at: string
  // Calculés
  available_stock?: number // pour IMEI = nombre d'unités en stock
}

export type ImeiStatus = 'in_stock' | 'sold' | 'returned' | 'reserved' | 'lost'

export interface ImeiUnit {
  id: number
  product_id: number
  product_name?: string
  imei: string
  serial: string | null
  status: ImeiStatus
  cost_price: number
  sale_price: number | null
  supplier_id: number | null
  supplier_name?: string | null
  purchase_date: string | null
  sale_id: number | null
  sale_ref?: string | null
  sale_datetime?: string | null
  sale_customer?: string | null
  warranty_months: number
  condition?: string | null
  notes: string | null
  created_at: string
}

export interface TradeIn {
  id: number
  datetime: string
  customer_id: number | null
  customer_name?: string | null
  product_id: number | null
  imei_unit_id: number | null
  model: string
  imei: string | null
  condition: string | null
  buy_price: number
  resale_price: number
  note: string | null
  unit_status?: string | null // statut de l'unité revendue
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  // Calculés
  total_spent?: number
  purchases_count?: number
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit'
export type SaleStatus = 'completed' | 'partial' | 'refunded'

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number | null
  imei_unit_id: number | null
  imei?: string | null
  name: string
  qty: number
  unit_price: number
  cost_price: number
  discount: number
  tax_rate: number
  line_total: number
  refunded_qty?: number
}

export interface Sale {
  id: number
  ref: string
  datetime: string
  customer_id: number | null
  customer_name?: string | null
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  change_due: number
  payment_method: PaymentMethod
  status: SaleStatus
  note: string | null
  items?: SaleItem[]
}

export interface CartItem {
  key: string
  product_id: number
  imei_unit_id: number | null
  imei: string | null
  name: string
  qty: number
  unit_price: number
  cost_price: number
  sale_price: number // 1er prix de vente
  sale_price2: number // 2ème prix de vente
  sale_price3: number // 3ème prix de vente
  discount: number
  tax_rate: number
  max_qty: number // stock disponible
  tracks_imei: boolean
}

export type StockMovementType = 'in' | 'out' | 'adjust' | 'sale' | 'return'

export interface StockMovement {
  id: number
  product_id: number
  product_name?: string
  imei_unit_id: number | null
  type: StockMovementType
  qty: number
  reason: string | null
  ref: string | null
  unit_cost: number
  datetime: string
}

export interface Settings {
  store_name: string
  store_address: string
  store_phone: string
  store_email: string
  store_rc: string // Registre de commerce
  store_nif: string // N° d'identification fiscale
  store_ai: string // Article d'imposition
  currency: string
  currency_decimals: number
  tax_rate: number
  receipt_header: string
  receipt_footer: string
  receipt_width: '58' | '80'
  printer_name: string // imprimante tickets de caisse
  label_printer_name: string // imprimante étiquettes / codes-barres
  print_dialog: number // 0 = impression auto (silencieuse), 1 = afficher la boîte de dialogue
  logo: string // base64 data URL
  low_stock_alert: number
  pin_code: string // code patron (vide = pas de protection)
  auto_backup: number // 0/1
  auto_backup_dir: string
  license_key: string // clé d'activation liée au PC
}

// Crédit / ardoise
export interface CustomerPayment {
  id: number
  customer_id: number
  sale_id: number | null
  amount: number
  method: PaymentMethod
  note: string | null
  datetime: string
}

export interface CreditDebtor {
  id: number
  name: string
  phone: string | null
  balance: number
  last_movement: string | null
}

export interface LedgerEntry {
  type: 'sale' | 'payment' | 'opening'
  datetime: string
  ref: string
  debit: number // ce que le client doit (vente à crédit)
  credit: number // ce que le client a payé
  method?: string
  note?: string | null
  balance?: number // solde courant (calculé)
}

export interface CreditSummary {
  total_due: number
  debtors_count: number
}

export interface ImportResult {
  ok: boolean
  created: number
  updated: number
  errors: string[]
  error?: string
}

// Données du tableau de bord
export interface DashboardStats {
  today_sales_count: number
  today_revenue: number
  today_profit: number
  month_revenue: number
  month_profit: number
  total_products: number
  low_stock_count: number
  stock_value: number
  imei_in_stock: number
  sales_last_14_days: { date: string; revenue: number; count: number }[]
  top_products: { name: string; qty: number; revenue: number }[]
  recent_sales: Sale[]
  low_stock_products: Product[]
}

export interface ReportRow {
  period: string
  count: number
  revenue: number
  cost: number
  profit: number
}

// Pertes
export interface LossType {
  id: number
  name: string
  created_at: string
}

export interface Loss {
  id: number
  product_id: number | null
  imei_unit_id: number | null
  loss_type_id: number | null
  loss_type_name?: string | null
  qty: number
  unit_cost: number
  product_name: string | null
  reason: string | null
  note: string | null
  datetime: string
}

// Bons de réception fournisseur
export type PurchaseOrderStatus = 'draft' | 'validated'

export interface PurchaseOrder {
  id: number
  ref: string
  supplier_id: number
  supplier_name?: string
  status: PurchaseOrderStatus
  total_cost: number
  total_items: number
  note: string | null
  created_at: string
  validated_at: string | null
  items?: PurchaseOrderItem[]
}

export interface POItemDetail extends PurchaseOrderItem {
  qty_sold: number
  revenue: number
  gain: number
}

export const PHONE_BRANDS = [
  'Samsung', 'Xiaomi', 'Apple', 'Oppo', 'Realme', 'Tecno', 'Infinix', 'Itel',
  'Nokia', 'Huawei', 'Honor', 'Vivo', 'Motorola', 'OnePlus', 'ZTE', 'Lenovo',
  'Google', 'Sony', 'LG', 'Alcatel', 'Wiko', 'TCL', 'Nothing', 'Poco',
  'Redmi', 'Doogee', 'Oukitel', 'Umidigi', 'Blackview', 'Cubot'
]

export interface PurchaseOrderItem {
  id: number
  order_id: number
  product_id: number | null
  product_name: string
  qty: number
  unit_cost: number
  sale_price: number
  sale_price2: number
  sale_price3: number
  barcode: string | null
  brand: string | null
  category_id: number | null
  notes: string | null
}

// Relevé client détaillé
export interface CustomerStatement {
  customer: Customer
  credit_balance: number
  total_purchases: number
  total_paid: number
  entries: CustomerStatementEntry[]
}

export interface CustomerStatementEntry {
  type: 'sale' | 'payment' | 'tradein' | 'refund'
  datetime: string
  ref: string
  description: string
  amount: number
  detail?: string
}

// Résultat générique d'opérations
export interface OpResult {
  ok: boolean
  id?: number
  ref?: string
  error?: string
}
