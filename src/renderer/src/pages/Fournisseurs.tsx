import { useState } from 'react'
import { Plus, Pencil, Trash2, Truck, Phone, FileSpreadsheet } from 'lucide-react'
import type { Supplier } from '@shared/types'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { Button, Card, PageHeader, Modal, Field, Input, Textarea, Spinner, EmptyState, ConfirmDialog } from '../components/ui'

export default function Fournisseurs() {
  const toast = useToast()
  const suppliers = useAsync(() => api.suppliers.list(), [])
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Supplier | null>(null)

  const remove = async () => {
    if (!deleting) return
    const r = await api.suppliers.remove(deleting.id)
    if (r.ok) toast.success('Fournisseur supprimé')
    else toast.error(r.error || 'Erreur')
    setDeleting(null)
    suppliers.reload()
  }

  return (
    <div>
      <PageHeader title="Fournisseurs" subtitle="Vos fournisseurs et grossistes"
        actions={
          <>
            <Button variant="outline" onClick={async () => {
              const r = await api.excel.exportFournisseurs()
              if (r.ok) toast.success('Export réussi')
              else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
            }}><FileSpreadsheet size={16} /> Exporter</Button>
            <Button onClick={() => setCreating(true)}><Plus size={16} /> Nouveau fournisseur</Button>
          </>
        }
      />

      <Card>
        {suppliers.loading ? (
          <Spinner />
        ) : !suppliers.data?.length ? (
          <EmptyState icon={<Truck size={40} />} title="Aucun fournisseur" hint="Ajoutez vos fournisseurs pour tracer l'origine des produits." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">Fournisseur</th>
                  <th className="px-4 py-3 font-semibold">Téléphone</th>
                  <th className="px-4 py-3 font-semibold">Adresse</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.data.map((s) => (
                  <tr key={s.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 text-amber-700"><Truck size={16} /></div>
                        <div>
                          <p className="font-semibold text-ink-900">{s.name}</p>
                          {s.notes && <p className="text-xs text-ink-400">{s.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{s.phone ? <span className="flex items-center gap-1.5"><Phone size={13} /> {s.phone}</span> : <span className="text-ink-300">—</span>}</td>
                    <td className="px-4 py-3 text-ink-600">{s.address || <span className="text-ink-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(s)} className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-600"><Pencil size={16} /></button>
                        <button onClick={() => setDeleting(s)} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <SupplierForm supplier={editing} onClose={() => { setCreating(false); setEditing(null) }} onSaved={() => { setCreating(false); setEditing(null); suppliers.reload() }} />
      )}
      <ConfirmDialog open={!!deleting} title="Supprimer le fournisseur" danger confirmLabel="Supprimer" message={`Supprimer « ${deleting?.name} » ?`} onConfirm={remove} onClose={() => setDeleting(null)} />
    </div>
  )
}

function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    name: supplier?.name || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    notes: supplier?.notes || ''
  })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))

  const submit = async () => {
    if (!f.name.trim()) return toast.error('Le nom est requis')
    setSaving(true)
    const r = supplier ? await api.suppliers.update({ ...f, id: supplier.id }) : await api.suppliers.create(f)
    setSaving(false)
    if (r.ok) { toast.success(supplier ? 'Fournisseur modifié' : 'Fournisseur créé'); onSaved() } else toast.error(r.error || 'Erreur')
  }

  return (
    <Modal open onClose={onClose} title={supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={saving} onClick={submit}>{supplier ? 'Enregistrer' : 'Créer'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Nom *"><Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field></div>
        <Field label="Téléphone"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Adresse"><Input value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <div className="col-span-2"><Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field></div>
      </div>
    </Modal>
  )
}
