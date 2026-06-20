import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Settings } from '@shared/types'
import { api } from './api'
import { setFormatConfig } from './format'

interface SettingsCtx {
  settings: Settings | null
  reload: () => Promise<void>
  save: (patch: Partial<Settings>) => Promise<void>
}

const Ctx = createContext<SettingsCtx>({
  settings: null,
  reload: async () => {},
  save: async () => {}
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)

  const reload = async () => {
    const s = await api.settings.get()
    setFormatConfig(s.currency, s.currency_decimals)
    setSettings(s)
  }

  const save = async (patch: Partial<Settings>) => {
    await api.settings.update(patch)
    await reload()
  }

  useEffect(() => {
    reload()
  }, [])

  return <Ctx.Provider value={{ settings, reload, save }}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsCtx {
  return useContext(Ctx)
}
