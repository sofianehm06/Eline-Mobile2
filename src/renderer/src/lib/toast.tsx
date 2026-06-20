import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastCtx {
  push: (kind: ToastKind, message: string) => void
  success: (m: string) => void
  error: (m: string) => void
  info: (m: string) => void
}

const Ctx = createContext<ToastCtx>({
  push: () => {},
  success: () => {},
  error: () => {},
  info: () => {}
})

let counter = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = counter++
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const ctx: ToastCtx = {
    push,
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m)
  }

  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-500" />,
    error: <AlertCircle size={18} className="text-red-500" />,
    info: <Info size={18} className="text-brand-500" />
  }

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex min-w-[280px] max-w-md items-start gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-pop animate-slide-up"
          >
            <div className="mt-0.5">{icons[t.kind]}</div>
            <div className="flex-1 text-sm font-medium text-ink-800">{t.message}</div>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-ink-400 hover:text-ink-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  return useContext(Ctx)
}
