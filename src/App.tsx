import { useEffect, useMemo, useRef, useState } from 'react'
import AuthPanel from './components/AuthPanel'
import MicrophonesPanel from './components/MicrophonesPanel'
import LocationsPanel from './components/LocationsPanel'
import Menu, { type AppPanel } from './components/Menu'

import ProfilePanel from './components/ProfilePanel'
import BasePanel from './components/BasePanel'
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<AppPanel>('microphones')

  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [sessionLastName, setSessionLastName] = useState<string | null>(null)
  const menuToggleRef = useRef<HTMLButtonElement | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const didOpenMobileMenuRef = useRef(false)
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
        setIsMobileMenuOpen(false)
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
        setActivePanel('microphones')
        setIsMobileMenuOpen(false)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void loadWriterAccess(session)

      if (event === 'SIGNED_IN') {
        setActivePanel('microphones')
        setIsMobileMenuOpen(false)
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

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    if (!isMobileMenuOpen) {
      if (didOpenMobileMenuRef.current) {
        menuToggleRef.current?.focus()
        didOpenMobileMenuRef.current = false
      }
      return
    }

    didOpenMobileMenuRef.current = true

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

    function getFocusableElements() {
      if (!sidebarRef.current) {
        return [] as HTMLElement[]
      }

      return Array.from(sidebarRef.current.querySelectorAll<HTMLElement>(focusableSelector))
    }

    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    } else {
      sidebarRef.current?.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsMobileMenuOpen(false)
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const activeElement = document.activeElement as HTMLElement | null
      const elements = getFocusableElements()

      if (elements.length === 0) {
        event.preventDefault()
        sidebarRef.current?.focus()
        return
      }

      const firstElement = elements[0]
      const lastElement = elements[elements.length - 1]
      const isInsideSidebar = activeElement ? sidebarRef.current?.contains(activeElement) ?? false : false

      if (!isInsideSidebar) {
        event.preventDefault()
        firstElement.focus()
        return
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
        return
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAuthenticated, isMobileMenuOpen])

  async function handleSignOut() {
    if (!supabase) {
      return
    }

    await supabase.auth.signOut()
  }

  function handleSelectPanel(panel: AppPanel) {
    setActivePanel(panel)
    setIsMobileMenuOpen(false)
  }

  function renderPanel() {
    if (activePanel === 'microphones') {
      return <MicrophonesPanel messages={messages} canWrite={isWriter} />
    }

    if (activePanel === 'bases') {
      return <BasePanel messages={messages} canWrite={isWriter} />
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

    return <MicrophonesPanel messages={messages} canWrite={isWriter} />

  }

  return (
    <main>
      <div className="top-controls">
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? messages.themeSwitcher.toLight : messages.themeSwitcher.toDark}
          className="control-button"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <label htmlFor="language" className="language-control">
          <select
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            className="language-select"
          >
            <option value="en">{messages.languageSwitcher.options.en}</option>
            <option value="es">{messages.languageSwitcher.options.es}</option>
          </select>
        </label>
      </div>

      {isAuthenticated ? (
        <div className="app-shell">
          <button
            type="button"
            className="menu-toggle"
            ref={menuToggleRef}
            aria-label={messages.menu.toggle}
            aria-expanded={isMobileMenuOpen}
            aria-controls="app-sidebar"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
          >
            <span aria-hidden="true">☰</span>
            <span>{messages.menu.toggle}</span>
          </button>

          <button
            type="button"
            aria-label={messages.menu.close}
            className={`menu-overlay ${isMobileMenuOpen ? 'open' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <aside
            id="app-sidebar"
            ref={sidebarRef}
            tabIndex={-1}
            className={`app-sidebar ${isMobileMenuOpen ? 'open' : ''}`}
          >
            <Menu
              messages={messages}
              activePanel={activePanel}
              onSelectPanel={handleSelectPanel}
              onSignOut={handleSignOut}
            />
          </aside>

          <section className="app-content">
            {renderPanel()}
          </section>
        </div>
      ) : (
        <AuthPanel messages={messages} />
      )}
    </main>
  )
}

export default App
