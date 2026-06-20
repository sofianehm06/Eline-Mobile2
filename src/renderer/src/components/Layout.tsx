import { NavLink, useLocation } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Repeat,
  ReceiptText,
  Wallet,
  Users,
  Truck,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  Settings as SettingsIcon,
  Smartphone,
  Lock,
  KeyRound,
  ShieldCheck
} from 'lucide-react'
import { useSettings } from '../lib/settings'
import { useRole } from '../lib/role'
import { Modal, Button, Input } from './ui'
import { useToast } from '../lib/toast'

const nav = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { to: '/caisse', label: 'Caisse', icon: ShoppingCart },
  { to: '/produits', label: 'Produits', icon: Package },
  { to: '/stock', label: 'Stock', icon: Boxes },
  { to: '/reprise', label: 'Reprise', icon: Repeat },
  { to: '/ventes', label: 'Ventes', icon: ReceiptText },
  { to: '/credit', label: 'Crédit', icon: Wallet },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: Truck },
  { to: '/receptions', label: 'Réceptions', icon: ClipboardList },
  { to: '/pertes', label: 'Pertes', icon: AlertTriangle },
  { to: '/rapports', label: 'Rapports', icon: BarChart3, admin: true },
  { to: '/parametres', label: 'Paramètres', icon: SettingsIcon, admin: true }
]

export function Layout({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { isAdmin, pinEnabled, lock } = useRole()
  const location = useLocation()
  const isCaisse = location.pathname === '/caisse'
  const [pinOpen, setPinOpen] = useState(false)

  const visibleNav = nav.filter((n) => isAdmin || !n.admin)

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#f4f6fb]">
      {/* Barre latérale */}
      <aside className="flex w-60 shrink-0 flex-col bg-ink-950 text-ink-200">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-lg">
            {settings?.logo ? (
              <img src={settings.logo} className="h-10 w-10 rounded-xl object-cover" alt="" />
            ) : (
              <Smartphone size={22} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{settings?.store_name || 'Ma Boutique'}</p>
            <p className="text-[11px] text-ink-400">{isAdmin ? 'Mode patron' : 'Mode vendeur'}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exact}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-600 text-white shadow' : 'text-ink-300 hover:bg-ink-900 hover:text-white'
                )
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Verrouillage / déverrouillage */}
        {pinEnabled && (
          <div className="px-3 pb-1">
            {isAdmin ? (
              <button
                onClick={lock}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-300 hover:bg-ink-900 hover:text-white"
              >
                <Lock size={18} /> Verrouiller (mode vendeur)
              </button>
            ) : (
              <button
                onClick={() => setPinOpen(true)}
                className="flex w-full items-center gap-3 rounded-lg bg-brand-600/20 px-3 py-2.5 text-sm font-semibold text-brand-200 hover:bg-brand-600/30"
              >
                <KeyRound size={18} /> Déverrouiller (patron)
              </button>
            )}
          </div>
        )}

        <div className="border-t border-ink-900 px-5 py-3 text-[11px] text-ink-500">{settings?.store_name || 'POS'} · v1.0</div>
      </aside>

      {/* Contenu */}
      <main className="flex-1 overflow-hidden">
        <div className={clsx('h-full', isCaisse ? 'overflow-hidden' : 'overflow-y-auto p-6')}>{children}</div>
      </main>

      {pinOpen && <PinModal onClose={() => setPinOpen(false)} />}
    </div>
  )
}

function PinModal({ onClose }: { onClose: () => void }) {
  const { unlock } = useRole()
  const toast = useToast()
  const [pin, setPin] = useState('')

  const submit = () => {
    if (unlock(pin)) {
      toast.success('Mode patron activé')
      onClose()
    } else {
      toast.error('Code incorrect')
      setPin('')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Code patron"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit}>
            <ShieldCheck size={16} /> Déverrouiller
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Lock size={26} />
        </div>
        <p className="text-center text-sm text-ink-500">Entrez le code patron pour accéder aux bénéfices, rapports et paramètres.</p>
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="Code PIN"
          className="text-center text-lg tracking-widest"
          autoFocus
        />
      </div>
    </Modal>
  )
}
