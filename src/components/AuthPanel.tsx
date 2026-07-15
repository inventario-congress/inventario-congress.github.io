import { type FormEvent, useEffect, useState } from 'react'
import type { Messages } from '../i18n'
import { isSupabaseConfigured, supabase } from '../supabaseClient'

type AuthMode = 'signIn' | 'signUp'

type AuthPanelProps = {
  messages: Messages
}

export default function AuthPanel({ messages }: AuthPanelProps) {
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signIn')

  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [sessionEmail, setSessionEmail] = useState<string | null>(null)

  const missingConfig = !isSupabaseConfigured

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
      setStatus(messages.auth.feedback.signedOut)
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.auth.feedback.signOutFailed
      setError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (authMode === 'signIn') {
      void signInWithPassword()
      return
    }

    void signUp()
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h2 style={{ marginTop: 24 }}>{messages.auth.title}</h2>

      <form onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <h3 style={{ margin: '0 0 4px', textAlign: 'left' }}>
          {authMode === 'signIn' ? '' : messages.auth.panels.signUpTitle}
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

        <input
          id="auth-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          autoComplete="email"
          placeholder={messages.auth.fields.email}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}
        />
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            id="auth-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={passwordVisible ? 'text' : 'password'}
            autoComplete={authMode === 'signIn' ? 'current-password' : 'new-password'}
            required
            placeholder={messages.auth.fields.password}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 44px 10px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((current) => !current)}
            aria-label={
              passwordVisible
                ? messages.auth.accessibility.hidePassword
                : messages.auth.accessibility.showPassword
            }
            title={
              passwordVisible
                ? messages.auth.accessibility.hidePassword
                : messages.auth.accessibility.showPassword
            }
            aria-pressed={passwordVisible}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {passwordVisible ? (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 2.5l19 19" />
                <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88" />
                <path d="M10.73 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a18.06 18.06 0 0 1-2.67 3.77" />
                <path d="M6.23 6.23C3.7 7.96 2 12 2 12s3.5 7 10 7c1.4 0 2.72-.25 3.94-.72" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {authMode === 'signIn' ? (
            <button
              type="submit"
              disabled={missingConfig || authLoading || !email || !password}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.auth.actions.signIn}
            </button>
          ) : (
            <button
              type="submit"
              disabled={
                missingConfig ||
                authLoading ||
                // If already authenticated, prevent sign-up mode entirely.
                Boolean(sessionEmail) ||
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
        </div>

        <div style={{ textAlign: 'left' }}>
          {authMode === 'signIn' ? (
            // Hide the sign-up link entirely if user is authenticated.
            sessionEmail ? null : (
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
            )
          ) : (
            // In sign-up mode, switching back to sign-in makes sense only when not authenticated.
            sessionEmail ? null : (
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
            )
          )}
        </div>
      </form>

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
