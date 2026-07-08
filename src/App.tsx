import { useEffect, useMemo, useState } from 'react'
import AuthPanel from './components/AuthPanel'
import ItemsPanel from './components/ItemsPanel'
import LocationsPanel from './components/LocationsPanel'
import Menu, { type AppPanel } from './components/Menu'
import MovementsPanel from './components/MovementsPanel'
import ProfilePanel from './components/ProfilePanel'
import { MoonIcon, SunIcon } from './components/icons'
import { getPreferredLanguage, translations, type Language } from './i18n'
import { supabase } from './supabaseClient'
import type { Session } from '@supabase/supabase-js'
import './App.css'

type Theme = 'light' | 'dark'

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getRoleFromAccessToken(accessToken: string | null | undefined): string | undefined {
  if (!accessToken) {
    return undefined
  }

  try {
    const payloadBase64 = accessToken.split('.')[1]
    if (!payloadBase64) {
      return undefined
    }

    const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = atob(padded)
    const payload = JSON.parse(decoded) as { app_metadata?: { user_role?: string } }

    return payload.app_metadata?.user_role
  } catch {
    return undefined
  }
}

function App() {
  const [language, setLanguage] = useState<Language>(() => getPreferredLanguage())
  const [theme, setTheme] = useState<Theme>(() => getPreferredTheme())
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isWriter, setIsWriter] = useState(false)
  const [activePanel, setActivePanel] = useState<AppPanel>('movements')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [sessionLastName, setSessionLastName] = useState<string | null>(null)
  const messages = useMemo(() => translations[language], [language])

  useEffect(() => {
    if (!supabase) {
      return
    }

    let active = true

    async function loadWriterAccess(session: Session | null) {
      if (!supabase || !active) return

      if (!session?.user) {
        setIsAuthenticated(false)
        setIsWriter(false)
        setSessionEmail(null)
        setSessionName(null)
        setSessionLastName(null)
        return
      }

      setIsAuthenticated(true)
      setSessionEmail(session.user.email ?? null)
      setSessionName((session.user.user_metadata?.name as string | undefined) ?? null)
      setSessionLastName((session.user.user_metadata?.last_name as string | undefined) ?? null)

      const tokenRole = getRoleFromAccessToken(session.access_token)
      const metadataRole = (session.user.app_metadata?.user_role ?? session.user.user_metadata?.user_role) as
        | string
        | undefined

      setIsWriter((tokenRole ?? metadataRole) === 'writer')
    }

    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) return
      await loadWriterAccess(session)

      if (session?.user) {
        setActivePanel('movements')
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void loadWriterAccess(session)

      if (event === 'SIGNED_IN') {
        setActivePanel('movements')
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = messages.meta.title
    window.localStorage.setItem('language', language)
  }, [language, messages.meta.title])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('theme', theme)
  }, [theme])

  async function handleSignOut() {
    if (!supabase) {
      return
    }

    await supabase.auth.signOut()
  }

  function renderPanel() {
    if (activePanel === 'items') {
      return <ItemsPanel messages={messages} canWrite={isWriter} />
    }

    if (activePanel === 'locations') {
      return <LocationsPanel messages={messages} canWrite={isWriter} />
    }

    if (activePanel === 'profile') {
      return (
        <ProfilePanel
          messages={messages}
          email={sessionEmail}
          name={sessionName}
          lastName={sessionLastName}
        />
      )
    }

    return <MovementsPanel messages={messages} canWrite={isWriter} />
  }

  return (
    <main>
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '16px 16px 0' }}
      >
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? messages.themeSwitcher.toLight : messages.themeSwitcher.toDark}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-h)',
            cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <label
          htmlFor="language"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span>{messages.languageSwitcher.label}</span>
          <select
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="en">{messages.languageSwitcher.options.en}</option>
            <option value="es">{messages.languageSwitcher.options.es}</option>
          </select>
        </label>
      </div>

      {isAuthenticated ? (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16, display: 'grid', gap: 16 }}>
          <Menu
            messages={messages}
            activePanel={activePanel}
            onSelectPanel={setActivePanel}
            onSignOut={handleSignOut}
          />
          {renderPanel()}
        </div>
      ) : (
        <AuthPanel messages={messages} />
      )}
    </main>
  )
}

export default App
