import { useEffect, useState } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

export type MicrophoneRow = {
  id: number
  identifier: number
  modelId: number
  modelName: string
  micTypeId: number | null
  micTypeName: string
  latestAttachmentBase: number | null
}

type MicAttacherProps = {
  messages: Messages
  canWrite: boolean
  open: boolean
  microphone: MicrophoneRow | null
  onClose: () => void
  onAttached: () => Promise<void>
}

type AvailableBaseRow = {
  id: number
  identifier: number
  available: boolean
}

export default function MicAttacher({
  messages,
  canWrite,
  open,
  microphone,
  onClose,
  onAttached,
}: MicAttacherProps) {
  // Initialize loading as true: the parent uses a key prop to remount this
  // component fresh each time the dialog opens, so we start in a fetching state.
  const [loading, setLoading] = useState(true)
  const [baseChoices, setBaseChoices] = useState<Array<AvailableBaseRow>>([])
  const [baseId, setBaseId] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Load choices when dialog opens
  useEffect(() => {
    if (!open || !microphone || !supabase || !canWrite) return

    let active = true

    ;(async () => {
      try {
        const micId = microphone.id
        const modelId = microphone.modelId

        const { data: availableBases, error: rpcError } = await supabase
          .rpc('get_available_bases_for_mic', {
            p_mic_id: micId,
            p_model_id: modelId,
          })

        if (!active) return
        if (rpcError) throw rpcError

        if (!active) return
        setBaseChoices((availableBases ?? []) as AvailableBaseRow[])
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
  }, [open, microphone, canWrite, messages.microphones.feedback.loadFailed])

  async function confirmAttach() {
    if (!supabase || !canWrite || !microphone) return

    const baseIdNum = Number.parseInt(baseId, 10)
    if (Number.isNaN(baseIdNum)) return

    setError(null)
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error(messages.microphones.feedback.authRequired)

      const payload = {
        base: baseIdNum,
        microphone: microphone.id,
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

        {microphone ? (
          <div style={{ marginBottom: 10, opacity: 0.9 }}>
            N°{microphone.identifier} {microphone.modelName} {microphone.micTypeName ? `${microphone.micTypeName}` : ''}
          </div>
        ) : null}

        <label htmlFor="attach-base" style={{ textAlign: 'left' }}>
          {messages.attachments.fields.selectBase}
        </label>
        <select
          id="attach-base"
          value={baseId}
          onChange={(event) => setBaseId(event.target.value)}
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
          <option value="">{messages.attachments.fields.selectBase}</option>
          {baseChoices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.identifier}
            </option>
          ))}
        </select>

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
            disabled={loading || !baseId}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.microphones.actions.attach}
          </button>
        </div>
      </div>
    </div>
  )
}

