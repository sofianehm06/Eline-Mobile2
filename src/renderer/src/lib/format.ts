import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

// Configuration mise à jour par le SettingsProvider
export const fmtConfig = { currency: 'DA', decimals: 2 }

export function setFormatConfig(currency: string, decimals: number): void {
  fmtConfig.currency = currency
  fmtConfig.decimals = decimals
}

export function money(n: number | null | undefined): string {
  const v = (n ?? 0).toLocaleString('fr-DZ', {
    minimumFractionDigits: fmtConfig.decimals,
    maximumFractionDigits: fmtConfig.decimals
  })
  return `${v} ${fmtConfig.currency}`
}

export function num(n: number | null | undefined, decimals = 0): string {
  return (n ?? 0).toLocaleString('fr-DZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value
  // SQLite renvoie "YYYY-MM-DD HH:MM:SS"
  return parseISO(value.replace(' ', 'T'))
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—'
  try {
    return format(toDate(value), 'dd/MM/yyyy', { locale: fr })
  } catch {
    return String(value)
  }
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—'
  try {
    return format(toDate(value), 'dd/MM/yyyy HH:mm', { locale: fr })
  } catch {
    return String(value)
  }
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return '—'
  try {
    return format(toDate(value), 'HH:mm', { locale: fr })
  } catch {
    return String(value)
  }
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function firstOfMonthISO(): string {
  const d = new Date()
  return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
}
