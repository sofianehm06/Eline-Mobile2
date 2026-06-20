import { useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { Barcode as BarcodeIcon, Printer } from 'lucide-react'
import type { Product } from '@shared/types'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { useSettings } from '../lib/settings'
import { useToast } from '../lib/toast'
import { Button, Modal, Field, Input } from './ui'

function barcodeDataUrl(value: string): string {
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: 2,
      height: 45,
      displayValue: true,
      fontSize: 13,
      margin: 4
    })
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

export function BarcodeLabelButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        title="Étiquette code-barres"
      >
        <BarcodeIcon size={16} />
      </button>
      {open && <BarcodeLabelModal product={product} onClose={() => setOpen(false)} />}
    </>
  )
}

function BarcodeLabelModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { settings } = useSettings()
  const toast = useToast()
  const [qty, setQty] = useState(1)
  const [printing, setPrinting] = useState(false)
  const value = product.barcode || product.sku
  const img = useMemo(() => barcodeDataUrl(value), [value])

  const buildHtml = () => {
    const widthMm = settings?.receipt_width === '58' ? 54 : 76
    const one = `
      <div class="label">
        <div class="store">${settings?.store_name || ''}</div>
        <div class="name">${product.name}</div>
        <div class="price">${money(product.sale_price)}</div>
        <img src="${img}" />
      </div>`
    return `<!doctype html><html><head><meta charset="utf-8"/><style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
      body{width:${widthMm}mm}
      .label{text-align:center;padding:2mm 0;page-break-inside:avoid;border-bottom:1px dotted #bbb}
      .store{font-size:8pt;font-weight:700}
      .name{font-size:8pt;margin:.5mm 0}
      .price{font-size:11pt;font-weight:800;margin-bottom:1mm}
      img{max-width:90%}
    </style></head><body>${one.repeat(Math.max(1, qty))}</body></html>`
  }

  const print = async () => {
    if (!img) return toast.error('Code-barres invalide')
    setPrinting(true)
    const r = await api.print.html(buildHtml(), { label: true })
    setPrinting(false)
    if (r.ok) toast.success('Étiquette(s) envoyée(s) à l\'imprimante')
    else toast.error(r.error || "Échec de l'impression")
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Étiquette code-barres"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button loading={printing} onClick={print}>
            <Printer size={16} /> Imprimer
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-xl border border-ink-100 bg-white p-4 text-center">
          <p className="text-xs font-semibold">{settings?.store_name}</p>
          <p className="text-xs">{product.name}</p>
          <p className="text-base font-extrabold">{money(product.sale_price)}</p>
          {img ? <img src={img} alt="" className="mx-auto" /> : <p className="text-sm text-red-500">Code-barres invalide</p>}
        </div>
        <Field label="Nombre d'étiquettes">
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="w-32" />
        </Field>
      </div>
    </Modal>
  )
}
