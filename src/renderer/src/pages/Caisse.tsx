import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  X,
  ShoppingCart,
  Smartphone,
  Package,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Clock,
  UserPlus,
  CheckCircle2,
  Printer,
  Receipt,
  Tag,
  AlertTriangle
} from 'lucide-react'
import type { CartItem, Customer, ImeiUnit, Product, Sale } from '@shared/types'
import { api } from '../lib/api'
import { useAsync, useBarcodeScanner, useDebounced } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useRole } from '../lib/role'
import { money } from '../lib/format'
import { useCart, cartTotals } from '../store/cart'
import { Button, Modal, Input, NumberInput, Select, Badge, EmptyState, Spinner, Field } from '../components/ui'
import clsx from 'clsx'

export default function Caisse() {
  const toast = useToast()
  const { isAdmin } = useRole()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search, 200)
  const searchRef = useRef<HTMLInputElement>(null)
  const lastScan = useRef<{ code: string; t: number }>({ code: '', t: 0 })

  const cats = useAsync(() => api.categories.list(), [])
  const [catFilter, setCatFilter] = useState<number | ''>('')
  const [brandFilter, setBrandFilter] = useState('')
  const allProducts = useAsync(
    () => api.products.list({ search: debounced, category_id: catFilter || undefined }),
    [debounced, catFilter]
  )

  const selectedCatName = catFilter ? cats.data?.find(c => c.id === catFilter)?.name?.toLowerCase() || '' : ''
  const isPhoneCat = selectedCatName.includes('téléphone') || selectedCatName.includes('telephone')

  const brands = useMemo(() => {
    if (!isPhoneCat || !allProducts.data) return []
    const set = new Set<string>()
    for (const p of allProducts.data) if (p.brand) set.add(p.brand)
    return Array.from(set).sort()
  }, [isPhoneCat, allProducts.data])

  const products = useMemo(() => ({
    ...allProducts,
    data: brandFilter && allProducts.data
      ? allProducts.data.filter(p => p.brand === brandFilter)
      : allProducts.data,
    reload: allProducts.reload
  }), [allProducts, brandFilter])

  const cart = useCart()
  const totals = useMemo(() => cartTotals(cart.items, cart.globalDiscount), [cart.items, cart.globalDiscount])

  const [pickerProduct, setPickerProduct] = useState<Product | null>(null)
  const [paying, setPaying] = useState(false)
  const [priceCheck, setPriceCheck] = useState(false)
  const [lastSale, setLastSale] = useState<Sale | null>(null)

  const refocus = () => setTimeout(() => searchRef.current?.focus(), 30)

  const addProduct = (p: Product, unit?: ImeiUnit) => {
    if (p.tracks_imei === 1 && !unit) {
      setPickerProduct(p)
      return
    }
    if ((p.available_stock ?? 0) <= 0 && !unit) {
      toast.error(`${p.name} en rupture de stock`)
      return
    }
    cart.addProduct(p, unit)
  }

  const addByCode = async (code: string) => {
    const c = code.trim()
    if (!c) return
    const now = Date.now()
    if (lastScan.current.code === c && now - lastScan.current.t < 400) return // anti-doublon
    lastScan.current = { code: c, t: now }

    const res = await api.products.scan(c)
    if (!res?.product) {
      toast.error(`Aucun produit pour « ${c} »`)
      return
    }
    if (res.imei_unit) {
      cart.addProduct(res.product, res.imei_unit)
      toast.success(`${res.product.name} ajouté`)
    } else {
      addProduct(res.product)
    }
    setSearch('')
    refocus()
  }

  // Lecteur code-barres matériel (frappe rapide)
  useBarcodeScanner((code) => addByCode(code), !pickerProduct && !paying && !lastSale && !priceCheck)

  useEffect(() => {
    refocus()
  }, [])

  const checkout = async (payload: {
    paid: number
    payment_method: string
    customer_id: number | null
    note?: string
    adjustedTotal?: number
  }) => {
    let extraDiscount = 0
    if (payload.adjustedTotal !== undefined && payload.adjustedTotal < totals.total) {
      extraDiscount = totals.total - payload.adjustedTotal
    }
    const items = cart.items.map((i) => ({
      product_id: i.product_id,
      imei_unit_id: i.imei_unit_id,
      name: i.name,
      qty: i.qty,
      unit_price: i.unit_price,
      cost_price: i.cost_price,
      discount: i.discount,
      tax_rate: i.tax_rate
    }))
    const r = await api.sales.create({
      items,
      discount: cart.globalDiscount + extraDiscount,
      paid: payload.paid,
      payment_method: payload.payment_method,
      customer_id: payload.customer_id,
      note: payload.note
    })
    if (!r.ok || !r.id) {
      toast.error(r.error || 'Échec de la vente')
      return false
    }
    const sale = await api.sales.get(r.id)
    cart.clear()
    setPaying(false)
    if (sale) {
      setLastSale(sale)
      // Impression automatique du ticket
      const pr = await api.print.receipt(sale)
      if (!pr.ok) toast.error(`Ticket non imprimé : ${pr.error || 'imprimante ?'}`)
    }
    products.reload()
    return true
  }

  return (
    <div className="flex h-full gap-4 p-4">
      {/* ---------- Colonne produits ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <ScanBarcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
            <input
              ref={searchRef}
              className="input pl-10 text-base"
              placeholder="Scanner un code-barres ou rechercher un produit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addByCode(search)
                }
              }}
            />
          </div>
          <Select value={catFilter} onChange={(e) => { setCatFilter(e.target.value ? Number(e.target.value) : ''); setBrandFilter('') }} className="w-44">
            <option value="">Toutes catégories</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {isPhoneCat && brands.length > 0 && (
            <Select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="w-40">
              <option value="">Toutes marques</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
          )}
          <Button variant="outline" onClick={() => setPriceCheck(true)} title="Scanner un article pour voir son prix sans le vendre">
            <Tag size={16} /> Vérifier prix
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {products.loading ? (
            <Spinner />
          ) : !products.data?.length ? (
            <EmptyState icon={<Package size={40} />} title="Aucun produit trouvé" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.data.map((p) => {
                const stock = p.available_stock ?? 0
                const out = stock <= 0
                return (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    disabled={out}
                    className={clsx(
                      'group flex flex-col rounded-xl border bg-white p-3 text-left shadow-card transition',
                      out ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft'
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-100 text-ink-500 group-hover:bg-brand-50 group-hover:text-brand-600">
                        {p.type === 'phone' ? <Smartphone size={18} /> : <Package size={18} />}
                      </div>
                      <span className={clsx('chip', out ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700')}>{stock}</span>
                    </div>
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-ink-900">{p.name}</p>
                    <p className="mt-0.5 text-xs text-ink-400">{p.brand || p.sku}</p>
                    <p className="mt-1.5 text-base font-bold text-brand-600">{money(p.sale_price)}</p>
                    {p.sale_price2 > 0 && <p className="text-[11px] text-ink-400">2ᵉ prix : {money(p.sale_price2)}</p>}
                    {p.sale_price3 > 0 && <p className="text-[11px] text-ink-400">3ᵉ prix : {money(p.sale_price3)}</p>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Colonne panier ---------- */}
      <div className="flex w-[400px] shrink-0 flex-col rounded-2xl border border-ink-100 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-ink-900">
            <ShoppingCart size={18} className="text-brand-600" /> Panier
            {totals.count > 0 && <Badge color="blue">{totals.count}</Badge>}
          </div>
          {cart.items.length > 0 && (
            <button onClick={() => cart.clear()} className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700">
              <Trash2 size={14} /> Vider
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {!cart.items.length ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-300">
              <ScanBarcode size={44} />
              <p className="text-sm font-medium text-ink-400">Scannez ou cliquez sur un produit</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.items.map((it) => (
                <div key={it.key} className="rounded-xl border border-ink-100 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{it.name}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-ink-400">Prix</span>
                        <input
                          type="number"
                          min={0}
                          className="h-7 w-24 rounded-lg border border-ink-200 px-2 text-right text-sm font-semibold text-ink-900 focus:border-brand-400 focus:outline-none"
                          value={it.unit_price === 0 ? '' : it.unit_price}
                          placeholder="0"
                          onChange={(e) => cart.setUnitPrice(it.key, Number(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                        />
                        <span className="text-[11px] text-ink-400">/ u</span>
                      </div>
                    </div>
                    <button onClick={() => cart.remove(it.key)} className="rounded p-1 text-ink-300 hover:text-red-500">
                      <X size={15} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {it.tracks_imei ? (
                      <span className="text-xs text-ink-400">Unité unique</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => cart.setQty(it.key, it.qty - 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50">
                          <Minus size={14} />
                        </button>
                        <input
                          className="h-7 w-12 rounded-lg border border-ink-200 text-center text-sm"
                          value={it.qty}
                          onChange={(e) => cart.setQty(it.key, Number(e.target.value) || 1)}
                        />
                        <button onClick={() => cart.setQty(it.key, it.qty + 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50">
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                    <span className="text-sm font-bold text-ink-900">{money(it.qty * it.unit_price - it.discount)}</span>
                  </div>
                  <PriceOptions item={it} isAdmin={isAdmin} onPick={(v) => cart.setUnitPrice(it.key, v)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totaux + actions */}
        <div className="border-t border-ink-100 px-4 py-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-ink-500">
              <span>Sous-total</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-ink-500">
              <span>Remise</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="h-7 w-24 rounded-lg border border-ink-200 px-2 text-right text-sm"
                  value={cart.globalDiscount || ''}
                  placeholder="0"
                  onChange={(e) => cart.setGlobalDiscount(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2">
            <span className="text-base font-bold text-ink-900">TOTAL</span>
            <span className="text-2xl font-extrabold text-brand-600">{money(totals.total)}</span>
          </div>
          <Button className="mt-3 w-full !py-3 text-base" disabled={!cart.items.length} onClick={() => setPaying(true)}>
            <Banknote size={18} /> Encaisser
          </Button>
        </div>
      </div>

      {pickerProduct && (
        <ImeiPicker
          product={pickerProduct}
          onClose={() => {
            setPickerProduct(null)
            refocus()
          }}
          onPick={(unit) => {
            cart.addProduct(pickerProduct, unit)
            setPickerProduct(null)
            refocus()
          }}
        />
      )}

      {paying && (
        <PaymentModal
          total={totals.total}
          onClose={() => setPaying(false)}
          onConfirm={checkout}
        />
      )}

      {priceCheck && (
        <PriceCheckModal
          onClose={() => {
            setPriceCheck(false)
            refocus()
          }}
          onAdd={(p) => {
            addProduct(p)
            setPriceCheck(false)
            refocus()
          }}
        />
      )}

      {lastSale && (
        <SaleSuccessModal
          sale={lastSale}
          onClose={() => {
            setLastSale(null)
            refocus()
          }}
        />
      )}
    </div>
  )
}

// ---------------- Choix du prix sur une ligne du panier ----------------
function PriceOptions({ item, isAdmin, onPick }: { item: CartItem; isAdmin: boolean; onPick: (v: number) => void }) {
  const opts: { label: string; v: number }[] = []
  if (isAdmin && item.cost_price > 0) opts.push({ label: 'Achat', v: item.cost_price })
  opts.push({ label: 'Prix 1', v: item.sale_price })
  if (item.sale_price2 > 0) opts.push({ label: 'Prix 2', v: item.sale_price2 })
  if (item.sale_price3 > 0) opts.push({ label: 'Prix 3', v: item.sale_price3 })
  if (opts.length <= 1) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {opts.map((o) => {
        const active = Math.abs(item.unit_price - o.v) < 0.001
        return (
          <button
            key={o.label}
            onClick={() => onPick(o.v)}
            className={clsx(
              'rounded-md px-2 py-1 text-[11px] font-semibold transition',
              active ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            )}
          >
            {o.label} · {money(o.v)}
          </button>
        )
      })}
    </div>
  )
}

// ---------------- Vérification de prix (scan sans vente) ----------------
function PriceCheckModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: Product) => void }) {
  const { isAdmin } = useRole()
  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ product: Product; imei?: string } | null>(null)
  const [notFound, setNotFound] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60)
  }, [])

  const lookup = async (value: string) => {
    const c = value.trim()
    if (!c) return
    const res = await api.products.scan(c)
    if (res?.product) {
      setResult({ product: res.product, imei: res.imei_unit?.imei })
      setNotFound(false)
    } else {
      setResult(null)
      setNotFound(true)
    }
    setCode('')
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  return (
    <Modal open onClose={onClose} size="sm" title="Vérifier un prix">
      <div className="relative mb-4">
        <ScanBarcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
        <input
          ref={inputRef}
          className="input pl-10 text-base"
          placeholder="Scannez ou saisissez le code-barres…"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              lookup(code)
            }
          }}
        />
      </div>

      {notFound && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-red-600">
          <AlertTriangle size={18} /> Aucun produit trouvé pour ce code.
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-ink-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-ink-900">{result.product.name}</p>
              <p className="text-xs text-ink-400">
                {result.product.brand || result.product.sku}
                {result.imei ? ` · IMEI ${result.imei}` : ''}
              </p>
            </div>
            <span className={'chip ' + ((result.product.available_stock ?? 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')}>
              Stock {result.product.available_stock ?? 0}
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-end justify-between">
              <span className="text-sm text-ink-500">1er prix de vente</span>
              <span className="text-2xl font-extrabold text-brand-600">{money(result.product.sale_price)}</span>
            </div>
            {result.product.sale_price2 > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">2ème prix de vente</span>
                <span className="text-lg font-bold text-ink-800">{money(result.product.sale_price2)}</span>
              </div>
            )}
            {result.product.sale_price3 > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">3ème prix de vente</span>
                <span className="text-lg font-bold text-ink-800">{money(result.product.sale_price3)}</span>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center justify-between border-t border-ink-100 pt-1.5">
                <span className="text-sm text-ink-400">Prix d'achat</span>
                <span className="text-sm font-semibold text-ink-500">{money(result.product.cost_price)}</span>
              </div>
            )}
          </div>
          <Button className="mt-4 w-full" onClick={() => onAdd(result.product)}>
            <Plus size={16} /> Ajouter à la vente
          </Button>
        </div>
      )}
    </Modal>
  )
}

// ---------------- Sélecteur IMEI ----------------
function ImeiPicker({ product, onClose, onPick }: { product: Product; onClose: () => void; onPick: (u: ImeiUnit) => void }) {
  const units = useAsync(() => api.imei.list({ product_id: product.id, status: 'in_stock' }), [])
  return (
    <Modal open onClose={onClose} title={`Choisir l'IMEI — ${product.name}`}>
      {units.loading ? (
        <Spinner />
      ) : !units.data?.length ? (
        <EmptyState icon={<Smartphone size={36} />} title="Aucune unité en stock" hint="Ajoutez des IMEI depuis l'onglet Stock." />
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {units.data.map((u) => (
            <button
              key={u.id}
              onClick={() => onPick(u)}
              className="flex w-full items-center justify-between rounded-xl border border-ink-100 px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50"
            >
              <div>
                <p className="font-mono font-semibold text-ink-900">{u.imei}</p>
                {u.serial && <p className="text-xs text-ink-400">S/N: {u.serial}</p>}
              </div>
              <span className="font-bold text-brand-600">{money(u.sale_price || product.sale_price)}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ---------------- Paiement ----------------
function PaymentModal({
  total,
  onClose,
  onConfirm
}: {
  total: number
  onClose: () => void
  onConfirm: (p: { paid: number; payment_method: string; customer_id: number | null; note?: string; adjustedTotal?: number }) => Promise<boolean>
}) {
  const [method, setMethod] = useState('cash')
  const [acompte, setAcompte] = useState<number>(0)
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [adjustedTotal, setAdjustedTotal] = useState<number | null>(null)
  const customers = useAsync(() => api.customers.list(), [])
  const creditBlocked = method === 'credit' && !customerId
  const finalTotal = adjustedTotal !== null && adjustedTotal >= 0 ? adjustedTotal : total

  const confirm = async () => {
    if (creditBlocked) return
    const paidValue = method === 'credit' ? acompte : finalTotal
    setSaving(true)
    const ok = await onConfirm({ paid: paidValue, payment_method: method, customer_id: customerId, adjustedTotal: adjustedTotal !== null ? adjustedTotal : undefined })
    if (!ok) setSaving(false)
  }

  const methods = [
    { key: 'cash', label: 'Espèces', icon: Banknote },
    { key: 'card', label: 'Carte', icon: CreditCard },
    { key: 'transfer', label: 'Virement', icon: ArrowLeftRight },
    { key: 'credit', label: 'Crédit', icon: Clock }
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title="Encaissement"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="success" loading={saving} disabled={creditBlocked} onClick={confirm}>
            <CheckCircle2 size={18} /> Valider la vente
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-xl bg-ink-950 px-5 py-4 text-center text-white">
        <p className="text-xs uppercase tracking-wide text-ink-400">Total à payer</p>
        <p className="text-4xl font-extrabold">{money(finalTotal)}</p>
        {adjustedTotal !== null && adjustedTotal !== total && (
          <p className="text-xs text-ink-400 line-through">{money(total)}</p>
        )}
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-xs text-ink-400">Ajuster :</span>
          <input
            type="number"
            className="h-8 w-32 rounded-lg bg-ink-800 px-2 text-center text-sm font-bold text-white placeholder-ink-500 focus:outline-none focus:ring-1 focus:ring-brand-400"
            value={adjustedTotal !== null ? adjustedTotal : ''}
            placeholder={String(total)}
            onChange={(e) => {
              const v = e.target.value
              setAdjustedTotal(v === '' ? null : Math.max(0, Number(v) || 0))
            }}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {methods.map((m) => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            className={clsx(
              'flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-xs font-semibold transition',
              method === m.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-100 text-ink-500 hover:border-ink-200'
            )}
          >
            <m.icon size={20} />
            {m.label}
          </button>
        ))}
      </div>

      {method === 'credit' && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50/50 p-3">
          <Field label="Acompte versé maintenant (optionnel)">
            <NumberInput value={acompte} onValue={setAcompte} />
          </Field>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-semibold text-red-700">Reste à crédit (dette)</span>
            <span className="text-xl font-extrabold text-red-700">{money(Math.max(0, finalTotal - acompte))}</span>
          </div>
        </div>
      )}

      <Field label={method === 'credit' ? 'Client (obligatoire)' : 'Client (optionnel)'}>
        <Select value={customerId ?? ''} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">{method === 'credit' ? '— Choisir un client —' : 'Client de passage'}</option>
          {customers.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.phone ? `· ${c.phone}` : ''}
            </option>
          ))}
        </Select>
        {creditBlocked && <p className="mt-1.5 text-sm text-red-500">⚠️ Une vente à crédit doit être associée à un client.</p>}
      </Field>
    </Modal>
  )
}

// ---------------- Succès vente ----------------
function SaleSuccessModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const toast = useToast()
  const [printing, setPrinting] = useState(false)
  const reprint = async () => {
    setPrinting(true)
    const r = await api.print.receipt(sale)
    setPrinting(false)
    if (r.ok) toast.success('Ticket réimprimé')
    else toast.error(r.error || 'Échec impression')
  }
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <Modal open onClose={onClose} size="sm" title={undefined}>
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={36} />
        </div>
        <h3 className="text-xl font-bold text-ink-900">Vente enregistrée !</h3>
        <p className="text-sm text-ink-500">
          Ticket <b>{sale.ref}</b> · Total <b>{money(sale.total)}</b>
        </p>
        {sale.change_due > 0 && (
          <div className="w-full rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">
            Monnaie à rendre : <b>{money(sale.change_due)}</b>
          </div>
        )}
        <div className="mt-2 flex w-full gap-2">
          <Button variant="outline" className="flex-1" loading={printing} onClick={reprint}>
            <Printer size={16} /> Réimprimer
          </Button>
          <Button className="flex-1" onClick={onClose}>
            <Receipt size={16} /> Nouvelle vente
          </Button>
        </div>
      </div>
    </Modal>
  )
}
