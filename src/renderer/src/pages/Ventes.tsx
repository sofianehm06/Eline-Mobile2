import { useState } from 'react'
import {
  Search,
  ReceiptText,
  Printer,
  Undo2,
  Eye,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  Clock,
  FileSpreadsheet
} from 'lucide-react'
import type { Sale } from '@shared/types'
import { api } from '../lib/api'
import { useAsync, useDebounced } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { money, formatDateTime, todayISO, firstOfMonthISO } from '../lib/format'
import { Button, Card, PageHeader, Input, NumberInput, Modal, Badge, Spinner, EmptyState, StatCard } from '../components/ui'

const payIcon: Record<string, any> = { cash: Banknote, card: CreditCard, transfer: ArrowLeftRight, credit: Clock }
const payLabel: Record<string, string> = { cash: 'Espèces', card: 'Carte', transfer: 'Virement', credit: 'Crédit' }

export default function Ventes() {
  const toast = useToast()
  const [from, setFrom] = useState(firstOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const sales = useAsync(() => api.sales.list({ from, to, search: debounced || undefined, limit: 500 }), [from, to, debounced])
  const [view, setView] = useState<number | null>(null)

  const completed = sales.data?.filter((s) => s.status !== 'refunded') || []
  const totalRevenue = completed.reduce((s, x) => s + x.total, 0)

  const doExport = async () => {
    const r = await api.excel.exportVentes()
    if (r.ok) toast.success('Export réussi')
    else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }

  return (
    <div>
      <PageHeader title="Ventes" subtitle="Historique des transactions"
        actions={<Button variant="outline" onClick={doExport}><FileSpreadsheet size={16} /> Exporter</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Transactions" value={completed.length} icon={<ReceiptText size={20} />} accent="brand" />
        <StatCard label="Total encaissé" value={money(totalRevenue)} icon={<Banknote size={20} />} accent="green" />
        <StatCard label="Période" value={`${formatDateTime(from).slice(0, 10)}`} sub={`au ${formatDateTime(to).slice(0, 10)}`} icon={<Clock size={20} />} accent="purple" />
      </div>

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <div>
          <label className="label">Du</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="label">Au</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="relative min-w-[200px] flex-1">
          <label className="label">Recherche</label>
          <Search size={16} className="absolute left-3 top-[2.15rem] text-ink-400" />
          <Input className="pl-9" placeholder="N° ticket ou client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card>
        {sales.loading ? (
          <Spinner />
        ) : !sales.data?.length ? (
          <EmptyState icon={<ReceiptText size={40} />} title="Aucune vente sur cette période" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">Ticket</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Paiement</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-center font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.data.map((s) => {
                  const PIcon = payIcon[s.payment_method] || Banknote
                  return (
                    <tr key={s.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                      <td className="px-4 py-3 font-semibold text-ink-900">{s.ref}</td>
                      <td className="px-4 py-3 text-ink-500">{formatDateTime(s.datetime)}</td>
                      <td className="px-4 py-3 text-ink-700">{s.customer_name || <span className="text-ink-300">Passage</span>}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-ink-600">
                          <PIcon size={14} /> {payLabel[s.payment_method]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-ink-900">{money(s.total)}</td>
                      <td className="px-4 py-3 text-center">
                        {s.status === 'refunded' ? (
                          <Badge color="red">Remboursé</Badge>
                        ) : s.status === 'partial' ? (
                          <Badge color="amber">Partiel</Badge>
                        ) : (
                          <Badge color="green">Validé</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button onClick={() => setView(s.id)} className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-600" title="Détails">
                            <Eye size={16} />
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

      {view && <SaleDetail id={view} onClose={() => setView(null)} onChanged={() => sales.reload()} />}
    </div>
  )
}

function SaleDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const { data: sale, loading, reload } = useAsync(() => api.sales.get(id), [id])
  const [printing, setPrinting] = useState(false)
  const [showRefund, setShowRefund] = useState(false)

  const reprint = async () => {
    if (!sale) return
    setPrinting(true)
    const r = await api.print.receipt(sale)
    setPrinting(false)
    if (r.ok) toast.success('Ticket réimprimé')
    else toast.error(r.error || 'Échec impression')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={sale ? `Ticket ${sale.ref}` : 'Détails'}
      footer={
        sale && (
          <>
            {sale.status !== 'refunded' && (
              <Button variant="danger" onClick={() => setShowRefund(true)}>
                <Undo2 size={16} /> Rembourser…
              </Button>
            )}
            <Button variant="outline" loading={printing} onClick={reprint}>
              <Printer size={16} /> Réimprimer
            </Button>
            <Button onClick={onClose}>Fermer</Button>
          </>
        )
      }
    >
      {loading || !sale ? (
        <Spinner />
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between text-sm text-ink-500">
            <span>{formatDateTime(sale.datetime)}</span>
            <span>{sale.customer_name || 'Client de passage'}</span>
          </div>
          {sale.status === 'refunded' && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-600">VENTE REMBOURSÉE</div>
          )}
          {sale.status === 'partial' && (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-bold text-amber-700">REMBOURSEMENT PARTIEL — montants nets affichés</div>
          )}
          <div className="overflow-hidden rounded-xl border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-400">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Article</th>
                  <th className="px-3 py-2 text-center font-semibold">Qté</th>
                  <th className="px-3 py-2 text-right font-semibold">P.U.</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items?.map((it) => (
                  <tr key={it.id} className="border-t border-ink-50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink-800">{it.name}</p>
                      {it.imei && <p className="font-mono text-xs text-ink-400">IMEI: {it.imei}</p>}
                    </td>
                    <td className="px-3 py-2 text-center text-ink-600">
                      {it.qty}
                      {(it.refunded_qty ?? 0) > 0 && <span className="ml-1 text-xs text-amber-600">({it.refunded_qty} remb.)</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-600">{money(it.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink-900">{money(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-500"><span>Sous-total</span><span>{money(sale.subtotal)}</span></div>
            {sale.discount > 0 && <div className="flex justify-between text-ink-500"><span>Remise</span><span>-{money(sale.discount)}</span></div>}
            <div className="flex justify-between border-t border-ink-100 pt-1.5 text-lg font-bold text-ink-900"><span>Total</span><span>{money(sale.total)}</span></div>
            <div className="flex justify-between text-ink-500"><span>Payé ({payLabel[sale.payment_method]})</span><span>{money(sale.paid)}</span></div>
            {sale.change_due > 0 && <div className="flex justify-between text-ink-500"><span>Rendu</span><span>{money(sale.change_due)}</span></div>}
          </div>
        </div>
      )}

      {showRefund && sale && (
        <RefundModal
          sale={sale}
          onClose={() => setShowRefund(false)}
          onDone={() => {
            setShowRefund(false)
            reload()
            onChanged()
          }}
        />
      )}
    </Modal>
  )
}

function RefundModal({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const refundable = (sale.items || []).filter((it) => it.qty > 0)
  const [qtys, setQtys] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)

  const perUnit = (it: (typeof refundable)[number]) => (it.qty > 0 ? it.line_total / it.qty : it.unit_price)
  const total = refundable.reduce((s, it) => s + (qtys[it.id] || 0) * perUnit(it), 0)
  const anything = total > 0 || Object.values(qtys).some((q) => q > 0)

  const setAll = () => {
    const all: Record<number, number> = {}
    for (const it of refundable) all[it.id] = it.qty
    setQtys(all)
  }

  const confirm = async () => {
    const items = refundable
      .map((it) => ({ sale_item_id: it.id, qty: qtys[it.id] || 0 }))
      .filter((x) => x.qty > 0)
    if (!items.length) return toast.error('Sélectionnez au moins un article à rembourser')
    setSaving(true)
    const r = await api.sales.refund(sale.id, items)
    setSaving(false)
    if (r.ok) {
      toast.success('Remboursement effectué, stock réintégré')
      onDone()
    } else toast.error(r.error || 'Erreur')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Rembourser des articles"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="outline" onClick={setAll}>
            Tout rembourser
          </Button>
          <Button variant="danger" loading={saving} disabled={!anything} onClick={confirm}>
            <Undo2 size={16} /> Rembourser {money(total)}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-500">Choisissez la quantité à rendre pour chaque article. Le stock est réintégré automatiquement.</p>
      <div className="space-y-2">
        {refundable.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">{it.name}</p>
              <p className="text-xs text-ink-400">
                {money(perUnit(it))} / u · en stock vendu : {it.qty}
                {it.imei ? ` · IMEI ${it.imei}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <NumberInput
                className="w-20 text-center"
                min={0}
                max={it.qty}
                value={qtys[it.id] ?? 0}
                onValue={(n) => setQtys((s) => ({ ...s, [it.id]: Math.min(n, it.qty) }))}
              />
              <span className="text-xs text-ink-400">/ {it.qty}</span>
            </div>
          </div>
        ))}
        {!refundable.length && <p className="py-6 text-center text-sm text-ink-400">Plus rien à rembourser sur cette vente.</p>}
      </div>
    </Modal>
  )
}
