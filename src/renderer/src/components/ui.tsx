import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useEffect } from 'react'
import clsx from 'clsx'
import { Loader2, X } from 'lucide-react'

// ---------- Button ----------
type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'success'
export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const cls = {
    primary: 'btn-primary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    success: 'btn-success'
  }[variant]
  return (
    <button className={clsx(cls, className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

// ---------- Inputs ----------
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => <input ref={ref} className={clsx('input', className)} {...rest} />
)
Input.displayName = 'Input'

// Champ numérique qui interdit les valeurs négatives (min = 0 par défaut).
type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: number | string
  onValue: (n: number) => void
  min?: number
}
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onValue, min = 0, placeholder, ...rest }, ref) => (
    <input
      ref={ref}
      type="number"
      min={min}
      inputMode="decimal"
      className={clsx('input', className)}
      // Affiche vide quand la valeur vaut 0 → pas de « 0 » à gauche qui gêne la saisie.
      value={value === 0 || value === '' || value == null ? '' : value}
      placeholder={placeholder ?? '0'}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') return onValue(min)
        const n = Number(raw)
        if (Number.isNaN(n)) return
        onValue(n < min ? min : n)
      }}
      {...rest}
    />
  )
)
NumberInput.displayName = 'NumberInput'
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('input', className)} {...rest} />
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('input cursor-pointer', className)} {...rest}>
      {children}
    </select>
  )
}

export function Field({ label, children, hint }: { label?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

// ---------- Card ----------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('card', className)}>{children}</div>
}

// ---------- Badge ----------
export function Badge({ color = 'gray', children }: { color?: string; children: ReactNode }) {
  const map: Record<string, string> = {
    gray: 'bg-ink-100 text-ink-600',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-brand-100 text-brand-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700'
  }
  return <span className={clsx('chip', map[color] || map.gray)}>{children}</span>
}

// ---------- Spinner / states ----------
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-400">
      <Loader2 className="animate-spin" size={28} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon && <div className="mb-1 text-ink-300">{icon}</div>}
      <p className="text-base font-semibold text-ink-600">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink-400">{hint}</p>}
    </div>
  )
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md'
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className={clsx('my-8 w-full rounded-2xl bg-white shadow-pop animate-scale-in', w)} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
            <h3 className="text-lg font-bold text-ink-900">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- Page header ----------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------- Stat card ----------
export function StatCard({
  label,
  value,
  icon,
  accent = 'brand',
  sub
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  accent?: 'brand' | 'green' | 'amber' | 'purple' | 'red'
  sub?: ReactNode
}) {
  const accents: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600'
  }
  return (
    <Card className="flex items-center gap-4 p-4">
      {icon && <div className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-xl', accents[accent])}>{icon}</div>}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
        <p className="truncate text-xl font-bold text-ink-900">{value}</p>
        {sub && <p className="truncate text-xs text-ink-400">{sub}</p>}
      </div>
    </Card>
  )
}

// ---------- Confirm ----------
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  danger,
  onConfirm,
  onClose
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-600">{message}</p>
    </Modal>
  )
}
