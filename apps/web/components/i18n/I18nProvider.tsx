'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import en from '@/locales/en'
import th from '@/locales/th'

export type Locale = 'en' | 'th'
export type TranslationKey = keyof typeof en
type TranslationValues = Record<string, string | number>

const STORAGE_KEY = 'noveldex-locale'

const dictionaries = {
  en,
  th,
} as const

interface I18nContextValue {
  language: Locale
  setLanguage: (language: Locale) => void
  t: (key: TranslationKey, values?: TranslationValues) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function interpolate(template: string, values?: TranslationValues) {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values[token] ?? `{${token}}`))
}

function translate(language: Locale, key: TranslationKey, values?: TranslationValues) {
  return interpolate(dictionaries[language][key], values)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'en'
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'en' || stored === 'th' ? stored : 'en'
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: (key, values) => translate(language, key, values),
    }),
    [language],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

export function T({
  k,
  values,
}: {
  k: TranslationKey
  values?: TranslationValues
}) {
  const { t } = useI18n()
  return <>{t(k, values)}</>
}
