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
  modelName: string
  micTypeName: string
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
        // 1. Get model IDs supported by this base
        const { data: baseModels, error: modelsError } = await supabase
          .from('base_mic_models')
          .select('model')
          .eq('base', base.id)

        if (modelsError) throw modelsError

        const modelIds: number[] = (baseModels ?? []).map((bm: { model: number }) => bm.model)

        if (modelIds.length === 0) {
          if (active) setMicChoices([])
          return
        }

        // 2. Get microphones that currently have an active attachment (to exclude them)
        const { data: activeAttachments, error: attachError } = await supabase
          .from('attachment')
          .select('microphone')
          .eq('is_active', true)

        if (attachError) throw attachError

        const attachedMicIds: number[] = (activeAttachments ?? []).map(
          (a: { microphone: number }) => a.microphone
        )

        // 3. Query microphones matching the base's models, excluding already-attached ones
        let query = supabase
          .from('microphone')
          .select('id, identifier, model, mic_type, model:model(name), mic_type:mic_type(name)')
          .in('model', modelIds)
          .order('identifier', { ascending: true })

        if (attachedMicIds.length > 0) {
          query = query.not('id', 'in', `(${attachedMicIds.join(',')})`)
        }

        const { data: mics, error: micsError } = await query

        if (micsError) throw micsError

        if (!active) return

        const options: AvailableMicOption[] = (mics ?? []).map((m: any) => ({
          id: m.id,
          identifier: m.identifier,
          modelName: m.model?.name ?? '',
          micTypeName: m.mic_type?.name ?? '',
        }))

        setMicChoices(options)
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
                N°{choice.identifier} {choice.modelName}{choice.micTypeName ? ` (${choice.micTypeName})` : ''}
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

