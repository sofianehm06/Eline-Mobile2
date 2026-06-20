import { useMemo, useState } from 'react'
import {
  Boxes,
  Search,
  PackagePlus,
  SlidersHorizontal,
  Smartphone,
  Plus,
  Trash2,
  Pencil,
  ArrowDownUp,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react'
import type { ImeiUnit, Product, Supplier } from '@shared/types'
import { api } from '../lib/api'
import { useAsync, useDebounced } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useRole } from '../lib/role'
import { money, formatDate, formatDateTime } from '../lib/format'
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
  EmptyState
} from '../components/ui'

type Tab = 'stock' | 'mouvements'

const imeiStatusBadge: Record<string, { color: string; label: string }> = {
  in_stock: { color: 'green', label: 'En stock' },
  sold: { color: 'gray', label: 'Vendu' },
  returned: { color: 'amber', label: 'Retourné' },
  reserved: { color: 'purple', label: 'Réservé' }
}

export default function Stock() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('stock')

  const doExport = async () => {
    const r = await api.excel.exportStock()
    if (r.ok) toast.success('Export réussi')
    else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }

  return (
    <div>
      <PageHeader title="Stock" subtitle="Réceptions, inventaire et mouvements de stock"
        actions={<Button variant="outline" onClick={doExport}><FileSpreadsheet size={16} /> Exporter</Button>}
      />
      <div className="mb-4 flex gap-1 rounded-xl bg-ink-100 p-1">
        {(
          [
            ['stock', 'Stock produits', Boxes],
            ['mouvements', 'Mouvements', ArrowDownUp]
          ] as [Tab, string, any][]
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ' +
              (tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-700')
            }
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'stock' && <StockTab />}
      {tab === 'mouvements' && <MovementsTab />}
    </div>
  )
}

// ---------------- Stock produits ----------------
function StockTab() {
  const { isAdmin } = useRole()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const products = useAsync(() => api.products.list({ search: debounced }), [debounced])
  const [receive, setReceive] = useState<Product | null>(null)
  const [adjust, setAdjust] = useState<Product | null>(null)

  return (
    <div>
      <Card className="mb-4 flex items-center gap-3 p-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input className="pl-9" placeholder="Rechercher un produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card>
        {products.loading ? (
          <Spinner />
        ) : !products.data?.length ? (
          <EmptyState icon={<Boxes size={40} />} title="Aucun produit" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">Produit</th>
                  <th className="px-4 py-3 text-center font-semibold">Stock</th>
                  <th className="px-4 py-3 text-center font-semibold">Seuil</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-semibold">Valeur (achat)</th>}
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
                            {p.type === 'phone' ? <Smartphone size={16} /> : <Boxes size={16} />}
                          </div>
                          <div>
                            <p className="font-semibold text-ink-900">{p.name}</p>
                            <p className="text-xs text-ink-400">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={'font-bold ' + (low ? 'text-red-600' : 'text-ink-900')}>{stock}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-ink-500">{p.min_stock || '—'}</td>
                      {isAdmin && <td className="px-4 py-3 text-right text-ink-600">{money(stock * p.cost_price)}</td>}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" className="!py-1.5 text-xs" onClick={() => setReceive(p)}>
                            <PackagePlus size={14} /> Réception
                          </Button>
                          <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setAdjust(p)}>
                            <SlidersHorizontal size={14} /> Ajuster
                          </Button>
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

      {receive && <ReceiveModal product={receive} onClose={() => setReceive(null)} onDone={() => { setReceive(null); products.reload() }} />}
      {adjust && <AdjustModal product={adjust} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); products.reload() }} />}
    </div>
  )
}

function ReceiveModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [qty, setQty] = useState(1)
  const [cost, setCost] = useState(product.cost_price)
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    const r = await api.products.receiveStock({ product_id: product.id, qty: Number(qty), unit_cost: Number(cost) })
    setSaving(false)
    if (r.ok) { toast.success(`+${qty} en stock`); onDone() } else toast.error(r.error || 'Erreur')
  }
  return (
    <Modal open onClose={onClose} size="sm" title={`Réception — ${product.name}`}
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={saving} onClick={submit}>Valider l'entrée</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantité reçue"><NumberInput min={1} value={qty} onValue={setQty} autoFocus /></Field>
        <Field label="Coût unitaire"><NumberInput value={cost} onValue={setCost} /></Field>
      </div>
      <p className="mt-3 text-sm text-ink-500">Stock actuel : <b>{product.available_stock}</b> → nouveau : <b className="text-emerald-600">{(product.available_stock ?? 0) + Number(qty || 0)}</b></p>
    </Modal>
  )
}

function AdjustModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [newQty, setNewQty] = useState(product.available_stock ?? 0)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    const r = await api.products.adjustStock({ product_id: product.id, new_qty: Number(newQty), reason: reason || undefined })
    setSaving(false)
    if (r.ok) { toast.success('Stock ajusté'); onDone() } else toast.error(r.error || 'Erreur')
  }
  return (
    <Modal open onClose={onClose} size="sm" title={`Ajuster — ${product.name}`}
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={saving} onClick={submit}>Enregistrer</Button></>}>
      <Field label="Nouvelle quantité réelle (inventaire)"><NumberInput value={newQty} onValue={setNewQty} autoFocus /></Field>
      <div className="mt-4"><Field label="Motif"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Casse, perte, correction…" /></Field></div>
    </Modal>
  )
}

// ---------------- Unités IMEI ----------------
function ImeiTab() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const debounced = useDebounced(search)
  const { isAdmin } = useRole()
  const units = useAsync(() => api.imei.list({ search: debounced || undefined, status: status || undefined }), [debounced, status])
  const [addFor, setAddFor] = useState(false)
  const [warrantyUnit, setWarrantyUnit] = useState<ImeiUnit | null>(null)

  return (
    <div>
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input className="pl-9" placeholder="Rechercher IMEI / produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">Tous les statuts</option>
          <option value="in_stock">En stock</option>
          <option value="sold">Vendu</option>
          <option value="returned">Retourné</option>
        </Select>
        <Button onClick={() => setAddFor(true)}><Plus size={16} /> Ajouter des IMEI</Button>
      </Card>

      <Card>
        {units.loading ? (
          <Spinner />
        ) : !units.data?.length ? (
          <EmptyState icon={<Smartphone size={40} />} title="Aucune unité IMEI" hint="Ajoutez des téléphones avec leur IMEI." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">IMEI</th>
                  <th className="px-4 py-3 font-semibold">Produit</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-semibold">Achat</th>}
                  <th className="px-4 py-3 text-right font-semibold">Vente</th>
                  <th className="px-4 py-3 font-semibold">Garantie</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {units.data.map((u) => {
                  const sb = imeiStatusBadge[u.status] || imeiStatusBadge.in_stock
                  return (
                    <tr key={u.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                      <td className="px-4 py-3 font-mono font-semibold text-ink-900">{u.imei}</td>
                      <td className="px-4 py-3 text-ink-700">{u.product_name}</td>
                      <td className="px-4 py-3"><Badge color={sb.color}>{sb.label}</Badge>{u.sale_ref && <span className="ml-2 text-xs text-ink-400">{u.sale_ref}</span>}</td>
                      {isAdmin && <td className="px-4 py-3 text-right text-ink-600">{money(u.cost_price)}</td>}
                      <td className="px-4 py-3 text-right text-ink-900">{u.sale_price ? money(u.sale_price) : '—'}</td>
                      <td className="px-4 py-3 text-ink-500">
                        {u.warranty_months ? <span className="inline-flex items-center gap-1"><ShieldCheck size={13} /> {u.warranty_months} mois</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setWarrantyUnit(u)} className="rounded p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600" title="Garantie"><ShieldCheck size={15} /></button>
                          {u.status === 'in_stock' && (
                            <button onClick={async () => { const r = await api.imei.remove(u.id); if (r.ok) units.reload() }} className="rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" title="Supprimer"><Trash2 size={15} /></button>
                          )}
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

      {addFor && <ImeiAddModal onClose={() => setAddFor(false)} onDone={() => { setAddFor(false); units.reload() }} />}
      {warrantyUnit && <WarrantyModal unit={warrantyUnit} onClose={() => setWarrantyUnit(null)} />}
    </div>
  )
}

function WarrantyModal({ unit, onClose }: { unit: ImeiUnit; onClose: () => void }) {
  const toast = useToast()
  const [printing, setPrinting] = useState(false)

  const months = unit.warranty_months || 0
  const startRaw = unit.status === 'sold' && unit.sale_datetime ? unit.sale_datetime : unit.purchase_date || unit.created_at
  const start = new Date(String(startRaw).replace(' ', 'T'))
  const end = new Date(start)
  end.setMonth(end.getMonth() + months)
  const today = new Date()
  const active = months > 0 && end > today
  const remainingDays = Math.ceil((end.getTime() - today.getTime()) / 86400000)

  const print = async () => {
    setPrinting(true)
    const r = await api.warranty.print({
      product_name: unit.product_name || '',
      imei: unit.imei,
      customer_name: unit.sale_customer,
      start_date: formatDate(startRaw),
      end_date: formatDate(end),
      warranty_months: months,
      active
    })
    setPrinting(false)
    if (r.ok) toast.success('Bon de garantie imprimé')
    else toast.error(r.error || "Échec de l'impression")
  }

  return (
    <Modal open onClose={onClose} size="sm" title="Garantie"
      footer={<><Button variant="outline" onClick={onClose}>Fermer</Button><Button loading={printing} onClick={print}><ShieldCheck size={16} /> Imprimer le bon</Button></>}>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-ink-500">Produit</span><b className="text-ink-900">{unit.product_name}</b></div>
        <div className="flex justify-between"><span className="text-ink-500">IMEI</span><span className="font-mono font-semibold">{unit.imei}</span></div>
        {unit.sale_customer && <div className="flex justify-between"><span className="text-ink-500">Client</span><b>{unit.sale_customer}</b></div>}
        <div className="flex justify-between"><span className="text-ink-500">Date d'achat</span><b>{formatDate(startRaw)}</b></div>
        <div className="flex justify-between"><span className="text-ink-500">Durée</span><b>{months} mois</b></div>
        <div className="flex justify-between"><span className="text-ink-500">Fin de garantie</span><b>{formatDate(end)}</b></div>
      </div>
      <div className={'mt-4 rounded-xl px-4 py-3 text-center font-extrabold ' + (active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
        {months <= 0 ? 'AUCUNE GARANTIE' : active ? `SOUS GARANTIE · ${remainingDays} jour(s) restant(s)` : 'GARANTIE EXPIRÉE'}
      </div>
      {unit.status !== 'sold' && (
        <p className="mt-2 text-center text-xs text-ink-400">Article encore en stock — la garantie démarre à la vente.</p>
      )}
    </Modal>
  )
}

function ImeiAddModal({ presetProduct, onClose, onDone }: { presetProduct?: Product; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const phones = useAsync(() => api.products.list({ type: 'phone' }), [])
  const suppliers = useAsync(() => api.suppliers.list(), [])
  const [productId, setProductId] = useState<number | ''>(presetProduct?.id || '')
  const [imeis, setImeis] = useState('')
  const [cost, setCost] = useState(presetProduct?.cost_price ?? 0)
  const [price, setPrice] = useState(presetProduct?.sale_price ?? 0)
  const [warranty, setWarranty] = useState(presetProduct?.warranty_months ?? 12)
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  const onProductChange = (id: number) => {
    setProductId(id)
    const p = phones.data?.find((x) => x.id === id)
    if (p) { setCost(p.cost_price); setPrice(p.sale_price); setWarranty(p.warranty_months || 12) }
  }

  const submit = async () => {
    if (!productId) return toast.error('Choisissez un produit')
    const list = imeis.split(/[\n,;\s]+/).map((s) => s.trim()).filter(Boolean)
    if (!list.length) return toast.error('Saisissez au moins un IMEI')
    setSaving(true)
    const r = await api.imei.addBulk({
      product_id: Number(productId),
      imeis: list,
      cost_price: Number(cost),
      sale_price: Number(price),
      warranty_months: Number(warranty),
      supplier_id: supplierId ? Number(supplierId) : null
    })
    setSaving(false)
    if (r.ok) { toast.success(`${r.id} IMEI ajouté(s)${r.error ? ` · ignorés: ${r.error}` : ''}`); onDone() }
    else toast.error(r.error || 'Erreur')
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Ajouter des unités IMEI"
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={saving} onClick={submit}>Ajouter au stock</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Produit (téléphone)">
            <Select value={productId} onChange={(e) => onProductChange(Number(e.target.value))} disabled={!!presetProduct}>
              <option value="">— Choisir —</option>
              {phones.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="IMEI (un par ligne, ou collez plusieurs)" hint="Vous pouvez aussi scanner les codes IMEI ici">
            <Textarea rows={4} value={imeis} onChange={(e) => setImeis(e.target.value)} placeholder={'350000000000017\n350000000000025'} className="font-mono" autoFocus />
          </Field>
        </div>
        <Field label="Prix d'achat"><NumberInput value={cost} onValue={setCost} /></Field>
        <Field label="Prix de vente"><NumberInput value={price} onValue={setPrice} /></Field>
        <Field label="Garantie (mois)"><NumberInput value={warranty} onValue={setWarranty} /></Field>
        <Field label="Fournisseur">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— Aucun —</option>
            {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

function ImeiManageModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const units = useAsync(() => api.imei.list({ product_id: product.id }), [])
  const [add, setAdd] = useState(false)
  return (
    <Modal open onClose={onClose} size="lg" title={`IMEI — ${product.name}`}
      footer={<Button variant="outline" onClick={onClose}>Fermer</Button>}>
      <div className="mb-3 flex justify-between">
        <p className="text-sm text-ink-500">{units.data?.filter((u) => u.status === 'in_stock').length || 0} en stock · {units.data?.length || 0} au total</p>
        <Button className="!py-1.5 text-xs" onClick={() => setAdd(true)}><Plus size={14} /> Ajouter</Button>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-lg border border-ink-100">
        <table className="w-full text-sm">
          <tbody>
            {units.data?.map((u) => {
              const sb = imeiStatusBadge[u.status]
              return (
                <tr key={u.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-3 py-2 font-mono">{u.imei}</td>
                  <td className="px-3 py-2"><Badge color={sb.color}>{sb.label}</Badge></td>
                  <td className="px-3 py-2 text-right">{money(u.sale_price || product.sale_price)}</td>
                  <td className="px-3 py-2 text-right">
                    {u.status === 'in_stock' && <button onClick={async () => { await api.imei.remove(u.id); units.reload(); onDone() }} className="rounded p-1 text-ink-400 hover:text-red-600"><Trash2 size={14} /></button>}
                  </td>
                </tr>
              )
            })}
            {!units.data?.length && <tr><td className="px-3 py-6 text-center text-ink-400">Aucune unité</td></tr>}
          </tbody>
        </table>
      </div>
      {add && <ImeiAddModal presetProduct={product} onClose={() => setAdd(false)} onDone={() => { setAdd(false); units.reload(); onDone() }} />}
    </Modal>
  )
}

// ---------------- Mouvements ----------------
const moveTypeLabel: Record<string, { color: string; label: string }> = {
  in: { color: 'green', label: 'Entrée' },
  out: { color: 'red', label: 'Sortie' },
  sale: { color: 'blue', label: 'Vente' },
  return: { color: 'amber', label: 'Retour' },
  adjust: { color: 'purple', label: 'Ajustement' }
}

function MovementsTab() {
  const moves = useAsync(() => api.stock.movements({ limit: 300 }), [])
  return (
    <Card>
      {moves.loading ? (
        <Spinner />
      ) : !moves.data?.length ? (
        <EmptyState icon={<ArrowDownUp size={40} />} title="Aucun mouvement de stock" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Produit</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 text-center font-semibold">Qté</th>
                <th className="px-4 py-3 font-semibold">Motif / Réf.</th>
              </tr>
            </thead>
            <tbody>
              {moves.data.map((m) => {
                const t = moveTypeLabel[m.type] || moveTypeLabel.adjust
                return (
                  <tr key={m.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                    <td className="px-4 py-3 text-ink-500">{formatDateTime(m.datetime)}</td>
                    <td className="px-4 py-3 font-medium text-ink-800">{m.product_name}</td>
                    <td className="px-4 py-3"><Badge color={t.color}>{t.label}</Badge></td>
                    <td className={'px-4 py-3 text-center font-bold ' + (m.qty >= 0 ? 'text-emerald-600' : 'text-red-600')}>{m.qty >= 0 ? '+' : ''}{m.qty}</td>
                    <td className="px-4 py-3 text-ink-500">{m.reason}{m.ref ? ` · ${m.ref}` : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
