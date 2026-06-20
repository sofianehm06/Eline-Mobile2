import { PHONE_BRANDS } from '@shared/types'

const DATALIST_ID = 'phone-brands-list'

export function BrandSelect({
  value,
  onChange,
  className
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <>
      <input
        list={DATALIST_ID}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Samsung, Xiaomi…"
        className={
          'h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-200 ' +
          (className || '')
        }
      />
      <datalist id={DATALIST_ID}>
        {PHONE_BRANDS.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </>
  )
}
