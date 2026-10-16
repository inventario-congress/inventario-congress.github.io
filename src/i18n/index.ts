import es from './locales/es'

export const translations = {
  es,
} as const

export type Language = keyof typeof translations
export type Messages = (typeof translations)[Language]

export const defaultLanguage: Language = 'es'

export function getPreferredLanguage(): Language {
  if (typeof window === 'undefined') {
    return defaultLanguage
  }

  const storedLanguage = window.localStorage.getItem('language')
  if (storedLanguage === 'es') {
    return storedLanguage
  }

  // Default to Spanish for this project
  return 'es'
}
