import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { Layout } from './components/Layout'
import { useRole } from './lib/role'
import { api } from './lib/api'
import { Spinner } from './components/ui'
import Activation from './pages/Activation'
import Dashboard from './pages/Dashboard'
import Caisse from './pages/Caisse'
import Produits from './pages/Produits'
import Stock from './pages/Stock'
import Reprise from './pages/Reprise'
import Ventes from './pages/Ventes'
import Credit from './pages/Credit'
import Clients from './pages/Clients'
import Fournisseurs from './pages/Fournisseurs'
import Rapports from './pages/Rapports'
import Parametres from './pages/Parametres'
import Pertes from './pages/Pertes'
import Receptions from './pages/Receptions'

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useRole()
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  const [lic, setLic] = useState<{ checked: boolean; activated: boolean; machineId: string }>({
    checked: false,
    activated: false,
    machineId: ''
  })

  const checkLicense = () =>
    api.license
      .status()
      .then((s) => setLic({ checked: true, activated: s.activated, machineId: s.machineId }))
      .catch(() => setLic({ checked: true, activated: true, machineId: '' }))

  useEffect(() => {
    checkLicense()
  }, [])

  if (!lic.checked) {
    return (
      <div className="grid h-full w-full place-items-center bg-ink-950">
        <Spinner />
      </div>
    )
  }
  if (!lic.activated) {
    return <Activation machineId={lic.machineId} onActivated={checkLicense} />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/caisse" element={<Caisse />} />
        <Route path="/produits" element={<Produits />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/reprise" element={<Reprise />} />
        <Route path="/ventes" element={<Ventes />} />
        <Route path="/credit" element={<Credit />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/fournisseurs" element={<Fournisseurs />} />
        <Route path="/receptions" element={<Receptions />} />
        <Route path="/pertes" element={<Pertes />} />
        <Route path="/rapports" element={<AdminOnly><Rapports /></AdminOnly>} />
        <Route path="/parametres" element={<AdminOnly><Parametres /></AdminOnly>} />
      </Routes>
    </Layout>
  )
}
