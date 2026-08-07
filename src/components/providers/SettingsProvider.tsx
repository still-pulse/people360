'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface Settings {
  logoUrl?: string
  companyName?: string
  systemSubtitle?: string
}

interface SettingsContextValue {
  settings: Settings
  reload: () => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: {},
  reload: () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({})

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) setSettings(await res.json())
    } catch {}
  }, [])

  useEffect(() => { reload() }, [reload])

  return (
    <SettingsContext.Provider value={{ settings, reload }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
