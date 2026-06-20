import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  Wallet,
  ShoppingBag,
  Package,
  AlertTriangle,
  Smartphone,
  Boxes,
  ArrowRight,
  Store
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { money, num, formatDate, formatTime } from '../lib/format'
import { Card, PageHeader, StatCard, Spinner, Badge } from '../components/ui'
import { useSettings } from '../lib/settings'
import { useRole } from '../lib/role'

export default function Dashboard() {
  const nav = useNavigate()
  const { settings } = useSettings()
  const { isAdmin } = useRole()
  const { data, loading } = useAsync(() => api.dashboard.stats(), [])

  if (loading || !data) return <Spinner label="Chargement du tableau de bord…" />

  const chartData = data.sales_last_14_days.map((d) => ({
    label: d.date.slice(8) + '/' + d.date.slice(5, 7),
    CA: Math.round(d.revenue)
  }))

  return (
    <div>
      <PageHeader
        title={`Bonjour 👋`}
        subtitle={`Voici l'activité de ${settings?.store_name || 'votre boutique'} aujourd'hui.`}
      />

      {!settings?.store_name && (
        <div className="mb-5 flex items-center gap-4 rounded-xl border-2 border-brand-200 bg-brand-50 p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Store size={24} /></div>
          <div className="flex-1">
            <h3 className="font-bold text-brand-900">Configurez votre boutique</h3>
            <p className="text-sm text-brand-700">Ajoutez le nom, le logo et les coordonnées de votre boutique dans les paramètres pour personnaliser l'application.</p>
          </div>
          <button onClick={() => nav('/parametres')} className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Configurer
          </button>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ventes du jour" value={num(data.today_sales_count)} icon={<ShoppingBag size={22} />} accent="brand" />
        {isAdmin && <StatCard label="Bénéfice du jour" value={money(data.today_profit)} icon={<TrendingUp size={22} />} accent="green" />}
        {isAdmin && <StatCard label="CA du mois" value={money(data.month_revenue)} icon={<Wallet size={22} />} accent="purple" sub={`Bénéfice ${money(data.month_profit)}`} />}
        {isAdmin ? (
          <StatCard label="Valeur du stock" value={money(data.stock_value)} icon={<Boxes size={22} />} accent="amber" sub={`${num(data.imei_in_stock)} tél. en stock`} />
        ) : (
          <StatCard label="Téléphones en stock" value={num(data.imei_in_stock)} icon={<Boxes size={22} />} accent="amber" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Graphique CA — admin seulement */}
        {isAdmin && (
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-ink-900">Chiffre d'affaires — 14 derniers jours</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 5 }}>
                  <defs>
                    <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3563ff" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3563ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#828ea9' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#828ea9' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => num(v)} />
                  <Tooltip
                    formatter={(v: number) => [money(v), 'CA']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #eef0f5', fontSize: 13 }}
                  />
                  <Area type="monotone" dataKey="CA" stroke="#3563ff" strokeWidth={2.5} fill="url(#ca)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Stock faible */}
        <Card className={`p-5${isAdmin ? '' : ' lg:col-span-3'}`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-ink-900">
              <AlertTriangle size={18} className="text-amber-500" /> Stock faible
            </h3>
            <Badge color={data.low_stock_count > 0 ? 'red' : 'green'}>{data.low_stock_count}</Badge>
          </div>
          {!data.low_stock_products.length ? (
            <p className="py-8 text-center text-sm text-ink-400">Tous les stocks sont bons ✅</p>
          ) : (
            <div className="space-y-2">
              {data.low_stock_products.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-ink-100 text-ink-500">
                      {p.type === 'phone' ? <Smartphone size={14} /> : <Package size={14} />}
                    </div>
                    <span className="truncate text-sm font-medium text-ink-800">{p.name}</span>
                  </div>
                  <Badge color="red">{p.available_stock} restant</Badge>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => nav('/stock')} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50">
            Gérer le stock <ArrowRight size={15} />
          </button>
        </Card>
      </div>

      <div className={`mt-4 grid grid-cols-1 gap-4 ${isAdmin ? 'lg:grid-cols-2' : ''}`}>
        {/* Ventes récentes */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-ink-900">Ventes récentes</h3>
            <button onClick={() => nav('/ventes')} className="text-sm font-semibold text-brand-600 hover:underline">
              Tout voir
            </button>
          </div>
          {!data.recent_sales.length ? (
            <p className="py-8 text-center text-sm text-ink-400">Aucune vente pour le moment</p>
          ) : (
            <div className="divide-y divide-ink-50">
              {data.recent_sales.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{s.ref}</p>
                    <p className="text-xs text-ink-400">
                      {formatDate(s.datetime)} · {formatTime(s.datetime)} {s.customer_name ? `· ${s.customer_name}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    {isAdmin && <p className="font-bold text-ink-900">{money(s.total)}</p>}
                    {s.status === 'refunded' && <Badge color="red">Remboursé</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top produits — admin seulement */}
        {isAdmin && <Card className="p-5">
          <h3 className="mb-3 font-bold text-ink-900">Meilleures ventes (30 j)</h3>
          {!data.top_products.length ? (
            <p className="py-8 text-center text-sm text-ink-400">Pas encore de données</p>
          ) : (
            <div className="space-y-3">
              {data.top_products.map((p, i) => {
                const max = data.top_products[0].revenue || 1
                return (
                  <div key={i}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-ink-800">
                        <span className="mr-2 text-ink-400">#{i + 1}</span>
                        {p.name}
                      </span>
                      <span className="ml-2 shrink-0 font-bold text-ink-900">{money(p.revenue)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(p.revenue / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>}
      </div>
    </div>
  )
}
