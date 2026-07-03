import en from './locales/en'
import es from './locales/es'

export const translations = {
  en,
  es,
} as const

export type Language = keyof typeof translations
export type Messages = (typeof translations)[Language]

export const defaultLanguage: Language = 'en'

export function getPreferredLanguage(): Language {
  if (typeof window === 'undefined') {
    return defaultLanguage
  }

  const storedLanguage = window.localStorage.getItem('language')
  if (storedLanguage === 'en' || storedLanguage === 'es') {
    return storedLanguage
  }

  return window.navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}
