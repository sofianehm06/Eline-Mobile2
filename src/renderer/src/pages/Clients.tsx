import { useState } from 'react'
import { Search, Plus, Pencil, Trash2, Users, Phone, Mail, FileText, ShoppingBag, Wallet, CreditCard, Repeat, FileSpreadsheet } from 'lucide-react'
import type { Customer, CustomerStatement } from '@shared/types'
import { api } from '../lib/api'
import { useAsync, useDebounced } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useRole } from '../lib/role'
import { money, formatDateTime } from '../lib/format'
import { Button, Card, PageHeader, Modal, Field, Input, Textarea, Badge, Spinner, EmptyState, ConfirmDialog } from '../components/ui'

export default function Clients() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const customers = useAsync(() => api.customers.list(debounced || undefined), [debounced])
  const { isAdmin } = useRole()
  const [editing, setEditing] = useState<Customer | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [statementId, setStatementId] = useState<number | null>(null)

  const remove = async () => {
    if (!deleting) return
    const r = await api.customers.remove(deleting.id)
    if (r.ok) toast.success('Client supprimé')
    else toast.error(r.error || 'Erreur')
    setDeleting(null)
    customers.reload()
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Fichier clients et historique d'achats"
        actions={
          <>
            <Button variant="outline" onClick={async () => {
              const r = await api.excel.exportClients()
              if (r.ok) toast.success('Export réussi')
              else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
            }}><FileSpreadsheet size={16} /> Exporter</Button>
            <Button onClick={() => setCreating(true)}><Plus size={16} /> Nouveau client</Button>
          </>
        }
      />

      <Card className="mb-4 flex items-center gap-3 p-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input className="pl-9" placeholder="Rechercher un client (nom, téléphone)…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
      </Card>

      <Card>
        {customers.loading ? (
          <Spinner />
        ) : !customers.data?.length ? (
          <EmptyState icon={<Users size={40} />} title="Aucun client" hint="Ajoutez vos clients pour suivre leurs achats et garanties." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.data.map((c) => (
                  <tr key={c.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-ink-900">{c.name}</p>
                          {c.address && <p className="text-xs text-ink-400">{c.address}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {c.phone && <p className="flex items-center gap-1.5"><Phone size={13} /> {c.phone}</p>}
                      {c.email && <p className="flex items-center gap-1.5 text-xs text-ink-400"><Mail size={12} /> {c.email}</p>}
                      {!c.phone && !c.email && <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setStatementId(c.id)} className="rounded-lg p-2 text-ink-400 hover:bg-emerald-50 hover:text-emerald-600" title="Relevé client"><FileText size={16} /></button>
                        <button onClick={() => setEditing(c)} className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-600"><Pencil size={16} /></button>
                        <button onClick={() => setDeleting(c)} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
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
        <CustomerForm customer={editing} onClose={() => { setCreating(false); setEditing(null) }} onSaved={() => { setCreating(false); setEditing(null); customers.reload() }} />
      )}
      <ConfirmDialog open={!!deleting} title="Supprimer le client" danger confirmLabel="Supprimer" message={`Supprimer « ${deleting?.name} » ? L'historique des ventes sera conservé.`} onConfirm={remove} onClose={() => setDeleting(null)} />
      {statementId !== null && <CustomerStatementModal customerId={statementId} onClose={() => setStatementId(null)} />}
    </div>
  )
}

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    notes: customer?.notes || ''
  })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))

  const submit = async () => {
    if (!f.name.trim()) return toast.error('Le nom est requis')
    setSaving(true)
    const r = customer ? await api.customers.update({ ...f, id: customer.id }) : await api.customers.create(f)
    setSaving(false)
    if (r.ok) { toast.success(customer ? 'Client modifié' : 'Client créé'); onSaved() } else toast.error(r.error || 'Erreur')
  }

  return (
    <Modal open onClose={onClose} title={customer ? 'Modifier le client' : 'Nouveau client'}
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={saving} onClick={submit}>{customer ? 'Enregistrer' : 'Créer'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Nom complet *"><Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field></div>
        <Field label="Téléphone"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><Input value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <div className="col-span-2"><Field label="Adresse"><Input value={f.address} onChange={(e) => set('address', e.target.value)} /></Field></div>
        <div className="col-span-2"><Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field></div>
      </div>
    </Modal>
  )
}

function CustomerStatementModal({ customerId, onClose }: { customerId: number; onClose: () => void }) {
  const toast = useToast()
  const { isAdmin } = useRole()
  const statement = useAsync(() => api.customerStatement.get(customerId), [customerId])

  if (statement.loading) return <Modal open onClose={onClose} title="Chargement…"><Spinner /></Modal>
  if (!statement.data) return <Modal open onClose={onClose} title="Erreur"><p>Client introuvable</p></Modal>

  const s = statement.data
  const typeIcon = (t: string) => {
    switch (t) {
      case 'sale': return <ShoppingBag size={14} className="text-brand-500" />
      case 'payment': return <Wallet size={14} className="text-emerald-500" />
      case 'tradein': return <Repeat size={14} className="text-purple-500" />
      case 'refund': return <CreditCard size={14} className="text-red-500" />
      default: return null
    }
  }
  const typeLabel = (t: string) => {
    switch (t) {
      case 'sale': return 'Vente'
      case 'payment': return 'Encaissement'
      case 'tradein': return 'Reprise'
      case 'refund': return 'Remboursement'
      default: return t
    }
  }

  const doExport = async () => {
    const r = await api.excel.exportStatement(customerId)
    if (r.ok) toast.success('Export réussi')
    else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }

  return (
    <Modal open onClose={onClose} size="lg" title={`Relevé — ${s.customer.name}`}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" onClick={doExport}><FileSpreadsheet size={16} /> Exporter Excel</Button>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </div>
      }>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-brand-50 p-3 text-center">
          <p className="text-xs text-brand-600">Total achats</p>
          <p className="text-lg font-bold text-brand-700">{isAdmin ? money(s.total_purchases) : '—'}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-xs text-emerald-600">Total encaissé</p>
          <p className="text-lg font-bold text-emerald-700">{isAdmin ? money(s.total_paid) : '—'}</p>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center">
          <p className="text-xs text-red-600">Solde crédit</p>
          <p className="text-lg font-bold text-red-700">{money(s.credit_balance)}</p>
        </div>
      </div>

      {s.customer.phone && <p className="mb-1 text-sm text-ink-500"><Phone size={13} className="mr-1 inline" />{s.customer.phone}</p>}
      {s.customer.email && <p className="mb-1 text-sm text-ink-500"><Mail size={13} className="mr-1 inline" />{s.customer.email}</p>}
      {s.customer.address && <p className="mb-3 text-sm text-ink-500">{s.customer.address}</p>}

      <h4 className="mb-2 font-bold text-ink-900">Historique détaillé</h4>
      <div className="max-h-[400px] overflow-y-auto">
        {!s.entries.length ? (
          <p className="py-6 text-center text-ink-400">Aucune action enregistrée</p>
        ) : (
          <div className="space-y-2">
            {s.entries.map((e, i) => (
              <div key={i} className="rounded-lg border border-ink-100 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {typeIcon(e.type)}
                    <Badge color={e.type === 'sale' ? 'blue' : e.type === 'payment' ? 'green' : e.type === 'tradein' ? 'purple' : 'red'}>
                      {typeLabel(e.type)}
                    </Badge>
                    <span className="text-xs text-ink-400">{formatDateTime(e.datetime)}</span>
                  </div>
                  {isAdmin && (
                    <span className={`font-bold ${e.type === 'refund' ? 'text-red-600' : e.type === 'payment' ? 'text-emerald-600' : 'text-ink-900'}`}>
                      {e.type === 'refund' ? '-' : ''}{money(e.amount)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-700">{e.description}</p>
                {e.detail && <p className="mt-0.5 text-xs text-ink-400">{e.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
