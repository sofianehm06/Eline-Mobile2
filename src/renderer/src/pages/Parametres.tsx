import { useEffect, useRef, useState } from 'react'
import {
  Store,
  ReceiptText,
  Printer,
  DatabaseBackup,
  FileSpreadsheet,
  Save,
  Upload,
  Trash2,
  Download,
  RotateCcw,
  CheckCircle2,
  FileDown,
  FileUp,
  Calendar
} from 'lucide-react'
import type { Settings } from '@shared/types'
import { api, type PrinterInfo } from '../lib/api'
import { useSettings } from '../lib/settings'
import { useToast } from '../lib/toast'
import { Button, Card, PageHeader, Field, Input, Select, Textarea, Spinner } from '../components/ui'
import clsx from 'clsx'

type Section = 'boutique' | 'ticket' | 'imprimante' | 'donnees' | 'sauvegarde'

export default function Parametres() {
  const { settings, save, reload } = useSettings()
  const toast = useToast()
  const [section, setSection] = useState<Section>('boutique')
  const [f, setF] = useState<Settings | null>(settings)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) setF(settings)
  }, [settings])

  if (!f) return <Spinner />

  const set = (k: keyof Settings, v: unknown) => setF((s) => (s ? { ...s, [k]: v } : s))

  const submit = async () => {
    setSaving(true)
    await save(f)
    setSaving(false)
    toast.success('Paramètres enregistrés')
  }

  const nav: [Section, string, any][] = [
    ['boutique', 'Boutique', Store],
    ['ticket', 'Ticket de caisse', ReceiptText],
    ['imprimante', 'Imprimante', Printer],
    ['donnees', 'Import / Export', FileSpreadsheet],
    ['sauvegarde', 'Sauvegarde', DatabaseBackup]
  ]

  return (
    <div>
      <PageHeader
        title="Paramètres"
        subtitle="Configuration du logiciel"
        actions={section !== 'sauvegarde' && section !== 'donnees' && <Button loading={saving} onClick={submit}><Save size={16} /> Enregistrer</Button>}
      />

      <div className="flex gap-5">
        <div className="w-56 shrink-0 space-y-1">
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
                section === key ? 'bg-brand-600 text-white shadow' : 'text-ink-600 hover:bg-ink-100'
              )}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {section === 'boutique' && <BoutiqueSection f={f} set={set} />}
          {section === 'ticket' && <TicketSection f={f} set={set} />}
          {section === 'imprimante' && <ImprimanteSection f={f} set={set} />}
          {section === 'donnees' && <DonneesSection />}
          {section === 'sauvegarde' && <SauvegardeSection onRestored={reload} />}
        </div>
      </div>
    </div>
  )
}

function BoutiqueSection({ f, set }: { f: Settings; set: (k: keyof Settings, v: unknown) => void }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const onLogo = (file?: File) => {
    if (!file) return
    if (file.size > 600_000) return toast.error('Image trop lourde (max 600 Ko)')
    const reader = new FileReader()
    reader.onload = () => set('logo', reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <Card className="p-6">
      <h3 className="mb-4 font-bold text-ink-900">Informations de la boutique</h3>
      <div className="mb-5 flex items-center gap-4">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
          {f.logo ? <img src={f.logo} className="h-full w-full object-cover" /> : <Store size={28} className="text-ink-300" />}
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={15} /> Choisir un logo</Button>
          {f.logo && <Button variant="ghost" onClick={() => set('logo', '')}><Trash2 size={15} /> Retirer</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Nom de la boutique"><Input value={f.store_name} onChange={(e) => set('store_name', e.target.value)} /></Field></div>
        <Field label="Téléphone"><Input value={f.store_phone} onChange={(e) => set('store_phone', e.target.value)} /></Field>
        <Field label="Email"><Input value={f.store_email} onChange={(e) => set('store_email', e.target.value)} /></Field>
        <div className="col-span-2"><Field label="Adresse"><Input value={f.store_address} onChange={(e) => set('store_address', e.target.value)} /></Field></div>
      </div>

      <h3 className="mb-4 mt-6 font-bold text-ink-900">Informations fiscales (sur le ticket)</h3>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Registre de commerce (RC)"><Input value={f.store_rc} onChange={(e) => set('store_rc', e.target.value)} /></Field>
        <Field label="N° d'identif. fiscale (NIF)"><Input value={f.store_nif} onChange={(e) => set('store_nif', e.target.value)} /></Field>
        <Field label="Article d'imposition (AI)"><Input value={f.store_ai} onChange={(e) => set('store_ai', e.target.value)} /></Field>
      </div>

      <h3 className="mb-4 mt-6 font-bold text-ink-900">Devise</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Symbole devise"><Input value={f.currency} onChange={(e) => set('currency', e.target.value)} /></Field>
        <Field label="Décimales">
          <Select value={f.currency_decimals} onChange={(e) => set('currency_decimals', Number(e.target.value))}>
            <option value={0}>0 (1500 DA)</option>
            <option value={2}>2 (1500,00 DA)</option>
          </Select>
        </Field>
      </div>

      <h3 className="mb-1 mt-6 font-bold text-ink-900">Sécurité — Mode vendeur</h3>
      <p className="mb-4 text-sm text-ink-500">
        Si vous définissez un code patron, un <b>employé</b> peut utiliser la caisse sans voir vos <b>prix d'achat,
        bénéfices, rapports</b> ni les paramètres. Vous déverrouillez le mode patron avec ce code (bouton en bas de
        la barre latérale). Laissez vide pour tout afficher.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code patron (PIN)">
          <Input value={f.pin_code} onChange={(e) => set('pin_code', e.target.value)} placeholder="Ex : 1234 (vide = désactivé)" />
        </Field>
      </div>
    </Card>
  )
}

function TicketSection({ f, set }: { f: Settings; set: (k: keyof Settings, v: unknown) => void }) {
  return (
    <Card className="p-6">
      <h3 className="mb-4 font-bold text-ink-900">Personnalisation du ticket</h3>
      <div className="space-y-4">
        <Field label="En-tête (titre en haut du ticket)"><Input value={f.receipt_header} onChange={(e) => set('receipt_header', e.target.value)} /></Field>
        <Field label="Pied de page (message de remerciement)" hint="Affiché en bas du ticket. Retours à la ligne autorisés.">
          <Textarea rows={3} value={f.receipt_footer} onChange={(e) => set('receipt_footer', e.target.value)} />
        </Field>
        <Field label="Largeur du papier">
          <Select value={f.receipt_width} onChange={(e) => set('receipt_width', e.target.value)} className="w-48">
            <option value="80">80 mm (standard)</option>
            <option value="58">58 mm (petit)</option>
          </Select>
        </Field>
      </div>
      <p className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
        💡 Le logo, le nom, l'adresse et les informations fiscales définis dans « Boutique » apparaissent automatiquement sur chaque ticket.
      </p>
    </Card>
  )
}

function ImprimanteSection({ f, set }: { f: Settings; set: (k: keyof Settings, v: unknown) => void }) {
  const toast = useToast()
  const [printers, setPrinters] = useState<PrinterInfo[] | null>(null)
  const [testing, setTesting] = useState(false)

  const load = async () => setPrinters(await api.print.listPrinters())
  useEffect(() => { load() }, [])

  const test = async () => {
    setTesting(true)
    const demo = {
      id: 0, ref: 'TEST-0001', datetime: new Date().toISOString(), customer_id: null,
      subtotal: 1500, discount: 0, tax: 239.5, total: 1500, paid: 2000, change_due: 500,
      payment_method: 'cash' as const, status: 'completed' as const, note: null,
      items: [{ id: 1, sale_id: 0, product_id: 1, imei_unit_id: null, imei: null, name: 'Article de test', qty: 1, unit_price: 1500, cost_price: 1000, discount: 0, tax_rate: 19, line_total: 1500 }]
    }
    const r = await api.print.receipt(demo as any)
    setTesting(false)
    if (r.ok) toast.success('Ticket de test envoyé à l\'imprimante')
    else toast.error(r.error || 'Échec : vérifiez l\'imprimante sélectionnée')
  }

  return (
    <Card className="p-6">
      <h3 className="mb-4 font-bold text-ink-900">Imprimante de tickets</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Imprimante TICKETS de caisse" hint="Pour les reçus de vente et de crédit.">
          <Select value={f.printer_name} onChange={(e) => set('printer_name', e.target.value)}>
            <option value="">Imprimante système par défaut</option>
            {printers?.map((p) => (
              <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? ' (défaut)' : ''}</option>
            ))}
          </Select>
        </Field>
        <Field label="Imprimante ÉTIQUETTES (codes-barres)" hint="Pour les étiquettes de prix / codes-barres. Laissez vide pour utiliser l'imprimante tickets.">
          <Select value={f.label_printer_name} onChange={(e) => set('label_printer_name', e.target.value)}>
            <option value="">— Même que tickets —</option>
            {printers?.map((p) => (
              <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? ' (défaut)' : ''}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Mode d'impression" hint="« Boîte de dialogue » est utile si l'impression automatique ne marche pas (vous choisissez l'imprimante à chaque fois).">
          <Select value={f.print_dialog} onChange={(e) => set('print_dialog', Number(e.target.value))} className="w-72">
            <option value={0}>Automatique (silencieux) — recommandé</option>
            <option value={1}>Afficher la boîte de dialogue d'impression</option>
          </Select>
        </Field>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" onClick={load}><RotateCcw size={15} /> Actualiser la liste</Button>
        <Button loading={testing} onClick={test}><Printer size={15} /> Imprimer un ticket de test</Button>
      </div>

      {printers && !printers.some((p) => !/PDF|XPS|OneNote|Fax/i.test(p.name)) && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          ⚠️ Aucune imprimante à tickets détectée — Windows ne voit que des imprimantes virtuelles (PDF/XPS/Fax).
          Branchez l'imprimante thermique et installez son pilote, puis cliquez « Actualiser ».
        </p>
      )}

      <p className="mt-4 text-sm text-ink-500">
        Astuce : pensez à « Enregistrer » après avoir choisi l'imprimante. Le ticket s'imprime automatiquement à chaque vente.
      </p>
    </Card>
  )
}

function DonneesSection() {
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const run = async (key: string, fn: () => Promise<any>, okMsg: (r: any) => string) => {
    setBusy(key)
    const r = await fn()
    setBusy('')
    if (r.ok) toast.success(okMsg(r))
    else if (r.error && r.error !== 'Annulé') toast.error(r.error)
    if (r.errors?.length) toast.info(`${r.errors.length} ligne(s) ignorée(s).`)
  }

  const f = from || undefined
  const t = to || undefined

  const masterExports: { key: string; label: string; fn: () => Promise<any> }[] = [
    { key: 'ex-produits', label: 'Produits', fn: () => api.excel.exportProducts() },
    { key: 'ex-clients', label: 'Clients', fn: () => api.excel.exportClients() },
    { key: 'ex-fournisseurs', label: 'Fournisseurs', fn: () => api.excel.exportFournisseurs() },
    { key: 'ex-stock', label: 'Stock', fn: () => api.excel.exportStock() }
  ]

  const dateExports: { key: string; label: string; fn: () => Promise<any> }[] = [
    { key: 'ex-ventes', label: 'Ventes', fn: () => api.excel.exportVentes(f, t) },
    { key: 'ex-receptions', label: 'Réceptions', fn: () => api.excel.exportReceptions(f, t) },
    { key: 'ex-credit', label: 'Crédit', fn: () => api.excel.exportCredit() },
    { key: 'ex-pertes', label: 'Pertes', fn: () => api.excel.exportPertes(f, t) },
    { key: 'ex-reprises', label: 'Reprises', fn: () => api.excel.exportReprise(f, t) }
  ]

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h3 className="mb-1 font-bold text-ink-900">Exporter vers Excel</h3>
        <p className="mb-4 text-sm text-ink-500">
          Exportez toutes vos données d'un coup ou choisissez une catégorie.
          Le bouton d'export est aussi disponible directement sur chaque page.
        </p>
        <Button variant="success" loading={busy === 'export'} onClick={() => run('export', () => api.excel.exportAll(), () => 'Export Excel enregistré')}>
          <FileDown size={16} /> Exporter tout (.xlsx)
        </Button>

        <h4 className="mb-2 mt-5 text-sm font-bold text-ink-700">Données de base</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {masterExports.map((e) => (
            <button
              key={e.key}
              disabled={busy === e.key}
              onClick={() => run(e.key, e.fn, () => `Export ${e.label} enregistré`)}
              className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
            >
              <FileSpreadsheet size={15} className="shrink-0 text-emerald-500" />
              {busy === e.key ? '…' : e.label}
            </button>
          ))}
        </div>

        <h4 className="mb-2 mt-5 text-sm font-bold text-ink-700">Par période</h4>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-ink-400" />
            <span className="text-sm text-ink-500">Du</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-500">au</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo('') }} className="text-xs text-brand-600 hover:underline">Effacer</button>
          )}
        </div>
        {!from && !to && <p className="mb-3 text-xs text-ink-400">Laissez vide pour exporter tout l'historique.</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {dateExports.map((e) => (
            <button
              key={e.key}
              disabled={busy === e.key}
              onClick={() => run(e.key, e.fn, () => `Export ${e.label} enregistré`)}
              className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
            >
              <FileSpreadsheet size={15} className="shrink-0 text-emerald-500" />
              {busy === e.key ? '…' : e.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-1 font-bold text-ink-900">Importer depuis Excel</h3>
        <p className="mb-4 text-sm text-ink-500">
          Vous changez d'ancien logiciel ? Importez vos données. Formats acceptés : <b>.xlsx</b>, <b>.xls</b> (ancien
          Excel), <b>.csv</b>. Les colonnes sont reconnues automatiquement (Nom, Téléphone/Contact, Prix…). Au besoin,
          téléchargez le <b>modèle</b> pour voir la structure attendue.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ImportCard
            title="Produits"
            busy={busy}
            onTemplate={() => run('tpl-p', () => api.excel.template('produits'), () => 'Modèle produits enregistré')}
            onImport={() => run('imp-p', () => api.excel.importProducts(), (r) => `${r.created} créés, ${r.updated} mis à jour`)}
          />
          <ImportCard
            title="Clients"
            busy={busy}
            tplKey="tpl-c"
            impKey="imp-c"
            onTemplate={() => run('tpl-c', () => api.excel.template('clients'), () => 'Modèle clients enregistré')}
            onImport={() => run('imp-c', () => api.excel.importCustomers(), (r) => `${r.created} créés, ${r.updated} mis à jour`)}
          />
          <ImportCard
            title="Fournisseurs"
            busy={busy}
            tplKey="tpl-f"
            impKey="imp-f"
            onTemplate={() => run('tpl-f', () => api.excel.template('fournisseurs'), () => 'Modèle fournisseurs enregistré')}
            onImport={() => run('imp-f', () => api.excel.importFournisseurs(), (r) => `${r.created} créés, ${r.updated} mis à jour`)}
          />
        </div>
      </Card>
    </div>
  )
}

function ImportCard({
  title,
  busy,
  onTemplate,
  onImport,
  tplKey = 'tpl-p',
  impKey = 'imp-p'
}: {
  title: string
  busy: string
  onTemplate: () => void
  onImport: () => void
  tplKey?: string
  impKey?: string
}) {
  return (
    <div className="rounded-xl border border-ink-100 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><FileSpreadsheet size={18} /></div>
        <h4 className="font-bold text-ink-900">{title}</h4>
      </div>
      <button onClick={onTemplate} className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-200 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
        <Download size={14} /> {busy === tplKey ? '…' : 'Modèle'}
      </button>
      <Button className="w-full" loading={busy === impKey} onClick={onImport}>
        <FileUp size={15} /> Importer
      </Button>
    </div>
  )
}

function SauvegardeSection({ onRestored }: { onRestored: () => void }) {
  const toast = useToast()
  const { settings, save } = useSettings()
  const [busy, setBusy] = useState(false)

  const toggleAuto = async () => {
    await save({ auto_backup: settings?.auto_backup ? 0 : 1 })
  }
  const chooseDir = async () => {
    const r = await api.backup.chooseDir()
    if (r.ok && r.path) {
      await save({ auto_backup_dir: r.path, auto_backup: 1 })
      toast.success('Dossier de sauvegarde automatique défini')
    }
  }

  const backup = async () => {
    setBusy(true)
    const r = await api.backup.create()
    setBusy(false)
    if (r.ok) toast.success('Sauvegarde enregistrée')
    else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }
  const resetAll = async () => {
    setBusy(true)
    const r = await api.data.reset()
    setBusy(false)
    if (r.ok) {
      toast.success('Toutes les données ont été effacées')
      setTimeout(() => window.location.reload(), 700)
    } else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }
  const loadSamples = async () => {
    setBusy(true)
    const r = await api.data.loadSamples()
    setBusy(false)
    if (r.ok) {
      toast.success('Données d\'exemple chargées !')
      setTimeout(() => window.location.reload(), 700)
    } else toast.error(r.error || 'Erreur')
  }
  const restore = async () => {
    setBusy(true)
    const r = await api.backup.restore()
    setBusy(false)
    if (r.ok) { toast.success('Données restaurées'); onRestored() }
    else if (r.error !== 'Annulé') toast.error(r.error || 'Erreur')
  }

  return (
    <Card className="p-6">
      <h3 className="mb-1 font-bold text-ink-900">Sauvegarde & restauration</h3>
      <p className="mb-5 text-sm text-ink-500">Sauvegardez régulièrement vos données sur une clé USB ou un disque externe.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-ink-100 p-5">
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Download size={22} /></div>
          <h4 className="font-bold text-ink-900">Créer une sauvegarde</h4>
          <p className="mb-4 mt-1 text-sm text-ink-500">Exporte toutes vos données (produits, ventes, IMEI, clients) dans un fichier.</p>
          <Button variant="success" loading={busy} onClick={backup}><Download size={16} /> Sauvegarder maintenant</Button>
        </div>

        <div className="rounded-xl border border-ink-100 p-5">
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-600"><RotateCcw size={22} /></div>
          <h4 className="font-bold text-ink-900">Restaurer</h4>
          <p className="mb-4 mt-1 text-sm text-ink-500">Remplace les données actuelles par celles d'un fichier de sauvegarde.</p>
          <Button variant="outline" loading={busy} onClick={restore}><Upload size={16} /> Restaurer un fichier</Button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-ink-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><DatabaseBackup size={22} /></div>
            <div>
              <h4 className="font-bold text-ink-900">Sauvegarde automatique</h4>
              <p className="text-sm text-ink-500">Copie automatique à chaque fermeture, sur une clé USB ou un dossier (15 dernières conservées).</p>
            </div>
          </div>
          <button
            onClick={toggleAuto}
            className={
              'relative h-7 w-12 shrink-0 rounded-full transition ' + (settings?.auto_backup ? 'bg-emerald-500' : 'bg-ink-200')
            }
          >
            <span className={'absolute top-1 h-5 w-5 rounded-full bg-white transition-all ' + (settings?.auto_backup ? 'left-6' : 'left-1')} />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Input readOnly value={settings?.auto_backup_dir || ''} placeholder="Aucun dossier choisi" className="flex-1" />
          <Button variant="outline" onClick={chooseDir}><Upload size={15} /> Choisir le dossier</Button>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
        <span>Vos données sont enregistrées automatiquement sur cet ordinateur après chaque opération. La sauvegarde (manuelle ou automatique) sert à conserver une copie de sécurité externe.</span>
      </div>

      <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/40 p-5">
        <h4 className="font-bold text-brand-700">Données d'exemple (démonstration)</h4>
        <p className="mb-3 mt-1 text-sm text-ink-600">
          Charge des <b>produits, fournisseurs et clients d'exemple</b> bien organisés — pratique pour présenter
          le logiciel à un client. Disponible uniquement sur une base vierge (videz d'abord si besoin).
        </p>
        <Button loading={busy} onClick={loadSamples}>
          <DatabaseBackup size={16} /> Charger des exemples
        </Button>
      </div>

      <div className="mt-6 rounded-xl border-2 border-red-100 bg-red-50/40 p-5">
        <h4 className="font-bold text-red-700">Zone de danger — Réinitialiser</h4>
        <p className="mb-3 mt-1 text-sm text-ink-600">
          Efface <b>toutes les données</b> (produits, ventes, clients, IMEI, crédit) pour repartir d'une base vierge.
          Les paramètres et la licence sont conservés. <b>Irréversible</b> — faites une sauvegarde avant.
        </p>
        <Button variant="danger" loading={busy} onClick={resetAll}>
          <Trash2 size={16} /> Tout effacer (réinitialiser)
        </Button>
      </div>
    </Card>
  )
}
