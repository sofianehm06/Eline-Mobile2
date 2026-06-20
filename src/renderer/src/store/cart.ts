import { create } from 'zustand'
import type { CartItem, ImeiUnit, Product } from '@shared/types'

const STORAGE_KEY = 'pos_cart_backup'

interface CartData {
  items: CartItem[]
  globalDiscount: number
  customerId: number | null
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit'
}

function saveCart(state: CartData): void {
  try {
    if (state.items.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  } catch { /* quota exceeded — non-fatal */ }
}

function loadCart(): CartData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [], globalDiscount: 0, customerId: null, paymentMethod: 'cash' }
    const d = JSON.parse(raw) as CartData
    if (!Array.isArray(d.items)) return { items: [], globalDiscount: 0, customerId: null, paymentMethod: 'cash' }
    return d
  } catch {
    return { items: [], globalDiscount: 0, customerId: null, paymentMethod: 'cash' }
  }
}

interface CartState extends CartData {
  addProduct: (p: Product, unit?: ImeiUnit) => string | null
  setQty: (key: string, qty: number) => void
  setUnitPrice: (key: string, price: number) => void
  setLineDiscount: (key: string, discount: number) => void
  remove: (key: string) => void
  clear: () => void
  setGlobalDiscount: (n: number) => void
  setCustomer: (id: number | null) => void
  setPayment: (m: 'cash' | 'card' | 'transfer' | 'credit') => void
}

const restored = loadCart()

export const useCart = create<CartState>((set, get) => ({
  items: restored.items,
  globalDiscount: restored.globalDiscount,
  customerId: restored.customerId,
  paymentMethod: restored.paymentMethod,

  addProduct: (p, unit) => {
    const tracksImei = p.tracks_imei === 1
    if (tracksImei && !unit) return 'imei-required' // l'appelant doit choisir un IMEI
    const key = unit ? `u${unit.id}` : `p${p.id}`
    const existing = get().items.find((i) => i.key === key)

    if (existing) {
      if (unit) return null // un IMEI ne peut être ajouté qu'une fois
      const max = existing.max_qty
      const qty = Math.min(existing.qty + 1, max)
      set({ items: get().items.map((i) => (i.key === key ? { ...i, qty } : i)) })
      return null
    }

    const item: CartItem = {
      key,
      product_id: p.id,
      imei_unit_id: unit ? unit.id : null,
      imei: unit ? unit.imei : null,
      name: unit ? `${p.name} (IMEI ${unit.imei})` : p.name,
      qty: 1,
      unit_price: unit ? unit.sale_price ?? p.sale_price : p.sale_price,
      cost_price: unit ? unit.cost_price : p.cost_price,
      sale_price: unit ? unit.sale_price ?? p.sale_price : p.sale_price,
      sale_price2: p.sale_price2 || 0,
      sale_price3: p.sale_price3 || 0,
      discount: 0,
      tax_rate: p.tax_rate,
      max_qty: unit ? 1 : p.available_stock ?? 0,
      tracks_imei: tracksImei
    }
    const items = [...get().items, item]
    set({ items })
    saveCart({ items, globalDiscount: get().globalDiscount, customerId: get().customerId, paymentMethod: get().paymentMethod })
    return null
  },

  setQty: (key, qty) => {
    const items = get().items.map((i) =>
      i.key === key ? { ...i, qty: Math.max(1, Math.min(qty, i.max_qty || qty)) } : i
    )
    set({ items })
    saveCart({ items, globalDiscount: get().globalDiscount, customerId: get().customerId, paymentMethod: get().paymentMethod })
  },
  setUnitPrice: (key, price) => {
    const items = get().items.map((i) => (i.key === key ? { ...i, unit_price: Math.max(0, price) } : i))
    set({ items })
    saveCart({ items, globalDiscount: get().globalDiscount, customerId: get().customerId, paymentMethod: get().paymentMethod })
  },
  setLineDiscount: (key, discount) => {
    const items = get().items.map((i) => (i.key === key ? { ...i, discount: Math.max(0, discount) } : i))
    set({ items })
    saveCart({ items, globalDiscount: get().globalDiscount, customerId: get().customerId, paymentMethod: get().paymentMethod })
  },
  remove: (key) => {
    const items = get().items.filter((i) => i.key !== key)
    set({ items })
    saveCart({ items, globalDiscount: get().globalDiscount, customerId: get().customerId, paymentMethod: get().paymentMethod })
  },
  clear: () => {
    set({ items: [], globalDiscount: 0, customerId: null, paymentMethod: 'cash' })
    saveCart({ items: [], globalDiscount: 0, customerId: null, paymentMethod: 'cash' })
  },
  setGlobalDiscount: (n) => {
    set({ globalDiscount: Math.max(0, n) })
    saveCart({ items: get().items, globalDiscount: Math.max(0, n), customerId: get().customerId, paymentMethod: get().paymentMethod })
  },
  setCustomer: (id) => {
    set({ customerId: id })
    saveCart({ items: get().items, globalDiscount: get().globalDiscount, customerId: id, paymentMethod: get().paymentMethod })
  },
  setPayment: (m) => {
    set({ paymentMethod: m })
    saveCart({ items: get().items, globalDiscount: get().globalDiscount, customerId: get().customerId, paymentMethod: m })
  }
}))

export function cartTotals(items: CartItem[], globalDiscount: number) {
  const gross = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const lineDiscounts = items.reduce((s, i) => s + i.discount, 0)
  const subtotal = gross
  const totalDiscount = lineDiscounts + globalDiscount
  const total = Math.max(0, subtotal - totalDiscount)
  const taxBefore = items.reduce((s, i) => {
    const lt = i.qty * i.unit_price - i.discount
    const r = i.tax_rate || 0
    return s + (lt * r) / (100 + r)
  }, 0)
  const factor = gross - lineDiscounts > 0 ? total / (gross - lineDiscounts) : 1
  const tax = taxBefore * factor
  const count = items.reduce((s, i) => s + i.qty, 0)
  return { gross, subtotal, totalDiscount, total, tax, count }
}
