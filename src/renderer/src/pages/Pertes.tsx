import { useState } from 'react'
import { Plus, Trash2, AlertTriangle, Package, Settings2, FileSpreadsheet } from 'lucide-react'
import type { Loss, LossType, Product } from '@shared/types'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useRole } from '../lib/role'
import { money, formatDateTime } from '../lib/format'
import {
  Button, Card, PageHeader, Modal, Field, Input, NumberInput, Select, Textarea,
  Badge, Spinner, EmptyState, StatCard, ConfirmDialog
} from '../components/ui'

export default function Pertes() {
  const toast = useToast()
  const { isAdmin } = useRole()
  const losses = useAsync(() => api.losses.list(), [])
  const summary = useAsync(() => api.losses.summary(), [])
  const [creating, setCreating] = useState(false)
  const [showTypes, setShowTypes] = useState(false)

  const doExport = async () => {
    const r = await api.excel.exportPertes()
    if (r.ok) toast.success('Export réussi')
    else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }

  return (
    <div>
      <PageHeader
        title="Pertes"
        subtitle="Suivi des produits perdus, offerts ou tombola"
        actions={
          <>
            <Button variant="outline" onClick={doExport}>
              <FileSpreadsheet size={16} /> Exporter
            </Button>
            <Button variant="outline" onClick={() => setShowTypes(true)}>
              <Settings2 size={16} /> Types de perte
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> Déclarer une perte
            </Button>
          </>
        }
      />

      {isAdmin && (
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-2">
          <StatCard label="Total pertes" value={String(summary.data?.count ?? 0)} icon={<AlertTriangle size={20} />} accent="red" />
          <StatCard label="Coût total" value={money(summary.data?.total_cost ?? 0)} icon={<Package size={20} />} accent="amber" />
        </div>
      )}

      <Card>
        {losses.loading ? (
          <Spinner />
        ) : !losses.data?.length ? (
          <EmptyState icon={<AlertTriangle size={40} />} title="Aucune perte enregistrée" hint="Les pertes déclarées apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Produit</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 text-center font-semibold">Qté</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-semibold">Coût</th>}
                  <th className="px-4 py-3 font-semibold">Raison</th>
                </tr>
              </thead>
              <tbody>
                {losses.data.map((l) => (
                  <tr key={l.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                    <td className="px-4 py-3 text-ink-600">{formatDateTime(l.datetime)}</td>
                    <td className="px-4 py-3 font-semibold text-ink-900">{l.product_name || '—'}</td>
                    <td className="px-4 py-3">
                      {l.loss_type_name ? <Badge color="red">{l.loss_type_name}</Badge> : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-ink-600">{l.qty}</td>
                    {isAdmin && <td className="px-4 py-3 text-right text-ink-600">{money(l.qty * l.unit_cost)}</td>}
                    <td className="px-4 py-3 text-ink-500">{l.reason || l.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <LossForm
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); losses.reload(); summary.reload() }}
        />
      )}

      {showTypes && <LossTypesModal onClose={() => setShowTypes(false)} />}
    </div>
  )
}

function LossForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const products = useAsync(() => api.products.list(), [])
  const lossTypes = useAsync(() => api.lossTypes.list(), [])
  const [saving, setSaving] = useState(false)
  const [productId, setProductId] = useState<number | ''>('')
  const [lossTypeId, setLossTypeId] = useState<number | ''>('')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const submit = async () => {
    if (!productId) return toast.error('Sélectionnez un produit')
    setSaving(true)
    const r = await api.losses.create({
      product_id: Number(productId),
      loss_type_id: lossTypeId ? Number(lossTypeId) : undefined,
      qty,
      reason: reason || undefined,
      note: note || undefined
    })
    setSaving(false)
    if (r.ok) { toast.success('Perte enregistrée'); onSaved() }
    else toast.error(r.error || 'Erreur')
  }

  return (
    <Modal open onClose={onClose} title="Déclarer une perte"
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={saving} onClick={submit}>Enregistrer</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Produit *">
            <Select value={productId} onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Choisir —</option>
              {products.data?.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (stock: {p.available_stock ?? p.stock_qty})</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Type de perte">
          <Select value={lossTypeId} onChange={(e) => setLossTypeId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— Aucun —</option>
            {lossTypes.data?.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Quantité">
          <NumberInput value={qty} onValue={setQty} />
        </Field>
        <div className="col-span-2">
          <Field label="Raison"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tombola, cadeau, casse…" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Note"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  )
}

function LossTypesModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const types = useAsync(() => api.lossTypes.list(), [])
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<LossType | null>(null)

  const add = async () => {
    if (!name.trim()) return
    const r = await api.lossTypes.create(name.trim())
    if (r.ok) { setName(''); types.reload(); toast.success('Type ajouté') }
    else toast.error(r.error || 'Erreur')
  }

  const remove = async () => {
    if (!deleting) return
    const r = await api.lossTypes.remove(deleting.id)
    if (r.ok) { types.reload(); toast.success('Type supprimé') }
    else toast.error(r.error || 'Erreur')
    setDeleting(null)
  }

  return (
    <Modal open onClose={onClose} title="Types de perte">
      <div className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau type (tombola, cadeau, casse…)"
          onKeyDown={(e) => { if (e.key === 'Enter') add() }} className="flex-1" />
        <Button onClick={add}>Ajouter</Button>
      </div>
      <div className="max-h-60 space-y-1.5 overflow-y-auto">
        {types.data?.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
            <span className="font-medium text-ink-800">{t.name}</span>
            <button onClick={() => setDeleting(t)} className="rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
        {!types.data?.length && <p className="py-4 text-center text-sm text-ink-400">Aucun type défini</p>}
      </div>
      <ConfirmDialog open={!!deleting} title="Supprimer le type" danger confirmLabel="Supprimer"
        message={`Supprimer « ${deleting?.name} » ?`} onConfirm={remove} onClose={() => setDeleting(null)} />
    </Modal>
  )
}
