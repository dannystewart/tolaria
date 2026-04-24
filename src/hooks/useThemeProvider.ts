import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (t: ThemePreference) => void
}

const FALLBACK: ThemeContextValue = {
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
}

export const ThemeContext = createContext<ThemeContextValue>(FALLBACK)

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

function parsePreference(value: string | null | undefined): ThemePreference {
  if (value === 'dark' || value === 'light' || value === 'system') return value
  return 'light'
}

export function useThemeManager(
  settingsTheme: string | null | undefined,
  settingsLoaded: boolean,
  onPersist: (theme: ThemePreference) => void,
): ThemeContextValue {
  const onPersistRef = useRef(onPersist)
  useEffect(() => {
    onPersistRef.current = onPersist
  }, [onPersist])

  const theme = useMemo<ThemePreference>(() => {
    if (settingsLoaded && settingsTheme != null) {
      return parsePreference(settingsTheme)
    }
    return parsePreference(localStorage.getItem('tolaria-theme'))
  }, [settingsLoaded, settingsTheme])

  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // Keep localStorage in sync for pre-render script on next load
  useEffect(() => {
    localStorage.setItem('tolaria-theme', theme)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((t: ThemePreference) => {
    localStorage.setItem('tolaria-theme', t)
    onPersistRef.current(t)
  }, [])

  return { theme, resolvedTheme, setTheme }
}
