import { useState } from 'react'
import { BarChart3, Download, TrendingUp, Wallet, ShoppingBag, Coins } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { money, num, todayISO, firstOfMonthISO } from '../lib/format'
import { Button, Card, PageHeader, Input, Select, StatCard, Spinner, EmptyState } from '../components/ui'

export default function Rapports() {
  const [from, setFrom] = useState(firstOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [group, setGroup] = useState<'day' | 'month'>('day')

  const summary = useAsync(() => api.reports.summary({ from, to }), [from, to])
  const byPeriod = useAsync(() => api.reports.byPeriod({ from, to, group }), [from, to, group])
  const top = useAsync(() => api.reports.topProducts({ from, to, limit: 15 }), [from, to])

  const chart = (byPeriod.data || []).map((r) => ({
    label: group === 'month' ? r.period : r.period.slice(8) + '/' + r.period.slice(5, 7),
    CA: Math.round(r.revenue),
    Bénéfice: Math.round(r.profit)
  }))

  const exportCsv = () => {
    const rows = [
      ['Période', 'Ventes', 'Chiffre affaires', 'Coût', 'Bénéfice'],
      ...(byPeriod.data || []).map((r) => [r.period, r.count, r.revenue.toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2)])
    ]
    const csv = rows.map((r) => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapport-ventes-${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const margin = summary.data && summary.data.revenue > 0 ? (summary.data.profit / summary.data.revenue) * 100 : 0

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle="Analyse des ventes et de la rentabilité"
        actions={<Button variant="outline" onClick={exportCsv}><Download size={16} /> Exporter CSV</Button>}
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <div><label className="label">Du</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
        <div><label className="label">Au</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        <div><label className="label">Regroupement</label>
          <Select value={group} onChange={(e) => setGroup(e.target.value as 'day' | 'month')} className="w-40">
            <option value="day">Par jour</option>
            <option value="month">Par mois</option>
          </Select>
        </div>
        <div className="flex gap-2">
          {[
            ['Aujourd\'hui', todayISO(), todayISO()],
            ['Ce mois', firstOfMonthISO(), todayISO()]
          ].map(([label, f, t]) => (
            <button key={label} onClick={() => { setFrom(f); setTo(t) }} className="self-end rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
              {label}
            </button>
          ))}
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ventes" value={num(summary.data?.count || 0)} icon={<ShoppingBag size={20} />} accent="brand" />
        <StatCard label="Chiffre d'affaires" value={money(summary.data?.revenue || 0)} icon={<Wallet size={20} />} accent="purple" />
        <StatCard label="Bénéfice" value={money(summary.data?.profit || 0)} icon={<TrendingUp size={20} />} accent="green" sub={`Marge ${margin.toFixed(1)}%`} />
        <StatCard label="Coût des ventes" value={money(summary.data?.cost || 0)} icon={<Coins size={20} />} accent="amber" />
      </div>

      <Card className="mb-4 p-5">
        <h3 className="mb-4 font-bold text-ink-900">Chiffre d'affaires & bénéfice</h3>
        {byPeriod.loading ? (
          <Spinner />
        ) : !chart.length ? (
          <EmptyState icon={<BarChart3 size={36} />} title="Aucune donnée sur cette période" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -5, right: 10, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#828ea9' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#828ea9' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => num(v)} />
                <Tooltip formatter={(v: number, n) => [money(v), n]} contentStyle={{ borderRadius: 12, border: '1px solid #eef0f5', fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="CA" fill="#3563ff" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Bénéfice" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-bold text-ink-900">Détail par période</h3>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-ink-400">
                <tr className="border-b border-ink-100 text-left">
                  <th className="py-2 font-semibold">Période</th>
                  <th className="py-2 text-center font-semibold">Ventes</th>
                  <th className="py-2 text-right font-semibold">CA</th>
                  <th className="py-2 text-right font-semibold">Bénéfice</th>
                </tr>
              </thead>
              <tbody>
                {byPeriod.data?.map((r) => (
                  <tr key={r.period} className="border-b border-ink-50">
                    <td className="py-2 font-medium text-ink-800">{r.period}</td>
                    <td className="py-2 text-center text-ink-600">{r.count}</td>
                    <td className="py-2 text-right text-ink-900">{money(r.revenue)}</td>
                    <td className="py-2 text-right font-semibold text-emerald-600">{money(r.profit)}</td>
                  </tr>
                ))}
                {!byPeriod.data?.length && <tr><td colSpan={4} className="py-6 text-center text-ink-400">Aucune donnée</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-bold text-ink-900">Produits les plus rentables</h3>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-ink-400">
                <tr className="border-b border-ink-100 text-left">
                  <th className="py-2 font-semibold">Produit</th>
                  <th className="py-2 text-center font-semibold">Qté</th>
                  <th className="py-2 text-right font-semibold">CA</th>
                  <th className="py-2 text-right font-semibold">Bénéfice</th>
                </tr>
              </thead>
              <tbody>
                {top.data?.map((p, i) => (
                  <tr key={i} className="border-b border-ink-50">
                    <td className="py-2 font-medium text-ink-800">{p.name}</td>
                    <td className="py-2 text-center text-ink-600">{num(p.qty)}</td>
                    <td className="py-2 text-right text-ink-900">{money(p.revenue)}</td>
                    <td className="py-2 text-right font-semibold text-emerald-600">{money(p.profit)}</td>
                  </tr>
                ))}
                {!top.data?.length && <tr><td colSpan={4} className="py-6 text-center text-ink-400">Aucune donnée</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
