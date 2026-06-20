import { useState } from 'react'
import {
  Wallet,
  HandCoins,
  Users,
  Phone,
  Receipt,
  MessageCircle,
  TrendingDown,
  FileSpreadsheet
} from 'lucide-react'
import type { CreditDebtor, LedgerEntry } from '@shared/types'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { money, formatDateTime } from '../lib/format'
import { useSettings } from '../lib/settings'
import { Button, Card, PageHeader, StatCard, Modal, Field, Input, NumberInput, Select, Spinner, EmptyState, Badge } from '../components/ui'

export default function Credit() {
  const toast = useToast()
  const summary = useAsync(() => api.credit.summary(), [])
  const debtors = useAsync(() => api.credit.debtors(), [])
  const [pay, setPay] = useState<CreditDebtor | null>(null)
  const [ledger, setLedger] = useState<CreditDebtor | null>(null)

  const reload = () => {
    summary.reload()
    debtors.reload()
  }

  const doExport = async () => {
    const r = await api.excel.exportCredit()
    if (r.ok) toast.success('Export réussi')
    else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }

  return (
    <div>
      <PageHeader title="Crédit & ardoise" subtitle="Suivi des dettes clients"
        actions={<Button variant="outline" onClick={doExport}><FileSpreadsheet size={16} /> Exporter</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total créances" value={money(summary.data?.total_due || 0)} icon={<TrendingDown size={20} />} accent="red" />
        <StatCard label="Clients débiteurs" value={summary.data?.debtors_count || 0} icon={<Users size={20} />} accent="amber" />
        <StatCard label="Encaissements" value="Espèces / Carte" icon={<HandCoins size={20} />} accent="green" sub="Cliquez « Encaisser »" />
      </div>

      <Card>
        {debtors.loading ? (
          <Spinner />
        ) : !debtors.data?.length ? (
          <EmptyState icon={<Wallet size={40} />} title="Aucune dette en cours" hint="Les ventes à crédit apparaîtront ici jusqu'à leur règlement." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Téléphone</th>
                  <th className="px-4 py-3 font-semibold">Dernier mouvement</th>
                  <th className="px-4 py-3 text-right font-semibold">Solde dû</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {debtors.data.map((d) => (
                  <tr key={d.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-red-100 font-bold text-red-700">
                          {d.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-ink-900">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{d.phone || <span className="text-ink-300">—</span>}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDateTime(d.last_movement)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-base font-extrabold text-red-600">{money(d.balance)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <WhatsAppButton debtor={d} />
                        <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setLedger(d)}>
                          <Receipt size={14} /> Relevé
                        </Button>
                        <Button variant="success" className="!py-1.5 text-xs" onClick={() => setPay(d)}>
                          <HandCoins size={14} /> Encaisser
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pay && <PaymentModal debtor={pay} onClose={() => setPay(null)} onDone={() => { setPay(null); reload() }} />}
      {ledger && <LedgerModal debtor={ledger} onClose={() => setLedger(null)} onChanged={reload} />}
    </div>
  )
}

function WhatsAppButton({ debtor }: { debtor: CreditDebtor }) {
  const { settings } = useSettings()
  if (!debtor.phone) return null
  const send = () => {
    const phone = debtor.phone!.replace(/[^0-9]/g, '').replace(/^0/, '213') // format international (Algérie)
    const msg = `Bonjour ${debtor.name}, rappel de votre solde chez ${settings?.store_name || ''} : ${money(debtor.balance)}. Merci.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }
  return (
    <button onClick={send} className="rounded-lg p-2 text-emerald-500 hover:bg-emerald-50" title="Relancer par WhatsApp">
      <MessageCircle size={16} />
    </button>
  )
}

function PaymentModal({ debtor, onClose, onDone }: { debtor: CreditDebtor; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [amount, setAmount] = useState<number>(debtor.balance)
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (amount <= 0) return toast.error('Montant invalide')
    setSaving(true)
    const r = await api.credit.addPayment({ customer_id: debtor.id, amount: Number(amount), method, note })
    setSaving(false)
    if (r.ok) {
      toast.success('Paiement enregistré')
      const pr = await api.credit.printReceipt({
        customer_name: debtor.name,
        amount: Number(amount),
        method,
        new_balance: Math.max(0, debtor.balance - Number(amount))
      })
      if (!pr.ok && pr.error) toast.error('Reçu non imprimé : ' + pr.error)
      onDone()
    } else toast.error(r.error || 'Erreur')
  }

  const remaining = debtor.balance - amount

  return (
    <Modal open onClose={onClose} size="sm" title={`Encaisser — ${debtor.name}`}
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button variant="success" loading={saving} onClick={submit}>Enregistrer</Button></>}>
      <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-center">
        <p className="text-xs uppercase tracking-wide text-red-400">Solde dû actuel</p>
        <p className="text-2xl font-extrabold text-red-600">{money(debtor.balance)}</p>
      </div>
      <Field label="Montant encaissé">
        <NumberInput value={amount} onValue={setAmount} autoFocus className="text-lg font-bold"
          onKeyDown={(e) => { if (e.key === 'Enter' && amount > 0) submit() }} />
      </Field>
      <div className="mt-2 flex gap-2">
        <button onClick={() => setAmount(debtor.balance)} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-ink-50">Solder ({money(debtor.balance)})</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Mode">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Espèces</option>
            <option value="card">Carte</option>
            <option value="transfer">Virement</option>
          </Select>
        </Field>
        <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="(optionnel)" /></Field>
      </div>
      <p className="mt-3 text-center text-sm text-ink-500">
        Reste après paiement : <b className={remaining > 0.01 ? 'text-red-600' : 'text-emerald-600'}>{money(Math.max(0, remaining))}</b>
      </p>
    </Modal>
  )
}

function LedgerModal({ debtor, onClose, onChanged }: { debtor: CreditDebtor; onClose: () => void; onChanged: () => void }) {
  const { data: entries, loading } = useAsync(() => api.credit.ledger(debtor.id), [debtor.id])
  const balance = entries?.length ? entries[entries.length - 1].balance ?? 0 : 0

  return (
    <Modal open onClose={onClose} size="lg" title={`Relevé de compte — ${debtor.name}`}
      footer={<Button variant="outline" onClick={onClose}>Fermer</Button>}>
      {loading ? (
        <Spinner />
      ) : !entries?.length ? (
        <EmptyState icon={<Receipt size={36} />} title="Aucun mouvement" />
      ) : (
        <div>
          <div className="overflow-hidden rounded-xl border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-400">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Opération</th>
                  <th className="px-3 py-2 text-right font-semibold">Dette</th>
                  <th className="px-3 py-2 text-right font-semibold">Payé</th>
                  <th className="px-3 py-2 text-right font-semibold">Solde</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-t border-ink-50">
                    <td className="px-3 py-2 text-ink-500">{formatDateTime(e.datetime)}</td>
                    <td className="px-3 py-2">
                      {e.type === 'sale' ? (
                        <Badge color="red">Vente {e.ref}</Badge>
                      ) : e.type === 'opening' ? (
                        <Badge color="blue">Solde de départ</Badge>
                      ) : (
                        <Badge color="green">Versement{e.method ? ` (${e.method})` : ''}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-red-600">{e.debit ? money(e.debit) : ''}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{e.credit ? money(e.credit) : ''}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink-900">{money(e.balance || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-950 px-5 py-3 text-white">
            <span className="font-semibold">Solde dû</span>
            <span className="text-xl font-extrabold">{money(balance)}</span>
          </div>
        </div>
      )}
    </Modal>
  )
}
