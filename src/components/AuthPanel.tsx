import { useEffect, useMemo, useState } from 'react'
import type { Messages } from '../i18n'
import { isSupabaseConfigured, supabase } from '../supabaseClient'

type DbRow = Record<string, unknown>
type ConnectionState = 'checking' | 'connected' | 'failed'
type AuthMode = 'signIn' | 'signUp'

type AuthPanelProps = {
  messages: Messages
}

export default function AuthPanel({ messages }: AuthPanelProps) {
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('signIn')

  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    supabase ? 'checking' : 'failed',
  )

  const [sessionEmail, setSessionEmail] = useState<string | null>(null)

  const [dbLoading, setDbLoading] = useState(false)
  const [dbRows, setDbRows] = useState<DbRow[]>([])
  const missingConfig = !isSupabaseConfigured

  // Hardcoded table name per task; change to your table.
  const tableName = useMemo(() => 'your_table_name', [])

  useEffect(() => {
    if (!supabase) {
      return
    }

    let active = true

    ;(async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (!active) return

      if (error) {
        setError(error.message)
        setSessionEmail(null)
        setConnectionState('failed')
        return
      }

      setSessionEmail(session?.user?.email ?? null)
      setConnectionState('connected')
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signInWithPassword() {
    if (!supabase) {
      return
    }

    setStatus(null)
    setError(null)
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setStatus(messages.auth.feedback.loggedIn)
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.auth.feedback.loginFailed
      setError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  async function signUp() {
    if (!supabase) {
      return
    }

    setStatus(null)
    setError(null)
    setAuthLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name.trim(),
            last_name: lastName.trim(),
          },
        },
      })
      if (error) throw error

      if (data.session) {
        setStatus(messages.auth.feedback.signUpWithSession)
      } else {
        setStatus(messages.auth.feedback.signUpCheckEmail)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.auth.feedback.signUpFailed
      setError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  async function signOut() {
    if (!supabase) {
      return
    }

    setStatus(null)
    setError(null)
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setDbRows([])
      setStatus(messages.auth.feedback.signedOut)
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.auth.feedback.signOutFailed
      setError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  async function fetchDb() {
    if (!supabase) {
      return
    }

    setStatus(null)
    setError(null)
    setDbLoading(true)
    try {
      // Example: public select.
      // Ensure your Supabase table exists and RLS policies allow the logged-in user.
      const { data, error } = await supabase.from(tableName).select('*').limit(20)
      if (error) throw error
      setDbRows((data ?? []) as DbRow[])
      setStatus(messages.auth.feedback.dbLoaded)
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.auth.feedback.fetchDbFailed
      setError(msg)
      setDbRows([])
    } finally {
      setDbLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h2 style={{ marginTop: 24 }}>{messages.auth.title}</h2>

      <div style={{ margin: '12px 0' }}>
        <div>
          <strong>{messages.auth.session.label}</strong>{' '}
          {sessionEmail ?? messages.auth.session.signedOut}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <h3 style={{ margin: '0 0 4px', textAlign: 'left' }}>
          {authMode === 'signIn' ? messages.auth.panels.signInTitle : messages.auth.panels.signUpTitle}
        </h3>

        {authMode === 'signUp' ? (
          <>
            <label htmlFor="signup-name" style={{ textAlign: 'left' }}>
              {messages.auth.fields.name}
            </label>
            <input
              id="signup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              required
              autoComplete="given-name"
              placeholder={messages.auth.fields.name}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <label htmlFor="signup-last-name" style={{ textAlign: 'left' }}>
              {messages.auth.fields.lastName}
            </label>
            <input
              id="signup-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              type="text"
              required
              autoComplete="family-name"
              placeholder={messages.auth.fields.lastName}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
            />
          </>
        ) : null}

        <label htmlFor="auth-email" style={{ textAlign: 'left' }}>
          {messages.auth.fields.email}
        </label>
        <input
          id="auth-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          autoComplete="email"
          placeholder={messages.auth.fields.email}
          style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
        />
        <label htmlFor="auth-password" style={{ textAlign: 'left' }}>
          {messages.auth.fields.password}
        </label>
        <input
          id="auth-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          placeholder={messages.auth.fields.password}
          style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {authMode === 'signIn' ? (
            <button
              type="button"
              onClick={signInWithPassword}
              disabled={missingConfig || authLoading || !email || !password}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.auth.actions.signIn}
            </button>
          ) : (
            <button
              type="button"
              onClick={signUp}
              disabled={
                missingConfig ||
                authLoading ||
                !name.trim() ||
                !lastName.trim() ||
                !email ||
                !password
              }
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.auth.actions.signUp}
            </button>
          )}
          <button
            type="button"
            onClick={signOut}
            disabled={missingConfig || authLoading || !sessionEmail}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.auth.actions.signOut}
          </button>
        </div>

        <div style={{ textAlign: 'left' }}>
          {authMode === 'signIn' ? (
            <>
              {messages.auth.panels.toSignUpPrefix}{' '}
              <button
                type="button"
                onClick={() => {
                  setStatus(null)
                  setError(null)
                  setAuthMode('signUp')
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  textDecoration: 'underline',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                {messages.auth.panels.toSignUpLink}
              </button>
            </>
          ) : (
            <>
              {messages.auth.panels.toSignInPrefix}{' '}
              <button
                type="button"
                onClick={() => {
                  setStatus(null)
                  setError(null)
                  setAuthMode('signIn')
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  textDecoration: 'underline',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                {messages.auth.panels.toSignInLink}
              </button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson' }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      {status ? (
        <div style={{ marginTop: 12, color: 'green' }}>
          <strong>{messages.auth.feedback.status}</strong> {status}
        </div>
      ) : null}

    </div>
  )
}
