import { useState } from 'react'
import { Repeat, Plus, Smartphone, ShoppingBag, Boxes, TrendingUp, FileSpreadsheet } from 'lucide-react'
import type { Product, TradeIn } from '@shared/types'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { useRole } from '../lib/role'
import { money, formatDateTime } from '../lib/format'
import { Button, Card, PageHeader, StatCard, Modal, Field, Input, NumberInput, Select, Textarea, Badge, Spinner, EmptyState } from '../components/ui'

const CONDITIONS = ['Neuf', 'Très bon', 'Bon', 'Moyen', 'Pour pièces']

export default function Reprise() {
  const toast = useToast()
  const { isAdmin } = useRole()
  const stats = useAsync(() => api.tradein.stats(), [])
  const list = useAsync(() => api.tradein.list(), [])
  const [creating, setCreating] = useState(false)

  const reload = () => {
    stats.reload()
    list.reload()
  }

  return (
    <div>
      <PageHeader
        title="Reprise d'occasion"
        subtitle="Rachat de téléphones d'occasion → entrent directement en stock"
        actions={
          <>
            <Button variant="outline" onClick={async () => {
              const r = await api.excel.exportReprise()
              if (r.ok) toast.success('Export réussi')
              else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
            }}><FileSpreadsheet size={16} /> Exporter</Button>
            <Button onClick={() => setCreating(true)}><Plus size={16} /> Nouvelle reprise</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reprises" value={stats.data?.count || 0} icon={<Repeat size={20} />} accent="brand" />
        {isAdmin && <StatCard label="Total racheté" value={money(stats.data?.total_bought || 0)} icon={<ShoppingBag size={20} />} accent="amber" />}
        <StatCard label="En stock" value={stats.data?.in_stock || 0} icon={<Boxes size={20} />} accent="purple" />
        {isAdmin && <StatCard label="Marge potentielle" value={money(stats.data?.potential_margin || 0)} icon={<TrendingUp size={20} />} accent="green" />}
      </div>

      <Card>
        {list.loading ? (
          <Spinner />
        ) : !list.data?.length ? (
          <EmptyState icon={<Repeat size={40} />} title="Aucune reprise" hint="Rachetez un téléphone d'occasion : il entrera automatiquement en stock, prêt à être revendu." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Modèle</th>
                  <th className="px-4 py-3 font-semibold">IMEI</th>
                  <th className="px-4 py-3 font-semibold">État</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-semibold">Racheté</th>}
                  <th className="px-4 py-3 text-right font-semibold">Revente</th>
                  <th className="px-4 py-3 text-center font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((t) => (
                  <tr key={t.id} className="border-b border-ink-50 hover:bg-ink-50/60">
                    <td className="px-4 py-3 text-ink-500">{formatDateTime(t.datetime)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-500"><Smartphone size={15} /></div>
                        <span className="font-semibold text-ink-900">{t.model}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-700">{t.imei}</td>
                    <td className="px-4 py-3"><Badge color="purple">{t.condition}</Badge></td>
                    <td className="px-4 py-3 text-ink-600">{t.customer_name || <span className="text-ink-300">—</span>}</td>
                    {isAdmin && <td className="px-4 py-3 text-right text-ink-600">{money(t.buy_price)}</td>}
                    <td className="px-4 py-3 text-right font-semibold text-ink-900">{money(t.resale_price)}</td>
                    <td className="px-4 py-3 text-center">
                      {t.unit_status === 'sold' ? <Badge color="gray">Revendu</Badge> : <Badge color="green">En stock</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && <TradeInForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload() }} />}
    </div>
  )
}

function TradeInForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const phones = useAsync(() => api.products.list({ type: 'phone' }), [])
  const customers = useAsync(() => api.customers.list(), [])
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    productMode: 'new' as 'new' | 'existing',
    product_id: '' as number | '',
    model: '',
    imei: '',
    condition: 'Très bon',
    buy_price: 0,
    resale_price: 0,
    customer_id: '' as number | '',
    note: ''
  })
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }))
  const margin = f.resale_price - f.buy_price

  const submit = async () => {
    if (!f.imei.trim()) return toast.error('IMEI requis')
    if (f.productMode === 'existing' && !f.product_id) return toast.error('Choisissez un produit')
    if (f.productMode === 'new' && !f.model.trim()) return toast.error('Saisissez le modèle')
    setSaving(true)
    const r = await api.tradein.create({
      customer_id: f.customer_id ? Number(f.customer_id) : null,
      product_id: f.productMode === 'existing' ? Number(f.product_id) : null,
      model: f.productMode === 'new' ? f.model.trim() : undefined,
      imei: f.imei.trim(),
      condition: f.condition,
      buy_price: Number(f.buy_price),
      resale_price: Number(f.resale_price),
      note: f.note
    })
    setSaving(false)
    if (r.ok) { toast.success('Reprise enregistrée — téléphone ajouté au stock'); onSaved() }
    else toast.error(r.error || 'Erreur')
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Nouvelle reprise d'occasion"
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={saving} onClick={submit}>Racheter & ajouter au stock</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Produit">
            <div className="flex gap-2">
              <Select value={f.productMode} onChange={(e) => set('productMode', e.target.value)} className="w-52">
                <option value="new">Nouveau modèle</option>
                <option value="existing">Produit existant</option>
              </Select>
              {f.productMode === 'new' ? (
                <Input value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="Ex: iPhone 11 64Go" autoFocus />
              ) : (
                <Select value={f.product_id} onChange={(e) => set('product_id', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">— Choisir —</option>
                  {phones.data?.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              )}
            </div>
          </Field>
        </div>

        <Field label="IMEI *"><Input value={f.imei} onChange={(e) => set('imei', e.target.value)} placeholder="Scanner ou saisir l'IMEI" className="font-mono" /></Field>
        <Field label="État">
          <Select value={f.condition} onChange={(e) => set('condition', e.target.value)}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>

        <Field label="Prix de rachat (ce que vous payez)"><NumberInput value={f.buy_price} onValue={(n) => set('buy_price', n)} /></Field>
        <Field label="Prix de revente prévu" hint={margin >= 0 ? `Marge: ${money(margin)}` : 'Marge négative !'}>
          <NumberInput value={f.resale_price} onValue={(n) => set('resale_price', n)} />
        </Field>

        <Field label="Client (qui vend, optionnel)">
          <Select value={f.customer_id} onChange={(e) => set('customer_id', e.target.value ? Number(e.target.value) : '')}>
            <option value="">— Aucun —</option>
            {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Note (rayures, accessoires…)"><Input value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
      </div>
      <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
        💡 Le téléphone repris entre en stock avec son IMEI et son état. Vous pourrez le revendre normalement depuis la Caisse.
      </p>
    </Modal>
  )
}
