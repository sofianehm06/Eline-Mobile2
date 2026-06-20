import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSettings } from './settings'

interface RoleCtx {
  isAdmin: boolean // patron (voit tout)
  pinEnabled: boolean // un code PIN est défini
  unlock: (pin: string) => boolean
  lock: () => void
}

const Ctx = createContext<RoleCtx>({
  isAdmin: true,
  pinEnabled: false,
  unlock: () => false,
  lock: () => {}
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const [isAdmin, setIsAdmin] = useState(false)
  const initRef = useRef(false)

  const pinEnabled = !!(settings?.pin_code && settings.pin_code.length > 0)

  // Rôle initial une seule fois (au chargement) : verrouillé si un PIN existe.
  useEffect(() => {
    if (settings && !initRef.current) {
      initRef.current = true
      setIsAdmin(!(settings.pin_code && settings.pin_code.length > 0))
    }
  }, [settings])

  const unlock = (pin: string): boolean => {
    if (settings?.pin_code && pin === settings.pin_code) {
      setIsAdmin(true)
      return true
    }
    return false
  }
  const lock = () => setIsAdmin(false)

  return <Ctx.Provider value={{ isAdmin, pinEnabled, unlock, lock }}>{children}</Ctx.Provider>
}

export function useRole(): RoleCtx {
  return useContext(Ctx)
}
