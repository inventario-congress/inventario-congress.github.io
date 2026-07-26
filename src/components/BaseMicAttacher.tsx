import { useEffect, useState } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type BaseInfo = {
  id: number
  identifier: number
}

type AvailableMicOption = {
  id: number
  identifier: number
  model_name: string
  mic_type_name: string
}

type BaseMicAttacherProps = {
  messages: Messages
  canWrite: boolean
  open: boolean
  base: BaseInfo | null
  onClose: () => void
  onAttached: () => Promise<void>
}

export default function BaseMicAttacher({
  messages,
  canWrite,
  open,
  base,
  onClose,
  onAttached,
}: BaseMicAttacherProps) {
  const [loading, setLoading] = useState(false)
  const [micChoices, setMicChoices] = useState<AvailableMicOption[]>([])
  const [micId, setMicId] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Load available microphones when dialog opens
  useEffect(() => {
    if (!open || !base || !supabase || !canWrite) return

    let active = true

    ;(async () => {
      setLoading(true)
      setError(null)

      try {
        // Call RPC get_available_mics_for_base(base_id) to fetch available microphones for the given base
        const { data: availableMics, error: rpcError } = await supabase.rpc('get_available_mics_for_base', {
          p_base_id: base.id,
        })

        if (rpcError) throw rpcError
        if (!active) return

        setMicChoices(availableMics as AvailableMicOption[])

      } catch (e) {
        if (!active) return
        const msg = e instanceof Error ? e.message : messages.microphones.feedback.loadFailed
        setError(msg)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [open, base, canWrite, messages.microphones.feedback.loadFailed])

  async function confirmAttach() {
    if (!supabase || !canWrite || !base) return

    const micIdNum = Number.parseInt(micId, 10)
    if (Number.isNaN(micIdNum)) return

    setError(null)
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error(messages.microphones.feedback.authRequired)

      const payload = {
        base: base.id,
        microphone: micIdNum,
        user: userId,
      }

      const { error: createError } = await supabase.from('attachment').insert(payload)
      if (createError) throw createError

      await onAttached()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.attachments.feedback.createFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 16,
          background: 'var(--bg)',
          color: 'var(--text)',
          width: '100%',
          maxWidth: 400,
          textAlign: 'left',
          boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h4 style={{ margin: '0 0 10px' }}>{messages.microphones.actions.attach}</h4>

        {base ? (
          <div style={{ marginBottom: 10, opacity: 0.9 }}>
            {messages.attachments.fields.base} {messages.bases.table.identifier}{base.identifier}
          </div>
        ) : null}

        <label htmlFor="attach-mic" style={{ textAlign: 'left' }}>
          {messages.attachments.fields.selectMicrophone}
        </label>

        {loading ? (
          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--muted)' }}>
            {messages.bases.feedback.loading_mics}
          </div>
        ) : micChoices.length === 0 ? (
          <div style={{ marginTop: 8, fontSize: 16, color: 'red', fontWeight: 'bold' }}>
            {messages.attachments.feedback.noMicrophonesAvailable}
          </div>
        ) : (
          <select
            id="attach-mic"
            value={micId}
            onChange={(event) => setMicId(event.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
              marginTop: 6,
            }}
          >
            <option value="">{messages.attachments.fields.selectMicrophone}</option>
            {micChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                N°{choice.identifier} {choice.model_name}{choice.mic_type_name ? ` (${choice.mic_type_name})` : ''}
              </option>
            ))}
          </select>
        )}

        {error ? (
          <div style={{ marginTop: 8, color: 'crimson' }}>
            <strong>{messages.auth.feedback.error}</strong> {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.microphones.actions.cancelEdit}
          </button>
          <button
            type="button"
            onClick={confirmAttach}
            disabled={loading || !micId}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.microphones.actions.attach}
          </button>
        </div>
      </div>
    </div>
  )
}

