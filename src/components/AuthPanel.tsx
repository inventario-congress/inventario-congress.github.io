import { useEffect, useMemo, useState } from 'react'
import type { Messages } from '../i18n'
import { supabase, supabaseConfigError } from '../supabaseClient'

type DbRow = Record<string, unknown>
type ConnectionState = 'checking' | 'connected' | 'failed'

type AuthPanelProps = {
  messages: Messages
}

export default function AuthPanel({ messages }: AuthPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    supabase ? 'checking' : 'failed',
  )

  const [sessionEmail, setSessionEmail] = useState<string | null>(null)

  const [dbLoading, setDbLoading] = useState(false)
  const [dbRows, setDbRows] = useState<DbRow[]>([])
  const missingConfig = Boolean(supabaseConfigError)

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
      const { data, error } = await supabase.auth.signUp({ email, password })
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

      <div style={{ marginTop: 12, textAlign: 'left' }}>
        <strong>{messages.auth.connection.label}</strong>{' '}
        {connectionState === 'checking'
          ? messages.auth.connection.checking
          : connectionState === 'connected'
            ? messages.auth.connection.connected
            : messages.auth.connection.failed}
      </div>

      {missingConfig ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 6,
            border: '1px solid var(--border)',
            textAlign: 'left',
          }}
        >
          <strong>{messages.auth.setupRequired.title}</strong>
          <div style={{ marginTop: 8 }}>
            {messages.auth.setupRequired.messageStart} <code>VITE_SUPABASE_URL</code>{' '}
            {messages.auth.setupRequired.messageMiddle}{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> {messages.auth.setupRequired.messageEnd}{' '}
            <code>.env.local</code> {messages.auth.setupRequired.messageSuffix}
          </div>
        </div>
      ) : null}

      <div style={{ margin: '12px 0' }}>
        <div>
          <strong>{messages.auth.session.label}</strong>{' '}
          {sessionEmail ?? messages.auth.session.signedOut}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder={messages.auth.fields.email}
          style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder={messages.auth.fields.password}
          style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={signInWithPassword}
            disabled={missingConfig || authLoading || !email || !password}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.auth.actions.signIn}
          </button>
          <button
            type="button"
            onClick={signUp}
            disabled={missingConfig || authLoading || !email || !password}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.auth.actions.signUp}
          </button>
          <button
            type="button"
            onClick={signOut}
            disabled={missingConfig || authLoading || !sessionEmail}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.auth.actions.signOut}
          </button>
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

      <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />

      <div>
        <h3 style={{ margin: '0 0 8px' }}>{messages.auth.database.title}</h3>
        <div style={{ marginBottom: 10 }}>
          {messages.auth.database.tableLabel} <code>{tableName}</code>{' '}
          {messages.auth.database.editHintStart} <code>AuthPanel.tsx</code>{' '}
          {messages.auth.database.editHintEnd}
        </div>

        <button
          type="button"
          onClick={fetchDb}
          disabled={missingConfig || dbLoading || !sessionEmail}
          style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
        >
          {dbLoading ? messages.auth.database.loading : messages.auth.database.fetchRows}
        </button>

        <div style={{ marginTop: 14, textAlign: 'left' }}>
          {dbRows.length ? (
            <pre
              style={{
                overflowX: 'auto',
                padding: 12,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--code-bg)',
              }}
            >
              {JSON.stringify(dbRows, null, 2)}
            </pre>
          ) : (
            <div style={{ color: 'var(--text)' }}>{messages.auth.database.empty}</div>
          )}
        </div>
      </div>
    </div>
  )
}
