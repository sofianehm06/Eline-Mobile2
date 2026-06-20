import { useState, useCallback } from 'react'
import {
  Plus, Trash2, Eye, CheckCircle2, Package, Truck, ClipboardList,
  Pencil, Search, FileSpreadsheet, Barcode, TrendingUp, ShoppingBag,
  Upload, AlertCircle, Link2
} from 'lucide-react'
import type { PurchaseOrder, PurchaseOrderItem, POItemDetail, Category, Supplier } from '@shared/types'
import { api } from '../lib/api'
import { useAsync, useDebounced } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useRole } from '../lib/role'
import { money, formatDateTime } from '../lib/format'
import {
  Button, Card, PageHeader, Modal, Field, Input, NumberInput, Select, Textarea,
  Badge, Spinner, EmptyState, ConfirmDialog
} from '../components/ui'
import { BrandSelect } from '../components/BrandSelect'

export default function Receptions() {
  const toast = useToast()
  const { isAdmin } = useRole()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [supFilter, setSupFilter] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const orders = useAsync(
    () => api.po.list({ status: statusFilter || undefined, supplier_id: supFilter || undefined, search: debounced || undefined }),
    [statusFilter, supFilter, debounced]
  )
  const suppliers = useAsync(() => api.suppliers.list(), [])
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null)

  const remove = async () => {
    if (!deleting) return
    const r = await api.po.remove(deleting.id)
    if (r.ok) toast.success('Bon supprimé')
    else toast.error(r.error || 'Erreur')
    setDeleting(null)
    orders.reload()
  }

  const doExport = async () => {
    const r = await api.excel.exportReceptions()
    if (r.ok) toast.success('Export réussi')
    else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }

  return (
    <div>
      <PageHeader
        title="Réceptions fournisseur"
        subtitle="Bons de réception pour les livraisons sans fichier Excel"
        actions={
          <>
            <Button variant="outline" onClick={doExport}><FileSpreadsheet size={16} /> Exporter Excel</Button>
            <Button onClick={() => setCreating(true)}><Plus size={16} /> Nouveau bon</Button>
          </>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input className="pl-9" placeholder="Rechercher (réf, fournisseur, note)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
          <option value="">Tous les statuts</option>
          <option value="draft">En attente</option>
          <option value="validated">Validé</option>
        </Select>
        <Select value={supFilter} onChange={(e) => setSupFilter(e.target.value ? Number(e.target.value) : '')} className="w-48">
          <option value="">Tous les fournisseurs</option>
          {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Card>

      <Card>
        {orders.loading ? (
          <Spinner />
        ) : !orders.data?.length ? (
          <EmptyState icon={<ClipboardList size={40} />} title="Aucun bon de réception" hint="Créez un bon pour saisir les produits livrés par un fournisseur." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">Réf</th>
                  <th className="px-4 py-3 font-semibold">Fournisseur</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-center font-semibold">Articles</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-semibold">Total coût</th>}
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.data.map((o) => (
                  <tr key={o.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-brand-600">{o.ref || `#${o.id}`}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck size={14} className="text-ink-400" />
                        <span className="font-semibold text-ink-900">{o.supplier_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.status === 'draft' ? (
                        <Badge color="yellow">En attente</Badge>
                      ) : (
                        <Badge color="green">Validé</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-ink-600">{o.total_items}</td>
                    {isAdmin && <td className="px-4 py-3 text-right font-semibold text-ink-900">{money(o.total_cost)}</td>}
                    <td className="px-4 py-3 text-ink-600">{formatDateTime(o.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewing(o.id)} className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-600" title="Voir / modifier">
                          {o.status === 'draft' ? <Pencil size={16} /> : <Eye size={16} />}
                        </button>
                        {o.status === 'draft' && (
                          <button onClick={() => setDeleting(o)} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600" title="Supprimer">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <CreatePOModal
          suppliers={suppliers.data || []}
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); setViewing(id); orders.reload() }}
        />
      )}

      {viewing !== null && (
        <PODetailModal
          id={viewing}
          onClose={() => { setViewing(null); orders.reload() }}
        />
      )}

      <ConfirmDialog open={!!deleting} title="Supprimer le bon" danger confirmLabel="Supprimer"
        message={`Supprimer le bon ${deleting?.ref || '#' + deleting?.id} ?`} onConfirm={remove} onClose={() => setDeleting(null)} />
    </div>
  )
}

interface ImportedRow {
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

function CreatePOModal({ suppliers, onClose, onCreated }: { suppliers: Supplier[]; onClose: () => void; onCreated: (id: number) => void }) {
  const toast = useToast()
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importedRows, setImportedRows] = useState<ImportedRow[] | null>(null)

  const submit = async () => {
    if (!supplierId) return toast.error('Sélectionnez un fournisseur')
    setSaving(true)
    const r = await api.po.create({ supplier_id: Number(supplierId), note: note || undefined })
    if (!r.ok || !r.id) { setSaving(false); toast.error(r.error || 'Erreur'); return }
    const poId = r.id

    if (importedRows?.length) {
      for (const row of importedRows) {
        await api.po.addItem({
          order_id: poId,
          product_id: row.product_id,
          product_name: row.product_name,
          qty: row.qty,
          unit_cost: row.unit_cost,
          sale_price: row.sale_price,
          sale_price2: row.sale_price2,
          sale_price3: row.sale_price3,
          barcode: row.barcode,
          brand: row.brand,
          notes: row.notes
        })
      }
      toast.success(`Bon créé avec ${importedRows.length} articles importés`)
    } else {
      toast.success('Bon créé')
    }
    setSaving(false)
    onCreated(poId)
  }

  const doImport = async () => {
    setImporting(true)
    const r = await api.po.parseExcel()
    setImporting(false)
    if (r.error === 'Annulé') return
    if (!r.ok || !r.rows?.length) { toast.error(r.error || 'Aucun produit trouvé'); return }
    setImportedRows(r.rows)
    toast.success(`${r.rows.length} produits chargés — vérifiez et modifiez avant de valider`)
  }

  const updateRow = (idx: number, field: keyof ImportedRow, value: unknown) => {
    setImportedRows((prev) =>
      prev ? prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)) : prev
    )
  }

  const removeRow = (idx: number) => {
    setImportedRows((prev) => prev ? prev.filter((_, i) => i !== idx) : prev)
  }

  const totalCost = importedRows?.reduce((s, r) => s + r.qty * r.unit_cost, 0) ?? 0

  return (
    <Modal open onClose={onClose} title="Nouveau bon de réception" size={importedRows?.length ? 'lg' : 'sm'}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-sm text-ink-500">
            {importedRows?.length ? `${importedRows.length} articles · Total coût : ${money(totalCost)}` : ''}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button loading={saving} onClick={submit} disabled={!supplierId}>
              {importedRows?.length ? `Créer avec ${importedRows.length} articles` : 'Créer'}
            </Button>
          </div>
        </div>
      }>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Field label="Fournisseur *">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— Choisir —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Note">
          <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="N° facture, remarques…" />
        </Field>
      </div>

      <div className="mb-4">
        <Button variant="outline" onClick={doImport} loading={importing} className="w-full border-dashed border-2">
          <Upload size={16} />
          {importedRows?.length ? 'Réimporter un fichier' : 'Importer depuis un fichier Excel'}
        </Button>
        <p className="mt-1 text-xs text-ink-400 text-center">
          Colonnes reconnues : Nom, Quantité, Prix achat, Prix vente, Code-barres, Marque…
        </p>
      </div>

      {importedRows && importedRows.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto rounded-lg border border-ink-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Produit</th>
                <th className="px-3 py-2 text-center font-semibold w-20">Qté</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Coût unit.</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Prix vente</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Total</th>
                <th className="px-3 py-2 text-center font-semibold w-12"></th>
              </tr>
            </thead>
            <tbody>
              {importedRows.map((row, idx) => (
                <tr key={idx} className="border-t border-ink-50 hover:bg-ink-50/40">
                  <td className="px-3 py-1.5">
                    <input
                      className="w-full bg-transparent font-semibold text-ink-900 outline-none focus:bg-white focus:ring-1 focus:ring-brand-300 rounded px-1"
                      value={row.product_name}
                      onChange={(e) => updateRow(idx, 'product_name', e.target.value)}
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                      {row.product_id ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">
                          <Link2 size={10} /> Lié #{row.product_id}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                          <AlertCircle size={10} /> Nouveau
                        </span>
                      )}
                      {row.brand && <span className="text-[10px] text-ink-400">{row.brand}</span>}
                      {row.barcode && <span className="text-[10px] text-ink-400 font-mono">{row.barcode}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="number"
                      className="w-16 text-center bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-brand-300 rounded px-1"
                      value={row.qty}
                      min={1}
                      onChange={(e) => updateRow(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      className="w-24 text-right bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-brand-300 rounded px-1"
                      value={row.unit_cost}
                      min={0}
                      onChange={(e) => updateRow(idx, 'unit_cost', Math.max(0, Number(e.target.value) || 0))}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      className="w-24 text-right bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-brand-300 rounded px-1"
                      value={row.sale_price}
                      min={0}
                      onChange={(e) => updateRow(idx, 'sale_price', Math.max(0, Number(e.target.value) || 0))}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-ink-900">
                    {money(row.qty * row.unit_cost)}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <button
                      onClick={() => removeRow(idx)}
                      className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importedRows && importedRows.length === 0 && (
        <p className="text-center text-sm text-ink-400 py-4">Tous les articles ont été retirés. Réimportez ou créez un bon vide.</p>
      )}
    </Modal>
  )
}

function PODetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast()
  const { isAdmin } = useRole()
  const po = useAsync(() => api.po.get(id), [id])
  const categories = useAsync(() => api.categories.list(), [])
  const products = useAsync(() => api.products.list(), [])
  const [addingItem, setAddingItem] = useState(false)
  const [editingItem, setEditingItem] = useState<PurchaseOrderItem | null>(null)
  const [validating, setValidating] = useState(false)
  const [deletingItem, setDeletingItem] = useState<PurchaseOrderItem | null>(null)

  const isDraft = po.data?.status === 'draft'
  const isValidated = po.data?.status === 'validated'

  const validate = async () => {
    setValidating(true)
    const r = await api.po.validate(id)
    setValidating(false)
    if (r.ok) { toast.success('Bon validé — stock mis à jour'); po.reload() }
    else toast.error(r.error || 'Erreur')
  }

  const removeItem = async () => {
    if (!deletingItem) return
    const r = await api.po.removeItem(deletingItem.id)
    if (r.ok) po.reload()
    else toast.error(r.error || 'Erreur')
    setDeletingItem(null)
  }

  if (po.loading) return <Modal open onClose={onClose} title="Chargement…"><Spinner /></Modal>
  if (!po.data) return <Modal open onClose={onClose} title="Erreur"><p>Bon introuvable</p></Modal>

  const o = po.data
  const items = (o.items || []) as (PurchaseOrderItem & Partial<POItemDetail>)[]
  const totalBenefit = items.reduce((s, i) => s + (i.sale_price - i.unit_cost) * i.qty, 0)
  const totalGainRealized = isValidated ? items.reduce((s, i) => s + (i.gain ?? 0), 0) : 0
  const totalRevenue = isValidated ? items.reduce((s, i) => s + (i.revenue ?? 0), 0) : 0
  const totalQtySold = isValidated ? items.reduce((s, i) => s + (i.qty_sold ?? 0), 0) : 0

  return (
    <Modal open onClose={onClose} size="lg" title={`${o.ref || '#' + o.id} — ${o.supplier_name}`}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-sm text-ink-500">
            {o.status === 'validated' && o.validated_at && <span>Validé le {formatDateTime(o.validated_at)}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fermer</Button>
            {isDraft && (
              <Button variant="success" loading={validating} onClick={validate} disabled={!(o.items?.length)}>
                <CheckCircle2 size={16} /> Valider et recevoir
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <Badge color={isDraft ? 'yellow' : 'green'}>{isDraft ? 'En attente' : 'Validé'}</Badge>
          {o.note && <p className="mt-1 text-sm text-ink-500">{o.note}</p>}
        </div>
        <div className="text-right">
          {isAdmin && (
            <>
              <p className="text-sm text-ink-500">Coût total</p>
              <p className="text-xl font-bold text-ink-900">{money(o.total_cost)}</p>
              <p className="text-xs text-emerald-600">Bénéfice potentiel : {money(totalBenefit)}</p>
            </>
          )}
          <p className="text-xs text-ink-400">{o.total_items} articles</p>
        </div>
      </div>

      {isValidated && isAdmin && (
        <div className="mb-3 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5 text-center">
            <p className="text-xs text-brand-600">Vendus</p>
            <p className="text-lg font-bold text-brand-700">{totalQtySold} / {o.total_items}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-2.5 text-center">
            <p className="text-xs text-emerald-600">CA réalisé</p>
            <p className="text-lg font-bold text-emerald-700">{money(totalRevenue)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-2.5 text-center">
            <p className="text-xs text-amber-600">Gain réalisé</p>
            <p className="text-lg font-bold text-amber-700">{money(totalGainRealized)}</p>
          </div>
        </div>
      )}

      {isDraft && (
        <Button variant="outline" className="mb-3" onClick={() => setAddingItem(true)}>
          <Plus size={16} /> Ajouter un produit
        </Button>
      )}

      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-xs uppercase text-ink-400">
            <tr className="border-b border-ink-100">
              <th className="py-2 text-left font-semibold">Produit</th>
              <th className="py-2 text-center font-semibold">Qté</th>
              {isAdmin && <th className="py-2 text-right font-semibold">Coût unit.</th>}
              <th className="py-2 text-right font-semibold">Prix vente</th>
              {isAdmin && <th className="py-2 text-right font-semibold">Total</th>}
              {isValidated && isAdmin && <th className="py-2 text-center font-semibold">Vendus</th>}
              {isValidated && isAdmin && <th className="py-2 text-right font-semibold">Gain</th>}
              {isDraft && <th className="py-2 text-right font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const detail = item as PurchaseOrderItem & Partial<POItemDetail>
              return (
                <tr key={item.id} className="border-b border-ink-50">
                  <td className="py-2">
                    <p className="font-semibold text-ink-900">{item.product_name}</p>
                    {item.brand && <p className="text-xs text-ink-400">{item.brand}</p>}
                    {item.barcode && <p className="text-xs text-ink-400 font-mono">{item.barcode}</p>}
                    {item.product_id && <p className="text-xs text-ink-400">Produit #{item.product_id}</p>}
                  </td>
                  <td className="py-2 text-center text-ink-600">{item.qty}</td>
                  {isAdmin && <td className="py-2 text-right text-ink-600">{money(item.unit_cost)}</td>}
                  <td className="py-2 text-right text-ink-900">{money(item.sale_price)}</td>
                  {isAdmin && <td className="py-2 text-right font-semibold text-ink-900">{money(item.qty * item.unit_cost)}</td>}
                  {isValidated && isAdmin && (
                    <td className="py-2 text-center">
                      <span className={`font-semibold ${(detail.qty_sold ?? 0) >= item.qty ? 'text-emerald-600' : 'text-ink-600'}`}>
                        {detail.qty_sold ?? 0} / {item.qty}
                      </span>
                    </td>
                  )}
                  {isValidated && isAdmin && (
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${(detail.gain ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {money(detail.gain ?? 0)}
                      </span>
                    </td>
                  )}
                  {isDraft && (
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditingItem(item)} className="rounded p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600"><Pencil size={14} /></button>
                        <button onClick={() => setDeletingItem(item)} className="rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
            {!items.length && (
              <tr><td colSpan={8} className="py-8 text-center text-ink-400">Aucun produit ajouté</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(addingItem || editingItem) && (
        <POItemForm
          orderId={id}
          item={editingItem}
          categories={categories.data || []}
          products={products.data || []}
          onClose={() => { setAddingItem(false); setEditingItem(null) }}
          onSaved={() => { setAddingItem(false); setEditingItem(null); po.reload() }}
        />
      )}

      <ConfirmDialog open={!!deletingItem} title="Supprimer la ligne" danger confirmLabel="Supprimer"
        message={`Supprimer « ${deletingItem?.product_name} » du bon ?`} onConfirm={removeItem} onClose={() => setDeletingItem(null)} />
    </Modal>
  )
}

function POItemForm({
  orderId, item, categories, products, onClose, onSaved
}: {
  orderId: number
  item: PurchaseOrderItem | null
  categories: Category[]
  products: any[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [existingProduct, setExistingProduct] = useState<number | ''>(item?.product_id || '')
  const [f, setF] = useState({
    product_name: item?.product_name || '',
    qty: item?.qty ?? 1,
    unit_cost: item?.unit_cost ?? 0,
    sale_price: item?.sale_price ?? 0,
    sale_price2: item?.sale_price2 ?? 0,
    sale_price3: item?.sale_price3 ?? 0,
    barcode: item?.barcode || '',
    brand: item?.brand || '',
    category_id: item?.category_id || '' as number | '',
    notes: item?.notes || ''
  })
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }))

  const onExistingChange = (val: string) => {
    const pid = val ? Number(val) : ''
    setExistingProduct(pid)
    if (pid) {
      const p = products.find((x: any) => x.id === pid)
      if (p) {
        setF((s) => ({
          ...s,
          product_name: p.name,
          unit_cost: p.cost_price,
          sale_price: p.sale_price,
          sale_price2: p.sale_price2 || 0,
          sale_price3: p.sale_price3 || 0,
          brand: p.brand || '',
          barcode: p.barcode || '',
          category_id: p.category_id || ''
        }))
      }
    }
  }

  const generateBarcode = async () => {
    const code = await api.products.nextBarcode()
    set('barcode', code)
  }

  const submit = async () => {
    if (!f.product_name.trim()) return toast.error('Nom du produit requis')
    setSaving(true)
    const payload = {
      ...f,
      order_id: orderId,
      product_id: existingProduct || null,
      category_id: f.category_id ? Number(f.category_id) : null
    }
    const r = item
      ? await api.po.updateItem({ ...payload, id: item.id })
      : await api.po.addItem(payload)
    setSaving(false)
    if (r.ok) { toast.success(item ? 'Ligne modifiée' : 'Produit ajouté'); onSaved() }
    else toast.error(r.error || 'Erreur')
  }

  return (
    <Modal open onClose={onClose} title={item ? 'Modifier la ligne' : 'Ajouter un produit'}
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={saving} onClick={submit}>{item ? 'Modifier' : 'Ajouter'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Produit existant (optionnel)" hint="Lier à un produit déjà dans le catalogue">
            <Select value={existingProduct} onChange={(e) => onExistingChange(e.target.value)}>
              <option value="">— Nouveau produit —</option>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Nom du produit *">
            <Input value={f.product_name} onChange={(e) => set('product_name', e.target.value)} placeholder="Nom du produit" />
          </Field>
        </div>
        <Field label="Quantité"><NumberInput value={f.qty} onValue={(n) => set('qty', n)} /></Field>
        <Field label="Coût unitaire"><NumberInput value={f.unit_cost} onValue={(n) => set('unit_cost', n)} /></Field>
        <Field label="Prix de vente"><NumberInput value={f.sale_price} onValue={(n) => set('sale_price', n)} /></Field>
        <Field label="2ème prix"><NumberInput value={f.sale_price2} onValue={(n) => set('sale_price2', n)} /></Field>
        <Field label="3ème prix"><NumberInput value={f.sale_price3} onValue={(n) => set('sale_price3', n)} /></Field>
        <Field label="Marque">
          <BrandSelect value={f.brand} onChange={(v) => set('brand', v)} />
        </Field>
        <Field label="Code-barres">
          <div className="flex gap-2">
            <Input value={f.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Scanner ou générer" className="flex-1" />
            <Button type="button" variant="outline" className="shrink-0" onClick={generateBarcode} title="Générer un code-barres">
              <Barcode size={15} /> Générer
            </Button>
          </div>
        </Field>
        <Field label="Catégorie">
          <Select value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">— Aucune —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Notes"><Textarea rows={1} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  )
}
