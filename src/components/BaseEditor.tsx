import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type ModelChoice = {
  id: number
  name: string
  checked: boolean
}

type BaseEditorProps = {
  messages: Messages
  canWrite: boolean
  isOpen: boolean
  baseId?: number | null
  onClose: () => void
  onSaved?: () => void
}


export default function BaseEditor({ messages, canWrite, isOpen, onClose, onSaved, baseId }: BaseEditorProps) {
  const isEditMode = typeof baseId === 'number' && baseId > 0
  const strings = messages.bases
  const editorStrings = {
    // Always derive editor strings from the nested i18n structure.
    // This prevents accidental use of the nested object (which would make keys like
    // modelSelectorNone/modelSelectorSelected resolve to undefined).
    description: strings.dialogs.editor.description,
    modelSelectorTitle: strings.dialogs.editor.fields.models,
    modelSelectorNone: strings.dialogs.editor.feedback.modelSelectorNone,
    modelSelectorSelected: strings.dialogs.editor.feedback.modelSelectorSelected,
    loadingModels: strings.dialogs.editor.feedback.loadingModels,
    noModels: strings.dialogs.editor.feedback.noModels,
    submitting: strings.dialogs.editor.feedback.submitting,
    // Title must depend on whether we are editing.
    title: isEditMode ? strings.actions.update : strings.actions.create,
  }


  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [identifier, setIdentifier] = useState('')
  const [maxMicCount, setMaxMicCount] = useState('')

  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelChoices, setModelChoices] = useState<ModelChoice[]>([])

  const [selectedModelIds, setSelectedModelIds] = useState<Set<number>>(new Set())

  const resetForm = useCallback(() => {
    setLoading(false)
    setError(null)
    setIdentifier('')
    setMaxMicCount('')
    setModelChoices([])
    setSelectedModelIds(new Set())
  }, [])

  const close = useCallback(() => {
    if (loading) return
    resetForm()
    onClose()
  }, [loading, onClose, resetForm])

  const loadModels = useCallback(async () => {
    if (!supabase) return

    setModelsLoading(true)
    setError(null)

    try {
      const [modelsRes, assocRes] = await Promise.all([
        supabase
          .from('model')
          .select('id, name')
          .order('name', { ascending: true }),
        isEditMode
          ? supabase.from('base_mic_models').select('model').eq('base', baseId)
          : Promise.resolve({ data: [], error: null as unknown }),
      ])

      const { data: modelsData, error: modelsError } = modelsRes
      if (modelsError) throw modelsError

      const { data: assocData, error: assocError } = assocRes as {
        data: Array<{ model: bigint | number }> | null
        error: unknown
      }
      if (assocError) throw assocError

      const selectedIds = new Set<number>(
        Array.from(assocData ?? []).map((r) => Number(r.model)).filter((n) => !Number.isNaN(n)),
      )

      const mapped: ModelChoice[] = (modelsData ?? []).map((m) => ({
        id: m.id as number,
        name: m.name as string,
        checked: selectedIds.has(m.id as number),
      }))

      setModelChoices(mapped)
      setSelectedModelIds(selectedIds)
    } catch (e) {
      const msg = e instanceof Error ? e.message : strings.feedback.loadFailed
      setError(msg)
    } finally {
      setModelsLoading(false)
    }
  }, [baseId, isEditMode, strings.feedback.loadFailed])

  useEffect(() => {
    if (!isOpen) return
    if (!canWrite) return

    if (!isEditMode || !baseId) {
      // Avoid setting state directly in the effect body (react-hooks/set-state-in-effect).
      void Promise.resolve().then(() => {
        resetForm()
      })
      return
    }

    void (async () => {
      setError(null)
      setLoading(true)
      try {
        const sb = supabase
        if (!sb) return

        const { data: baseData, error: baseError } = await sb
          .from('base')
          .select('identifier, max_mic_count')
          .eq('id', baseId)
          .single()

        if (baseError) throw baseError

        setIdentifier(String((baseData?.identifier as number | null) ?? ''))
        setMaxMicCount(String((baseData?.max_mic_count as number | null) ?? ''))
      } catch (e) {
        const msg = e instanceof Error ? e.message : strings.feedback.loadFailed
        setError(msg)
      } finally {
        setLoading(false)
      }
    })()
  }, [isEditMode, baseId, isOpen, canWrite, resetForm, strings.feedback.loadFailed])

  useEffect(() => {
    if (!isOpen) return
    if (!canWrite) return

    // Same rationale: avoid triggering setState synchronously from the effect body.
    void Promise.resolve().then(() => {
      void loadModels()
    })
  }, [isOpen, canWrite, loadModels])

  const submitDisabled = useMemo(() => {
    if (!canWrite) return true
    if (!supabase) return true
    if (loading) return true
    if (modelsLoading) return true

    const parsedIdentifier = Number.parseInt(identifier, 10)
    const parsedMaxMicCount = Number.parseInt(maxMicCount, 10)

    return Number.isNaN(parsedIdentifier) || Number.isNaN(parsedMaxMicCount)
  }, [canWrite, identifier, maxMicCount, loading, modelsLoading])

  // baseId is used for edit mode
  void baseId

  const handleSubmit = useCallback(async () => {
    if (!supabase) return
    if (!canWrite) return

    const parsedIdentifier = Number.parseInt(identifier, 10)
    const parsedMaxMicCount = Number.parseInt(maxMicCount, 10)

    if (Number.isNaN(parsedIdentifier) || Number.isNaN(parsedMaxMicCount)) return

    setError(null)
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const userId = session?.user?.id
      if (!userId) {
        throw new Error(messages.microphones.feedback.authRequired)
      }

      let targetBaseId: number | null = null

      if (isEditMode && baseId) {
        // Update base
        const { error: updateBaseError } = await supabase
          .from('base')
          .update({ identifier: parsedIdentifier, max_mic_count: parsedMaxMicCount })
          .eq('id', baseId)

        if (updateBaseError) throw updateBaseError
        targetBaseId = baseId
      } else {
        // Insert base
        const { data: createdBases, error: createBaseError } = await supabase
          .from('base')
          .insert({ identifier: parsedIdentifier, max_mic_count: parsedMaxMicCount })
          .select('id')

        if (createBaseError) throw createBaseError

        const createdBaseId = (createdBases?.[0]?.id as number | undefined) ?? null
        if (!createdBaseId) throw new Error(strings.feedback.createFailed)
        targetBaseId = createdBaseId
      }

      if (!targetBaseId) throw new Error(strings.feedback.createFailed)

      // Replace base_mic_models associations
      const { error: deleteAssocError } = await supabase
        .from('base_mic_models')
        .delete()
        .eq('base', targetBaseId)

      if (deleteAssocError) throw deleteAssocError

      const assocRows = Array.from(selectedModelIds).map((modelId) => ({
        base: targetBaseId,
        model: modelId,
      }))

      if (assocRows.length > 0) {
        const { error: assocError } = await supabase.from('base_mic_models').insert(assocRows)
        if (assocError) throw assocError
      }

      setLoading(false)
      onSaved?.()
      close()

    } catch (e) {
      const msg = e instanceof Error ? e.message : strings.feedback.createFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [baseId, canWrite, close, identifier, isEditMode, maxMicCount, messages.microphones.feedback.authRequired, onSaved, selectedModelIds, strings.feedback.createFailed, setLoading])


  function toggleModel(modelId: number) {
    setSelectedModelIds((prev) => {
      const next = new Set(prev)
      if (next.has(modelId)) next.delete(modelId)
      else next.add(modelId)
      return next
    })

    setModelChoices((prev) =>
      prev.map((m) => (m.id === modelId ? { ...m, checked: !m.checked } : m)),
    )
  }

  const modal = useMemo(() => {
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

            <label htmlFor="base-editor-identifier" style={{ textAlign: 'left' }}>
              {strings.fields.identifier}
            </label>

            <input
              id="base-editor-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              type="number"
              required
              placeholder={strings.fields.identifier}

              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 10,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            />

            <label htmlFor="base-editor-max-mic-count" style={{ textAlign: 'left' }}>
              {strings.fields.maxMicCount}
            </label>

            <input
              id="base-editor-max-mic-count"
              value={maxMicCount}
              onChange={(e) => setMaxMicCount(e.target.value)}
              type="number"
              required
              placeholder={strings.fields.maxMicCount}

              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 10,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            />

            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontWeight: 600 }}>{editorStrings.modelSelectorTitle}</div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>
                  {selectedModelIds.size === 0 ? editorStrings.modelSelectorNone : `${selectedModelIds.size} ${editorStrings.modelSelectorSelected}`}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 10,
                  marginTop: 8,
                  maxHeight: 240,
                  overflow: 'auto',
                }}
              >
                {modelsLoading ? (
                  <div style={{ opacity: 0.85 }}>{editorStrings.loadingModels}</div>
                ) : modelChoices.length === 0 ? (
                  <div style={{ opacity: 0.85 }}>{editorStrings.noModels}</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {modelChoices.map((m) => (
                      <label
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          cursor: loading ? 'not-allowed' : 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={m.checked}
                          onChange={() => toggleModel(m.id)}
                          disabled={loading || modelsLoading}
                        />
                        <span>{m.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
                {strings.actions.cancelEdit}
              </button>
              <button type="submit" disabled={submitDisabled} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
                {loading ? editorStrings.submitting : isEditMode ? strings.actions.update : strings.actions.create}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }, [
    close,
    error,
    handleSubmit,
    editorStrings.description,
    editorStrings.loadingModels,
    editorStrings.modelSelectorNone,
    editorStrings.modelSelectorSelected,
    editorStrings.modelSelectorTitle,
    editorStrings.noModels,
    editorStrings.submitting,
    editorStrings.title,
    identifier,
    isOpen,
    loading,
    maxMicCount,
    messages.auth.feedback.error,
    messages.menu.close,
    modelChoices,
    modelsLoading,
    selectedModelIds,
    strings.actions.create,
    strings.actions.update,
    strings.actions.cancelEdit,
    isEditMode,
    strings.fields.identifier,
    strings.fields.maxMicCount,
    submitDisabled,
  ])

  return modal
}

