import { useState } from 'react'
import { KeyRound, Copy, ShieldCheck, Upload, Smartphone } from 'lucide-react'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { Button } from '../components/ui'

export default function Activation({ machineId, onActivated }: { machineId: string; onActivated: () => void }) {
  const toast = useToast()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(machineId)
      toast.success('ID copié')
    } catch {
      toast.error('Copie impossible')
    }
  }

  const activate = async () => {
    if (!key.trim()) return toast.error('Collez votre clé d’activation')
    setBusy(true)
    const r = await api.license.activate(key.trim())
    setBusy(false)
    if (r.ok) {
      toast.success('Logiciel activé ! Merci.')
      onActivated()
    } else toast.error(r.error || 'Clé invalide')
  }

  const fromFile = async () => {
    setBusy(true)
    const r = await api.license.activateFile()
    setBusy(false)
    if (r.ok) {
      toast.success('Logiciel activé ! Merci.')
      onActivated()
    } else if (r.error && r.error !== 'Annulé') toast.error(r.error)
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-ink-950 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-pop">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white">
            <Smartphone size={28} />
          </div>
          <h1 className="text-xl font-bold text-ink-900">Activation du logiciel</h1>
          <p className="mt-1 text-sm text-ink-500">
            Ce logiciel doit être activé pour ce PC. Communiquez l’<b>ID de cet ordinateur</b> à votre
            fournisseur pour recevoir votre clé d’activation.
          </p>
        </div>

        <div className="mb-5">
          <label className="label">ID de cet ordinateur</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-ink-900">
              {machineId}
            </div>
            <Button variant="outline" onClick={copyId}>
              <Copy size={16} /> Copier
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Clé d’activation</label>
          <textarea
            className="input font-mono text-sm"
            rows={3}
            placeholder="Collez ici la clé reçue de votre fournisseur"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={fromFile} loading={busy}>
            <Upload size={16} /> Charger un fichier
          </Button>
          <Button className="flex-1" onClick={activate} loading={busy}>
            <ShieldCheck size={16} /> Activer
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-400">
          <KeyRound size={13} /> La clé est unique à cet ordinateur et ne fonctionne sur aucun autre PC.
        </div>
      </div>
    </div>
  )
}
