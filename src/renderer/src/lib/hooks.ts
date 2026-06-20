import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Détecte les saisies d'un lecteur code-barres (clavier-wedge).
 * Le lecteur "tape" très vite puis envoie Entrée. On distingue de la frappe
 * manuelle par la vitesse entre les touches.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  enabled = true,
  opts: { preventInput?: boolean } = {}
): void {
  const buffer = useRef('')
  const lastTime = useRef(0)
  const fastRun = useRef(0)
  const { preventInput = false } = opts

  useEffect(() => {
    if (!enabled) return
    const FAST_MS = 45 // intervalle max entre 2 touches d'un scan
    const onKey = (e: KeyboardEvent) => {
      const now = Date.now()
      const gap = now - lastTime.current
      lastTime.current = now

      if (e.key === 'Enter') {
        const code = buffer.current
        buffer.current = ''
        fastRun.current = 0
        if (code.length >= 3) {
          // Considéré comme scan si la saisie a été rapide
          onScan(code)
          // Empêche le Enter de valider un formulaire si c'était un scan
          const target = e.target as HTMLElement
          if (!(target?.tagName === 'TEXTAREA')) e.preventDefault()
        }
        return
      }

      if (e.key.length === 1) {
        if (gap > 120) buffer.current = '' // nouvelle séquence
        fastRun.current = gap <= FAST_MS ? fastRun.current + 1 : 0
        // n'accumule que les frappes rapprochées (scan)
        if (gap <= FAST_MS || buffer.current === '') {
          buffer.current += e.key
          // En mode formulaire : bloque les caractères seulement après une
          // vraie rafale (3+ touches très rapides = scanner), jamais une
          // frappe manuelle même rapide.
          if (preventInput && fastRun.current >= 2) e.preventDefault()
        } else {
          buffer.current = e.key
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onScan, enabled, preventInput])
}

/** Chargement de données simple avec rechargement. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const run = useCallback(() => {
    setLoading(true)
    fn()
      .then((d) => {
        if (mounted.current) { setData(d); setError(null) }
      })
      .catch((e) => {
        if (mounted.current) setError(e?.message || String(e))
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(run, [run])

  return { data, loading, error, reload: run }
}

/** Valeur retardée (debounce) pour la recherche. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}
