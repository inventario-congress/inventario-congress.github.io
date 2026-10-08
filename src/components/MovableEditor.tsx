import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import type { ExtraField, MovableStrings } from './movable/types'

type MovableEditorProps = {
  // Table name; used as-is for queries and element ids.
  type: string
  strings: MovableStrings
  extraFields?: ExtraField[]
  messages: Messages
  canWrite: boolean
  isOpen: boolean
  movableId?: number | null
  onClose: () => void
  onSaved?: () => void
}

const NO_EXTRA_FIELDS: ExtraField[] = []

function isExtraValid(field: ExtraField, value: string): boolean {
  return field.type === 'number' ? !Number.isNaN(Number.parseInt(value, 10)) : value.trim().length > 0
}

export default function MovableEditor({ type, strings, extraFields = NO_EXTRA_FIELDS, messages, canWrite, isOpen, onClose, onSaved, movableId }: MovableEditorProps) {
  const isEditMode = typeof movableId === 'number' && movableId > 0

  const editorStrings = {
    title: isEditMode ? strings.dialogs.editor.titleEdit : strings.dialogs.editor.titleCreate,
    description: strings.dialogs.editor.description,
    fields: strings.dialogs.editor.fields,
    actions: strings.dialogs.editor.actions,
    feedback: strings.dialogs.editor.feedback,
  }

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [model, setModel] = useState('')
  const [extraValues, setExtraValues] = useState<Record<string, string>>({})

  const resetForm = useCallback(() => {
    setLoading(false)
    setError(null)
    setIdentifier('')
    setModel('')
    setExtraValues({})
  }, [])

  const close = useCallback(() => {
    if (loading) return
    resetForm()
    onClose()
  }, [loading, onClose, resetForm])

  const loadForEdit = useCallback(async () => {
    if (!supabase) return
    if (!isEditMode || !movableId) return

    setError(null)
    setLoading(true)

    try {
      const { data, error: loadError } = await supabase
        .from(type)
        .select(['id', 'identifier', 'model', ...extraFields.map((f) => f.key)].join(', ') as '*')
        .eq('id', movableId)
        .single()

      if (loadError) throw loadError

      const record = (data ?? {}) as unknown as Record<string, unknown>
      setIdentifier(String((record.identifier as number | null) ?? ''))
      setModel(String((record.model as string | null) ?? ''))
      setExtraValues(Object.fromEntries(extraFields.map((f) => [f.key, String(record[f.key] ?? '')])))
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [movableId, isEditMode, type, strings.feedback.loadFailed, extraFields])

  useEffect(() => {
    if (!isOpen || !canWrite) return

    void (async () => {
      resetForm()
      if (isEditMode) {
        await loadForEdit()
      }
    })()
  }, [canWrite, isEditMode, isOpen, loadForEdit, resetForm])

  const submitDisabled = useMemo(() => {
    if (!canWrite) return true
    if (!supabase) return true
    if (loading) return true

    const parsedIdentifier = Number.parseInt(identifier, 10)
    if (Number.isNaN(parsedIdentifier)) return true
    if (!model.trim()) return true
    if (extraFields.some((f) => !isExtraValid(f, extraValues[f.key] ?? ''))) return true

    return false
  }, [canWrite, extraFields, extraValues, identifier, loading, model])

  const handleSubmit = useCallback(async () => {
    if (!supabase) return
    if (!canWrite) return

    const parsedIdentifier = Number.parseInt(identifier, 10)
    if (Number.isNaN(parsedIdentifier)) return
    if (!model.trim()) return
    if (extraFields.some((f) => !isExtraValid(f, extraValues[f.key] ?? ''))) return

    setError(null)
    setLoading(true)

    try {
      const payload: Record<string, string | number> = {
        identifier: parsedIdentifier,
        model: model.trim(),
      }
      for (const f of extraFields) {
        const raw = extraValues[f.key] ?? ''
        payload[f.key] = f.type === 'number' ? Number.parseInt(raw, 10) : raw.trim()
      }

      if (isEditMode && movableId) {
        const { error: updateError } = await supabase
          .from(type)
          .update(payload)
          .eq('id', movableId)

        if (updateError) throw updateError
      } else {
        const { error: createError } = await supabase
          .from(type)
          .insert(payload)

        if (createError) throw createError
      }

      onSaved?.()
      close()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : isEditMode
            ? editorStrings.feedback.updateFailed
            : editorStrings.feedback.createFailed,
      )
    } finally {
      setLoading(false)
    }
  }, [canWrite, close, extraFields, extraValues, type, movableId, editorStrings.feedback.createFailed, editorStrings.feedback.updateFailed, identifier, isEditMode, model, onSaved])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editorStrings.title}
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
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
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
            <h3 style={{ margin: '0 0 6px 0' }}>{editorStrings.title}</h3>
            <p style={{ margin: 0, color: 'var(--text)' }}>{editorStrings.description}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={messages.menu.close}
            disabled={loading}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
          style={{ display: 'grid', gap: 10, marginTop: 14 }}
        >
          <label htmlFor={`${type}-editor-identifier`} style={{ textAlign: 'left' }}>
            {editorStrings.fields.identifier}
          </label>
          <input
            id={`${type}-editor-identifier`}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            type="number"
            required
            placeholder={editorStrings.fields.identifier}
            disabled={loading}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />

          <label htmlFor={`${type}-editor-model`} style={{ textAlign: 'left' }}>
            {editorStrings.fields.model}
          </label>
          <input
            id={`${type}-editor-model`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            type="text"
            required
            placeholder={editorStrings.fields.model}
            disabled={loading}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />

          {extraFields.map((f) => (
            <Fragment key={f.key}>
              <label htmlFor={`${type}-editor-${f.key}`} style={{ textAlign: 'left' }}>
                {f.label}
              </label>
              <input
                id={`${type}-editor-${f.key}`}
                value={extraValues[f.key] ?? ''}
                onChange={(e) => setExtraValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                type={f.type}
                required
                placeholder={f.label}
                disabled={loading}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              />
            </Fragment>
          ))}

          {error ? (
            <div style={{ color: 'crimson' }}>
              <strong>{messages.auth.feedback.error}</strong> {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <button
              type="button"
              onClick={close}
              disabled={loading}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {editorStrings.actions.cancel}
            </button>
            <button type="submit" disabled={submitDisabled} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
              {loading ? editorStrings.feedback.submitting : editorStrings.actions.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

