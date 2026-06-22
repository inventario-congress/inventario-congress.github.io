import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

type DbRow = Record<string, unknown>

export default function AuthPanel() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sessionEmail, setSessionEmail] = useState<string | null>(null)

  const [dbLoading, setDbLoading] = useState(false)
  const [dbRows, setDbRows] = useState<DbRow[]>([])

  // Hardcoded table name per task; change to your table.
  const tableName = useMemo(() => 'your_table_name', [])

  useEffect(() => {
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
        return
      }

      setSessionEmail(session?.user?.email ?? null)
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
    setError(null)
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed'
      setError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  async function signUp() {
    setError(null)
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed'
      setError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  async function signOut() {
    setError(null)
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setDbRows([])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign out failed'
      setError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  async function fetchDb() {
    setError(null)
    setDbLoading(true)
    try {
      // Example: public select.
      // Ensure your Supabase table exists and RLS policies allow the logged-in user.
      const { data, error } = await supabase.from(tableName).select('*').limit(20)
      if (error) throw error
      setDbRows((data ?? []) as DbRow[])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch database'
      setError(msg)
      setDbRows([])
    } finally {
      setDbLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h2 style={{ marginTop: 24 }}>Authentication (Supabase)</h2>

      <div style={{ margin: '12px 0' }}>
        <div>
          <strong>Signed in as:</strong> {sessionEmail ?? 'Not signed in'}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={signInWithPassword}
            disabled={authLoading || !email || !password}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={signUp}
            disabled={authLoading || !email || !password}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={signOut}
            disabled={authLoading || !sessionEmail}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson' }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />

      <div>
        <h3 style={{ margin: '0 0 8px' }}>Database viewer (logged-in)</h3>
        <div style={{ marginBottom: 10 }}>
          Table: <code>{tableName}</code> (edit in <code>AuthPanel.tsx</code>)
        </div>

        <button
          type="button"
          onClick={fetchDb}
          disabled={dbLoading || !sessionEmail}
          style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
        >
          {dbLoading ? 'Loading...' : 'Fetch first 20 rows'}
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
            <div style={{ color: 'var(--text)' }}>No data loaded yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}

