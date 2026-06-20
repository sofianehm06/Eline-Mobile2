import { BrowserWindow } from 'electron'
import QRCode from 'qrcode'
import { settingsRepo } from './db/repo'
import type { Sale } from '@shared/types'

export interface PrinterInfo {
  name: string
  displayName: string
  isDefault: boolean
}

export async function listPrinters(win: BrowserWindow | null): Promise<PrinterInfo[]> {
  if (!win) return []
  const printers = await win.webContents.getPrintersAsync()
  return printers.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault }))
}

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function money(n: number, decimals: number, currency: string): string {
  const v = (n ?? 0).toLocaleString('fr-DZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
  return `${v} ${currency}`
}

export async function buildReceiptHtml(sale: Sale): Promise<string> {
  const s = settingsRepo.getAll()
  const dec = s.currency_decimals
  const cur = s.currency
  const width = s.receipt_width === '58' ? 54 : 76 // mm zone imprimable
  const fmt = (n: number) => money(n, dec, cur)

  let qr = ''
  try {
    qr = await QRCode.toDataURL(sale.ref, { margin: 0, width: 120 })
  } catch {
    qr = ''
  }

  const dt = sale.datetime?.replace('T', ' ').slice(0, 16) || ''
  const logo = s.logo
    ? `<div class="logo"><img src="${s.logo}" /></div>`
    : ''

  const lines = (sale.items || [])
    .map((it) => {
      const imeiLine = it.imei ? `<div class="imei">IMEI: ${escapeHtml(it.imei)}</div>` : ''
      const disc = it.discount ? `<div class="imei">Remise: -${fmt(it.discount)}</div>` : ''
      return `
      <div class="item">
        <div class="iname">${escapeHtml(it.name)}</div>
        <div class="irow">
          <span>${it.qty} x ${fmt(it.unit_price)}</span>
          <span class="ipr">${fmt(it.line_total)}</span>
        </div>
        ${imeiLine}${disc}
      </div>`
    })
    .join('')

  const fiscal = [
    s.store_rc ? `RC: ${escapeHtml(s.store_rc)}` : '',
    s.store_nif ? `NIF: ${escapeHtml(s.store_nif)}` : '',
    s.store_ai ? `AI: ${escapeHtml(s.store_ai)}` : ''
  ]
    .filter(Boolean)
    .join('  ')

  const payLabel: Record<string, string> = {
    cash: 'Espèces',
    card: 'Carte',
    transfer: 'Virement',
    credit: 'Crédit'
  }

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { width:${width}mm; font-family:'Segoe UI',Arial,sans-serif; color:#000; padding:2mm 1mm; }
    .center { text-align:center; }
    .logo img { max-width:40mm; max-height:20mm; margin:0 auto 2mm; display:block; }
    .store { font-size:13pt; font-weight:800; text-align:center; }
    .sub { font-size:8pt; text-align:center; line-height:1.35; margin-top:1mm; }
    .fiscal { font-size:7pt; text-align:center; margin-top:1mm; }
    .hr { border-top:1px dashed #000; margin:2mm 0; }
    .meta { font-size:8pt; display:flex; justify-content:space-between; }
    .item { margin-bottom:1.5mm; }
    .iname { font-size:9pt; font-weight:600; }
    .irow { font-size:8.5pt; display:flex; justify-content:space-between; }
    .ipr { font-weight:700; }
    .imei { font-size:7.5pt; color:#222; }
    .totals { font-size:9pt; margin-top:1mm; }
    .trow { display:flex; justify-content:space-between; padding:.4mm 0; }
    .tot { font-size:13pt; font-weight:800; border-top:1px solid #000; border-bottom:1px solid #000; padding:1mm 0; margin:1mm 0; }
    .foot { font-size:8pt; text-align:center; margin-top:2mm; line-height:1.4; white-space:pre-line; }
    .qr { text-align:center; margin-top:2mm; }
    .qr img { width:22mm; height:22mm; }
    .ref { font-size:8pt; text-align:center; margin-top:1mm; letter-spacing:1px; }
    .refunded { text-align:center; color:#b00; font-weight:800; font-size:11pt; border:2px solid #b00; margin:2mm 0; padding:1mm; }
  </style></head>
  <body>
    ${logo}
    <div class="store">${escapeHtml(s.receipt_header || s.store_name)}</div>
    <div class="sub">${escapeHtml(s.store_address)}${s.store_phone ? '<br/>Tél: ' + escapeHtml(s.store_phone) : ''}</div>
    ${fiscal ? `<div class="fiscal">${fiscal}</div>` : ''}
    <div class="hr"></div>
    <div class="meta"><span>Ticket: ${escapeHtml(sale.ref)}</span><span>${escapeHtml(dt)}</span></div>
    ${sale.customer_name ? `<div class="meta"><span>Client: ${escapeHtml(sale.customer_name)}</span></div>` : ''}
    ${sale.status === 'refunded' ? '<div class="refunded">REMBOURSÉ</div>' : ''}
    <div class="hr"></div>
    ${lines}
    <div class="hr"></div>
    <div class="totals">
      <div class="trow"><span>Sous-total</span><span>${fmt(sale.subtotal)}</span></div>
      ${sale.discount ? `<div class="trow"><span>Remise</span><span>-${fmt(sale.discount)}</span></div>` : ''}
      <div class="trow tot"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
      <div class="trow"><span>Payé (${payLabel[sale.payment_method] || sale.payment_method})</span><span>${fmt(sale.paid)}</span></div>
      ${sale.change_due ? `<div class="trow"><span>Rendu</span><span>${fmt(sale.change_due)}</span></div>` : ''}
    </div>
    ${qr ? `<div class="qr"><img src="${qr}"/></div>` : ''}
    <div class="ref">${escapeHtml(sale.ref)}</div>
    <div class="foot">${escapeHtml(s.receipt_footer)}</div>
  </body></html>`
}

async function printDocument(
  html: string,
  win: BrowserWindow | null,
  opts: { deviceName?: string; widthMm?: number; silent?: boolean; label?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  const s = settingsRepo.getAll()
  // Étiquettes -> imprimante étiquettes ; tickets -> imprimante tickets.
  const deviceName = opts.deviceName ?? (opts.label ? s.label_printer_name || s.printer_name : s.printer_name)
  const widthMm = opts.widthMm ?? (s.receipt_width === '58' ? 58 : 80)

  const worker = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false }
  })

  try {
    await worker.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    // Laisse le temps aux images (logo/QR) de se rendre
    await new Promise((r) => setTimeout(r, 350))
    const heightPx: number = await worker.webContents.executeJavaScript(
      'Math.ceil(document.body.scrollHeight)'
    )
    const heightMicrons = Math.max(Math.round((heightPx / 96) * 25400) + 4000, 20000)
    const widthMicrons = Math.round(widthMm * 1000)

    const doPrint = (silent: boolean) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        worker.webContents.print(
          {
            silent,
            printBackground: true,
            deviceName: deviceName || undefined,
            margins: { marginType: 'none' },
            pageSize: { width: widthMicrons, height: heightMicrons }
          },
          (success, failureReason) => resolve({ ok: success, error: success ? undefined : failureReason })
        )
      })

    // Mode boîte de dialogue forcé (réglage) ou demandé explicitement.
    const forceDialog = s.print_dialog === 1 || opts.silent === false
    let result = await doPrint(!forceDialog)
    // Repli : si l'impression automatique (silencieuse) échoue, on ouvre la
    // boîte de dialogue pour que l'utilisateur choisisse une imprimante.
    if (!result.ok && !forceDialog) {
      result = await doPrint(false)
    }
    return result
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  } finally {
    if (!worker.isDestroyed()) worker.close()
  }
}

export async function printReceipt(sale: Sale, win: BrowserWindow | null) {
  const html = await buildReceiptHtml(sale)
  return printDocument(html, win, {})
}

export async function printHtml(
  html: string,
  win: BrowserWindow | null,
  options: { deviceName?: string; widthMm?: number; silent?: boolean; label?: boolean } = {}
) {
  return printDocument(html, win, options)
}

export interface WarrantyData {
  product_name: string
  imei: string
  customer_name?: string | null
  start_date: string // déjà formaté (jj/mm/aaaa)
  end_date: string
  warranty_months: number
  active: boolean
}

export interface CreditReceiptData {
  customer_name: string
  amount: number
  method: string
  new_balance: number
}

export async function printCreditReceipt(d: CreditReceiptData, win: BrowserWindow | null) {
  const s = settingsRepo.getAll()
  const width = s.receipt_width === '58' ? 54 : 76
  const fmt = (n: number) => money(n, s.currency_decimals, s.currency)
  const dt = new Date().toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const payLabel: Record<string, string> = { cash: 'Espèces', card: 'Carte', transfer: 'Virement', credit: 'Crédit' }
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${width}mm;font-family:'Segoe UI',Arial,sans-serif;color:#000;padding:3mm 2mm}
    .center{text-align:center}
    .store{font-size:13pt;font-weight:800;text-align:center}
    .sub{font-size:8pt;text-align:center;line-height:1.35;margin-top:1mm}
    .title{text-align:center;font-size:12pt;font-weight:800;margin:3mm 0 1mm;letter-spacing:1px}
    .hr{border-top:1px dashed #000;margin:2mm 0}
    .row{font-size:9.5pt;display:flex;justify-content:space-between;padding:.6mm 0}
    .amount{font-size:15pt;font-weight:800;text-align:center;border:1px solid #000;padding:1.5mm;margin:2mm 0}
    .bal{font-size:11pt;font-weight:800;display:flex;justify-content:space-between;border-top:1px solid #000;padding-top:1mm;margin-top:1mm}
    .foot{font-size:8pt;text-align:center;margin-top:3mm;line-height:1.4;white-space:pre-line}
    .sign{margin-top:8mm;font-size:8pt;text-align:right}
  </style></head><body>
    ${s.logo ? `<div class="center"><img src="${s.logo}" style="max-width:34mm;max-height:16mm"/></div>` : ''}
    <div class="store">${escapeHtml(s.store_name)}</div>
    <div class="sub">${escapeHtml(s.store_address)}${s.store_phone ? '<br/>Tél: ' + escapeHtml(s.store_phone) : ''}</div>
    <div class="title">REÇU DE VERSEMENT</div>
    <div class="hr"></div>
    <div class="row"><span>Date</span><b>${escapeHtml(dt)}</b></div>
    <div class="row"><span>Client</span><b>${escapeHtml(d.customer_name)}</b></div>
    <div class="row"><span>Mode</span><b>${payLabel[d.method] || d.method}</b></div>
    <div class="amount">Versé : ${fmt(d.amount)}</div>
    <div class="bal"><span>Reste à payer</span><span>${fmt(d.new_balance)}</span></div>
    <div class="sign">Signature : __________</div>
    <div class="foot">${escapeHtml(s.receipt_footer)}</div>
  </body></html>`
  return printDocument(html, win, {})
}

export async function printWarranty(w: WarrantyData, win: BrowserWindow | null) {
  const s = settingsRepo.getAll()
  const width = s.receipt_width === '58' ? 54 : 76
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { width:${width}mm; font-family:'Segoe UI',Arial,sans-serif; color:#000; padding:3mm 2mm; }
    .center { text-align:center; }
    .store { font-size:13pt; font-weight:800; text-align:center; }
    .sub { font-size:8pt; text-align:center; line-height:1.35; margin-top:1mm; }
    .title { text-align:center; font-size:12pt; font-weight:800; margin:3mm 0 1mm; letter-spacing:1px; }
    .hr { border-top:1px dashed #000; margin:2mm 0; }
    .row { font-size:9pt; display:flex; justify-content:space-between; padding:.6mm 0; }
    .row b { font-weight:700; }
    .imei { font-family:monospace; font-weight:700; }
    .status { text-align:center; font-weight:800; font-size:11pt; margin:2mm 0; padding:1mm; border:2px solid #000; }
    .foot { font-size:7.5pt; text-align:center; margin-top:2mm; line-height:1.4; white-space:pre-line; }
  </style></head><body>
    ${s.logo ? `<div class="center"><img src="${s.logo}" style="max-width:34mm;max-height:16mm"/></div>` : ''}
    <div class="store">${escapeHtml(s.store_name)}</div>
    <div class="sub">${escapeHtml(s.store_address)}${s.store_phone ? '<br/>Tél: ' + escapeHtml(s.store_phone) : ''}</div>
    <div class="title">BON DE GARANTIE</div>
    <div class="hr"></div>
    <div class="row"><span>Produit</span><b>${escapeHtml(w.product_name)}</b></div>
    <div class="row"><span>IMEI</span><span class="imei">${escapeHtml(w.imei)}</span></div>
    ${w.customer_name ? `<div class="row"><span>Client</span><b>${escapeHtml(w.customer_name)}</b></div>` : ''}
    <div class="row"><span>Date d'achat</span><b>${escapeHtml(w.start_date)}</b></div>
    <div class="row"><span>Durée</span><b>${w.warranty_months} mois</b></div>
    <div class="row"><span>Fin de garantie</span><b>${escapeHtml(w.end_date)}</b></div>
    <div class="status">${w.active ? 'SOUS GARANTIE' : 'GARANTIE EXPIRÉE'}</div>
    <div class="foot">${escapeHtml(s.receipt_footer)}\nConserver ce bon. Garantie hors casse, oxydation et mauvaise utilisation.</div>
  </body></html>`
  return printDocument(html, win, {})
}
