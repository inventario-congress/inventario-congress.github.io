import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import type { Messages } from '../i18n'
import { isSupabaseConfigured, supabase } from '../supabaseClient'

type ProfilePanelProps = {
  messages: Messages
  email: string | null
  name: string | null
  lastName: string | null
}

export default function ProfilePanel({ messages, email, name, lastName }: ProfilePanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [authLoading, setAuthLoading] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const strings = messages.profile.dialogs.changePassword
  const canAttemptChange = isSupabaseConfigured && hasSession && !saving

  useEffect(() => {
    if (!supabase) return


    let active = true

    ;(async () => {
      setAuthLoading(true)
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (!active) return
        if (error) {
          setHasSession(false)
          return
        }

        setHasSession(Boolean(session))
      } finally {
        if (active) setAuthLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const resetForm = useCallback(() => {
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setStatus(null)
  }, [])



  const openModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const submitChangePassword = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setError(null)
      setStatus(null)

      if (!supabase) {
        setError(strings.feedback.notAuthenticated)
        return
      }

      if (!hasSession) {
        setError(strings.feedback.notAuthenticated)
        return
      }

      if (!newPassword || !confirmPassword) {
        setError(strings.feedback.saveFailed)
        return
      }

      if (newPassword !== confirmPassword) {
        setError(strings.feedback.passwordMismatch)
        return
      }

      setSaving(true)
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw error

        setStatus(strings.feedback.saved)
        setIsModalOpen(false)
        resetForm()
      } catch (e) {
        const msg = e instanceof Error ? e.message : strings.feedback.saveFailed
        setError(msg)
      } finally {
        setSaving(false)
      }
    },
    [
      confirmPassword,
      hasSession,
      newPassword,
      resetForm,
      setError,
      setIsModalOpen,
      setSaving,
      setStatus,
      strings,
    ]
  )


  const modal = useMemo(() => {
    if (!isModalOpen) return null

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={strings.title}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 50,
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeModal()
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow)',
            textAlign: 'left',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0' }}>{strings.title}</h3>
              <p style={{ margin: 0, color: 'var(--text)' }}>{strings.description}</p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              aria-label={messages.menu.close}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 20,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={submitChangePassword} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <label htmlFor="new-password" style={{ textAlign: 'left' }}>
              {strings.fields.newPassword}
            </label>
            <input
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              required
              autoComplete="new-password"
              placeholder={strings.fields.newPassword}
              name="new-password"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 10,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            />

            <label htmlFor="confirm-password" style={{ textAlign: 'left' }}>
              {strings.fields.confirmPassword}
            </label>
            <input
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              required
              autoComplete="new-password"
              placeholder={strings.fields.confirmPassword}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 10,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            />

            {error ? (
              <div style={{ color: 'crimson' }}>
                <strong>{messages.auth.feedback.error}</strong> {error}
              </div>
            ) : null}

            {status ? (
              <div style={{ color: 'green' }}>
                <strong>{messages.auth.feedback.status}</strong> {status}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {strings.actions.cancel}
              </button>
              <button
                type="submit"
                disabled={!canAttemptChange || authLoading}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {saving ? strings.feedback.loading : strings.actions.save}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }, [
    isModalOpen,
    strings,
    messages.menu.close,
    messages.auth.feedback.error,
    messages.auth.feedback.status,
    newPassword,
    confirmPassword,
    saving,
    authLoading,
    canAttemptChange,
    error,
    status,
    submitChangePassword,
  ])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <h2 style={{ marginTop: 0 }}>{messages.profile.title}</h2>
      <p style={{ marginTop: 0 }}>{messages.profile.readOnly}</p>

      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <strong>{messages.profile.fields.name}</strong> {name ?? '-'}
        </div>
        <div>
          <strong>{messages.profile.fields.lastName}</strong> {lastName ?? '-'}
        </div>
        <div>
          <strong>{messages.profile.fields.email}</strong> {email ?? messages.auth.session.signedOut}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={openModal}
          disabled={!isSupabaseConfigured || authLoading || !hasSession}
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            cursor: !isSupabaseConfigured || authLoading || !hasSession ? 'not-allowed' : 'pointer',
            border: '1px solid var(--border)',
            background: 'transparent',
          }}
        >
          {messages.profile.actions.changePassword}
        </button>
      </div>

      {modal}
    </div>
  )
}

