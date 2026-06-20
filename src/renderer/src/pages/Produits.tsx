import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Smartphone,
  Barcode,
  Tags,
  Truck,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react'
import type { Category, Product, Supplier } from '@shared/types'
import { PHONE_BRANDS } from '@shared/types'
import { api } from '../lib/api'
import { useAsync, useBarcodeScanner, useDebounced } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useRole } from '../lib/role'
import { money } from '../lib/format'
import {
  Button,
  Card,
  PageHeader,
  Modal,
  Field,
  Input,
  NumberInput,
  Select,
  Textarea,
  Badge,
  Spinner,
  EmptyState,
  ConfirmDialog
} from '../components/ui'
import { BarcodeLabelButton } from '../components/BarcodeLabel'
import { BrandSelect } from '../components/BrandSelect'

export default function Produits() {
  const toast = useToast()
  const { isAdmin } = useRole()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<number | ''>('')
  const [supFilter, setSupFilter] = useState<number | ''>('')
  const [typeFilter, setTypeFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const debounced = useDebounced(search)

  const cats = useAsync(() => api.categories.list(), [])
  const suppliers = useAsync(() => api.suppliers.list(), [])
  const isPhoneFilter = typeFilter === 'phone'
  const rawProducts = useAsync(
    () =>
      api.products.list({
        search: debounced,
        category_id: catFilter || undefined,
        supplier_id: supFilter || undefined,
        type: typeFilter || undefined
      }),
    [debounced, catFilter, supFilter, typeFilter]
  )
  const products = {
    ...rawProducts,
    data: brandFilter
      ? rawProducts.data?.filter((p) => p.brand?.toLowerCase() === brandFilter.toLowerCase())
      : rawProducts.data
  }

  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [showCats, setShowCats] = useState(false)

  const reload = () => {
    rawProducts.reload()
    cats.reload()
  }

  const doExport = async () => {
    const r = await api.excel.exportProducts()
    if (r.ok) toast.success('Export réussi')
    else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }

  const remove = async () => {
    if (!deleting) return
    const r = await api.products.remove(deleting.id)
    if (r.ok) toast.success(r.error === 'archived' ? 'Produit archivé (lié à des ventes)' : 'Produit supprimé')
    else toast.error(r.error || 'Erreur')
    setDeleting(null)
    reload()
  }

  return (
    <div>
      <PageHeader
        title="Produits"
        subtitle="Catalogue des téléphones et accessoires"
        actions={
          <>
            <Button variant="outline" onClick={doExport}>
              <FileSpreadsheet size={16} /> Exporter
            </Button>
            <Button variant="outline" onClick={() => setShowCats(true)}>
              <Tags size={16} /> Catégories
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> Nouveau produit
            </Button>
          </>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            className="pl-9"
            placeholder="Rechercher (nom, SKU, code-barres, marque)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setBrandFilter(''); setCatFilter('') }} className="w-44">
          <option value="">Tous les types</option>
          <option value="phone">Téléphones</option>
          <option value="accessory">Accessoires</option>
        </Select>
        {isPhoneFilter ? (
          <Select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="w-48">
            <option value="">Toutes les marques</option>
            {PHONE_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        ) : (
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value ? Number(e.target.value) : '')} className="w-48">
            <option value="">Toutes les catégories</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <Select value={supFilter} onChange={(e) => setSupFilter(e.target.value ? Number(e.target.value) : '')} className="w-48">
          <option value="">Tous les fournisseurs</option>
          {suppliers.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        {products.loading ? (
          <Spinner label="Chargement des produits…" />
        ) : !products.data?.length ? (
          <EmptyState icon={<Package size={40} />} title="Aucun produit" hint="Ajoutez votre premier produit pour commencer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">Produit</th>
                  <th className="px-4 py-3 font-semibold">Catégorie</th>
                  <th className="px-4 py-3 font-semibold">Code-barres</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-semibold">Achat</th>}
                  <th className="px-4 py-3 text-right font-semibold">Vente</th>
                  <th className="px-4 py-3 text-center font-semibold">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.data.map((p) => {
                  const stock = p.available_stock ?? 0
                  const low = stock <= (p.min_stock || 0)
                  return (
                    <tr key={p.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-100 text-ink-500">
                            {p.type === 'phone' ? <Smartphone size={16} /> : <Package size={16} />}
                          </div>
                          <div>
                            <p className="font-semibold text-ink-900">{p.name}</p>
                            <p className="text-xs text-ink-400">
                              {p.sku}
                              {p.brand ? ` · ${p.brand}` : ''}
                              {p.model ? ` ${p.model}` : ''}
                            </p>
                            {p.supplier_name && (
                              <p className="text-xs text-ink-400">
                                <Truck size={11} className="mr-1 inline" />
                                {p.supplier_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.category_name ? <Badge color="blue">{p.category_name}</Badge> : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-600">{p.barcode || <span className="text-ink-300">—</span>}</td>
                      {isAdmin && <td className="px-4 py-3 text-right text-ink-600">{money(p.cost_price)}</td>}
                      <td className="px-4 py-3 text-right font-semibold text-ink-900">
                        {money(p.sale_price)}
                        {p.sale_price2 > 0 && <div className="text-xs font-normal text-ink-400">2ᵉ : {money(p.sale_price2)}</div>}
                        {p.sale_price3 > 0 && <div className="text-xs font-normal text-ink-400">3ᵉ : {money(p.sale_price3)}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            'inline-flex min-w-[2.5rem] items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ' +
                            (low ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')
                          }
                        >
                          {low && <AlertTriangle size={11} />}
                          {stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <BarcodeLabelButton product={p} />
                          <button
                            onClick={() => setEditing(p)}
                            className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-600"
                            title="Modifier"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleting(p)}
                            className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <ProductForm
          product={editing}
          categories={cats.data || []}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            reload()
          }}
        />
      )}

      {showCats && <CategoriesModal onClose={() => setShowCats(false)} onChange={reload} />}

      <ConfirmDialog
        open={!!deleting}
        title="Supprimer le produit"
        danger
        confirmLabel="Supprimer"
        message={`Voulez-vous vraiment supprimer « ${deleting?.name} » ? S'il est lié à des ventes, il sera archivé.`}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

// ---------------- Formulaire produit ----------------
function ProductForm({
  product,
  categories,
  onClose,
  onSaved
}: {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const suppliers = useAsync(() => api.suppliers.list(), [])
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    brand: product?.brand || '',
    model: product?.model || '',
    category_id: product?.category_id || '',
    supplier_id: product?.supplier_id || '',
    type: product?.type || 'accessory',
    tracks_imei: product ? product.tracks_imei === 1 : false,
    cost_price: product?.cost_price ?? 0,
    sale_price: product?.sale_price ?? 0,
    sale_price2: product?.sale_price2 ?? 0,
    sale_price3: product?.sale_price3 ?? 0,
    tax_rate: product?.tax_rate ?? 0,
    stock_qty: product?.stock_qty ?? 0,
    min_stock: product?.min_stock ?? 0,
    warranty_months: product?.warranty_months ?? 0,
    notes: product?.notes || ''
  })

  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }))
  const margin = f.sale_price - f.cost_price

  const barcodeRef = useRef<HTMLInputElement>(null)
  const [barcodeDup, setBarcodeDup] = useState<string | null>(null)

  const [suggestions, setSuggestions] = useState<{ name: string; barcode: string | null; brand: string | null; category_id: number | null; type: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const fetchSuggestions = useCallback((q: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (q.trim().length < 2) { setSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      const res = await api.products.suggest(q)
      setSuggestions(res || [])
      setShowSuggestions(true)
    }, 200)
  }, [])

  const pickSuggestion = (s: { name: string; barcode: string | null; brand: string | null; category_id: number | null; type: string }) => {
    setF(prev => ({
      ...prev,
      name: s.name,
      barcode: s.barcode || prev.barcode,
      brand: s.brand || prev.brand,
      category_id: s.category_id || prev.category_id,
      type: s.type || prev.type
    }))
    setShowSuggestions(false)
    setSuggestions([])
    if (s.barcode) setBarcodeDup(null)
  }

  // Vérifie si un code-barres est déjà utilisé par un autre produit
  const checkBarcode = async (code: string) => {
    const c = (code || '').trim()
    if (!c) return setBarcodeDup(null)
    const res = await api.products.scan(c)
    const p = res?.product
    setBarcodeDup(p && p.barcode === c && p.id !== product?.id ? p.name : null)
  }

  // Un scan remplit toujours la case « Code-barres », peu importe le focus
  useBarcodeScanner(
    (code) => {
      set('barcode', code)
      checkBarcode(code)
      setTimeout(() => barcodeRef.current?.focus(), 20)
    },
    true,
    { preventInput: true }
  )

  const onTypeChange = (t: string) => {
    // Le suivi IMEI n'est plus imposé pour les téléphones (reste au choix, "Non" par défaut).
    setF((s) => ({ ...s, type: t as 'phone' | 'accessory', warranty_months: t === 'phone' && !s.warranty_months ? 12 : s.warranty_months }))
  }

  const submit = async () => {
    if (!f.name.trim()) return toast.error('Le nom du produit est requis')
    setSaving(true)
    const payload = {
      ...f,
      category_id: f.category_id ? Number(f.category_id) : null,
      supplier_id: f.supplier_id ? Number(f.supplier_id) : null,
      tracks_imei: f.tracks_imei ? 1 : 0,
      cost_price: Number(f.cost_price),
      sale_price: Number(f.sale_price),
      sale_price2: Number(f.sale_price2),
      sale_price3: Number(f.sale_price3),
      tax_rate: Number(f.tax_rate),
      stock_qty: Number(f.stock_qty),
      min_stock: Number(f.min_stock),
      warranty_months: Number(f.warranty_months)
    } as any
    const r = product
      ? await api.products.update({ ...payload, id: product.id })
      : await api.products.create(payload)
    setSaving(false)
    if (r.ok) {
      toast.success(product ? 'Produit modifié' : 'Produit créé')
      onSaved()
    } else toast.error(r.error || 'Erreur')
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={product ? 'Modifier le produit' : 'Nouveau produit'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={saving} onClick={submit}>
            {product ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Nom du produit *">
            <div className="relative">
              <Input
                ref={nameRef}
                value={f.name}
                onChange={(e) => {
                  set('name', e.target.value)
                  if (!product) fetchSuggestions(e.target.value)
                }}
                onFocus={() => { if (suggestions.length) setShowSuggestions(true) }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Ex: Samsung Galaxy A15 128Go"
                autoFocus={!!product}
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lg">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(s)}
                    >
                      <span className="font-medium text-ink-900">{s.name}</span>
                      {s.barcode && <span className="text-xs text-ink-400">CB: {s.barcode}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
        </div>

        <Field label="Type">
          <Select value={f.type} onChange={(e) => onTypeChange(e.target.value)}>
            <option value="accessory">Accessoire</option>
            <option value="phone">Téléphone</option>
          </Select>
        </Field>
        <Field label="Catégorie">
          <Select value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="col-span-2">
          <Field label="Fournisseur" hint="Pour retrouver de quel fournisseur vient ce produit">
            <Select value={f.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
              <option value="">— Aucun —</option>
              {suppliers.data?.map((s: Supplier) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Marque">
          <BrandSelect value={f.brand} onChange={(v) => set('brand', v)} />
        </Field>
        <Field label="Modèle">
          <Input value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="Galaxy A15…" />
        </Field>

        <Field label="SKU (référence)" hint="Laissez vide pour génération auto">
          <Input value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Auto" />
        </Field>
        <Field label="Code-barres" hint="Vide = généré automatiquement à l'enregistrement">
          <div className="flex gap-2">
            <Input
              ref={barcodeRef}
              value={f.barcode}
              onChange={(e) => {
                set('barcode', e.target.value)
                if (barcodeDup) setBarcodeDup(null)
              }}
              onBlur={(e) => checkBarcode(e.target.value)}
              placeholder="Scanner, saisir ou générer"
              autoFocus={!product}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={async () => {
                const code = await api.products.nextBarcode()
                set('barcode', code)
                setBarcodeDup(null)
              }}
              title="Générer un code-barres"
            >
              <Barcode size={15} /> Générer
            </Button>
          </div>
          {barcodeDup && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-blue-600">
              <Barcode size={12} /> Même code-barres que « {barcodeDup} »
            </p>
          )}
        </Field>

        <Field label="Prix d'achat">
          <NumberInput value={f.cost_price} onValue={(n) => set('cost_price', n)} />
        </Field>
        <Field label="1er prix de vente" hint={margin >= 0 ? `Marge: ${money(margin)}` : 'Marge négative !'}>
          <NumberInput value={f.sale_price} onValue={(n) => set('sale_price', n)} />
        </Field>
        <Field label="2ème prix de vente" hint="Optionnel — prix spécial (0 = non utilisé)">
          <NumberInput value={f.sale_price2} onValue={(n) => set('sale_price2', n)} />
        </Field>
        <Field label="3ème prix de vente" hint="Optionnel — prix spécial (0 = non utilisé)">
          <NumberInput value={f.sale_price3} onValue={(n) => set('sale_price3', n)} />
        </Field>

        <Field label="Garantie (mois)">
          <NumberInput value={f.warranty_months} onValue={(n) => set('warranty_months', n)} />
        </Field>

        {!f.tracks_imei && (
          <Field label="Stock initial" hint={product ? 'Utilisez « Stock » pour réajuster' : undefined}>
            <NumberInput value={f.stock_qty} onValue={(n) => set('stock_qty', n)} disabled={!!product} />
          </Field>
        )}
        <Field label="Seuil d'alerte stock">
          <NumberInput value={f.min_stock} onValue={(n) => set('min_stock', n)} />
        </Field>

        <div className="col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

// ---------------- Gestion des catégories ----------------
function CategoriesModal({ onClose, onChange }: { onClose: () => void; onChange: () => void }) {
  const toast = useToast()
  const cats = useAsync(() => api.categories.list(), [])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3563ff')
  const [editId, setEditId] = useState<number | null>(null)

  const save = async () => {
    if (!name.trim()) return
    const r = editId
      ? await api.categories.update({ id: editId, name, color })
      : await api.categories.create({ name, color })
    if (r.ok) {
      toast.success(editId ? 'Catégorie modifiée' : 'Catégorie ajoutée')
      setName('')
      setColor('#3563ff')
      setEditId(null)
      cats.reload()
      onChange()
    } else toast.error(r.error || 'Erreur')
  }

  const remove = async (id: number) => {
    const r = await api.categories.remove(id)
    if (r.ok) {
      cats.reload()
      onChange()
    } else toast.error(r.error || 'Erreur')
  }

  return (
    <Modal open onClose={onClose} title="Catégories">
      <div className="mb-4 flex items-end gap-2">
        <Field label="Nom">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la catégorie" />
        </Field>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-ink-200" />
        <Button onClick={save}>{editId ? 'Modifier' : 'Ajouter'}</Button>
      </div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {cats.data?.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: c.color }} />
              <span className="font-medium text-ink-800">{c.name}</span>
              <span className="text-xs text-ink-400">({c.product_count})</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setEditId(c.id)
                  setName(c.name)
                  setColor(c.color)
                }}
                className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600"
              >
                <Pencil size={14} />
              </button>
              <button onClick={() => remove(c.id)} className="rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
