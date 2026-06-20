// Schéma de la base de données SQLite (sql.js) — version 3.
// Les tables utilisent CREATE TABLE IF NOT EXISTS : ajouter une table ici
// la crée automatiquement au prochain démarrage, sans perte de données.
// Les colonnes ajoutées à des tables existantes passent par migrate() (database.ts).

export const SCHEMA_VERSION = 9

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT DEFAULT '#3563ff',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sku             TEXT UNIQUE,
  barcode         TEXT,
  name            TEXT NOT NULL,
  brand           TEXT,
  model           TEXT,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  type            TEXT NOT NULL DEFAULT 'accessory',
  tracks_imei     INTEGER NOT NULL DEFAULT 0,
  cost_price      REAL NOT NULL DEFAULT 0,
  sale_price      REAL NOT NULL DEFAULT 0,
  sale_price2     REAL NOT NULL DEFAULT 0,
  sale_price3     REAL NOT NULL DEFAULT 0,
  tax_rate        REAL NOT NULL DEFAULT 19,
  stock_qty       REAL NOT NULL DEFAULT 0,
  min_stock       REAL NOT NULL DEFAULT 0,
  warranty_months INTEGER NOT NULL DEFAULT 0,
  image           TEXT,
  notes           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now','localtime')),
  updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS imei_units (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  imei            TEXT NOT NULL UNIQUE,
  serial          TEXT,
  status          TEXT NOT NULL DEFAULT 'in_stock',
  cost_price      REAL NOT NULL DEFAULT 0,
  sale_price      REAL,
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date   TEXT,
  sale_id         INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  warranty_months INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ref            TEXT NOT NULL UNIQUE,
  datetime       TEXT DEFAULT (datetime('now','localtime')),
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  subtotal       REAL NOT NULL DEFAULT 0,
  discount       REAL NOT NULL DEFAULT 0,
  tax            REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  paid           REAL NOT NULL DEFAULT 0,
  change_due     REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status         TEXT NOT NULL DEFAULT 'completed',
  note           TEXT
);

CREATE TABLE IF NOT EXISTS sale_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id      INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  imei_unit_id INTEGER REFERENCES imei_units(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  qty          REAL NOT NULL DEFAULT 1,
  unit_price   REAL NOT NULL DEFAULT 0,
  cost_price   REAL NOT NULL DEFAULT 0,
  discount     REAL NOT NULL DEFAULT 0,
  tax_rate     REAL NOT NULL DEFAULT 0,
  line_total   REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER REFERENCES products(id) ON DELETE CASCADE,
  imei_unit_id INTEGER REFERENCES imei_units(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,
  qty          REAL NOT NULL DEFAULT 0,
  reason       TEXT,
  ref          TEXT,
  unit_cost    REAL NOT NULL DEFAULT 0,
  datetime     TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id     INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  amount      REAL NOT NULL DEFAULT 0,
  method      TEXT NOT NULL DEFAULT 'cash',
  note        TEXT,
  datetime    TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tradeins (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  datetime     TEXT DEFAULT (datetime('now','localtime')),
  customer_id  INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  imei_unit_id INTEGER REFERENCES imei_units(id) ON DELETE SET NULL,
  model        TEXT NOT NULL,
  imei         TEXT,
  condition    TEXT,
  buy_price    REAL NOT NULL DEFAULT 0,
  resale_price REAL NOT NULL DEFAULT 0,
  note         TEXT
);

CREATE TABLE IF NOT EXISTS loss_types (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS losses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER REFERENCES products(id) ON DELETE SET NULL,
  imei_unit_id   INTEGER REFERENCES imei_units(id) ON DELETE SET NULL,
  loss_type_id   INTEGER REFERENCES loss_types(id) ON DELETE SET NULL,
  qty            REAL NOT NULL DEFAULT 1,
  unit_cost      REAL NOT NULL DEFAULT 0,
  product_name   TEXT,
  reason         TEXT,
  note           TEXT,
  datetime       TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ref          TEXT,
  supplier_id  INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'draft',
  total_cost   REAL NOT NULL DEFAULT 0,
  total_items  INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TEXT DEFAULT (datetime('now','localtime')),
  validated_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id          INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name      TEXT NOT NULL,
  qty               REAL NOT NULL DEFAULT 1,
  unit_cost         REAL NOT NULL DEFAULT 0,
  sale_price        REAL NOT NULL DEFAULT 0,
  sale_price2       REAL NOT NULL DEFAULT 0,
  sale_price3       REAL NOT NULL DEFAULT 0,
  barcode           TEXT,
  brand             TEXT,
  category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_losses_product       ON losses(product_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier           ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_poi_order             ON purchase_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer    ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode   ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name       ON products(name);
CREATE INDEX IF NOT EXISTS idx_imei_status         ON imei_units(status);
CREATE INDEX IF NOT EXISTS idx_imei_product        ON imei_units(product_id);
CREATE INDEX IF NOT EXISTS idx_imei_value          ON imei_units(imei);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale     ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_datetime      ON sales(datetime);
CREATE INDEX IF NOT EXISTS idx_sales_customer      ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status        ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_payment       ON sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_products_active     ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier   ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_movements_product   ON stock_movements(product_id);
`

// Catégories proposées par défaut au premier lancement (boutique de téléphones).
export const DEFAULT_CATEGORIES: [string, string][] = [
  ['Téléphones', '#3563ff'],
  ["Téléphones d'occasion", '#0ea5e9'],
  ['Tablettes', '#6366f1'],
  ['Coques & Protections', '#16a34a'],
  ['Verres trempés', '#14b8a6'],
  ['Chargeurs & Câbles', '#f59e0b'],
  ['Écouteurs & Audio', '#a855f7'],
  ['Powerbanks & Batteries', '#ef4444'],
  ['Cartes mémoire & SIM', '#8b5cf6'],
  ['Montres connectées', '#ec4899'],
  ['Accessoires divers', '#64748b'],
  ['Réparation / Pièces', '#0891b2']
]

export const DEFAULT_LOSS_TYPES = ['Tombola', 'Cadeau', 'Casse', 'Vol', 'Périmé', 'Autre']

export const DEFAULT_SETTINGS: Record<string, string> = {
  schema_version: String(SCHEMA_VERSION),
  store_name: '',
  store_address: '',
  store_phone: '',
  store_email: '',
  store_rc: '',
  store_nif: '',
  store_ai: '',
  currency: 'DA',
  currency_decimals: '2',
  tax_rate: '0',
  receipt_header: '',
  receipt_footer: 'Merci de votre visite !\nÉchange sous 48h avec ticket.',
  receipt_width: '80',
  printer_name: '',
  label_printer_name: '',
  print_dialog: '0',
  logo: '',
  low_stock_alert: '5',
  pin_code: '',
  auto_backup: '0',
  auto_backup_dir: '',
  license_key: ''
}
