import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type ModelRow = {
  id: number
  name: string
}

type MicEditorProps = {
  messages: Messages
  canWrite: boolean
  isOpen: boolean
  micId?: number | null
  onClose: () => void
  onSaved?: () => void
}

export default function MicEditor({ messages, canWrite, isOpen, onClose, onSaved, micId }: MicEditorProps) {
  const isEditMode = typeof micId === 'number' && micId > 0

  const { microphones } = messages
  const editorStrings = microphones.dialogs.editor
  const addNewModelDialogStrings = editorStrings.addNewModelDialog

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [identifier, setIdentifier] = useState('')

  const [modelsLoading, setModelsLoading] = useState(false)
  const [models, setModels] = useState<ModelRow[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)

  const [modelId, setModelId] = useState<number | ''>('')

  const [micTypesLoading, setMicTypesLoading] = useState(false)
  const [micTypeChoices, setMicTypeChoices] = useState<Array<{ id: number; name: string }>>([])
  const [micTypesError, setMicTypesError] = useState<string | null>(null)

  const [micTypeId, setMicTypeId] = useState<number | ''>('')

  // Add-new-model nested modal
  const [addModelOpen, setAddModelOpen] = useState(false)
  const [addModelName, setAddModelName] = useState('')
  const [addModelLoading, setAddModelLoading] = useState(false)
  const [addModelError, setAddModelError] = useState<string | null>(null)

  // Track model creations triggered from the nested modal so we can clean up if the mic edit is canceled.
  const [newModelIds, setNewModelIds] = useState<number[]>([])

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setIdentifier('')

    setModelsLoading(false)
    setModels([])
    setModelsError(null)
    setModelId('')

    setMicTypesLoading(false)
    setMicTypeChoices([])
    setMicTypesError(null)
    setMicTypeId('')

    setAddModelOpen(false)
    setAddModelName('')
    setAddModelLoading(false)
    setAddModelError(null)

    setNewModelIds([])
  }, [])

  const close = useCallback(() => {
    if (loading || addModelLoading) return
    reset()
    onClose()
  }, [addModelLoading, loading, onClose, reset])

  const loadModels = useCallback(async () => {
    if (!supabase) return

    setModelsLoading(true)
    setModelsError(null)

    try {
      const { data, error: modelsLoadError } = await supabase
        .from('model')
        .select('id, name')
        .order('name', { ascending: true })

      if (modelsLoadError) throw modelsLoadError

      setModels((data ?? []).map((m) => ({ id: m.id as number, name: m.name as string })))
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : editorStrings.feedback.loadFailed)
    } finally {
      setModelsLoading(false)
    }
  }, [editorStrings.feedback.loadFailed])

  const loadMicTypes = useCallback(async () => {
    if (!supabase) return

    setMicTypesLoading(true)
    setMicTypesError(null)

    try {
      const { data, error: micTypesLoadError } = await supabase
        .from('mic_type')
        .select('id, name')
        .order('name', { ascending: true })

      if (micTypesLoadError) throw micTypesLoadError

      setMicTypeChoices((data ?? []).map((t) => ({ id: t.id as number, name: t.name as string })))
    } catch (e) {
      setMicTypesError(e instanceof Error ? e.message : editorStrings.feedback.loadFailed)
    } finally {
      setMicTypesLoading(false)
    }
  }, [editorStrings.feedback.loadFailed])

  const loadForEdit = useCallback(async () => {
    if (!supabase) return
    if (!isEditMode || !micId) return

    setError(null)
    setLoading(true)

    try {
      const { data, error: micLoadError } = await supabase
        .from('microphone')
        .select('id, identifier, model, mic_type')
        .eq('id', micId)
        .single()

      if (micLoadError) throw micLoadError

      setIdentifier(String((data?.identifier as number | null) ?? ''))
      setModelId((data?.model as number) ?? '')
      setMicTypeId((data?.mic_type as number) ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : editorStrings.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [editorStrings.feedback.loadFailed, isEditMode, micId])

  useEffect(() => {
    if (!isOpen) return
    if (!canWrite) return

    void Promise.all([loadModels(), loadMicTypes()])
    void loadForEdit()
  }, [canWrite, isOpen, loadForEdit, loadModels, loadMicTypes])

  useEffect(() => {
    if (!isOpen) return
    if (modelId === '' || models.length === 0) return
    if (!models.some((m) => m.id === modelId)) setModelId('')
  }, [isOpen, modelId, models])

  useEffect(() => {
    if (!isOpen) return
    if (micTypeId === '' || micTypeChoices.length === 0) return
    if (!micTypeChoices.some((t) => t.id === micTypeId)) setMicTypeId('')
  }, [isOpen, micTypeChoices, micTypeId])

  const submitDisabled = useMemo(() => {
    if (!canWrite) return true
    if (!supabase) return true
    if (loading) return true
    if (modelsLoading || micTypesLoading) return true

    const parsedIdentifier = Number.parseInt(identifier, 10)
    if (Number.isNaN(parsedIdentifier)) return true
    if (modelId === '') return true
    if (micTypeId === '') return true

    return false
  }, [canWrite, identifier, loading, micTypeId, micTypesLoading, modelId, modelsLoading])

  const createModelModalClose = useCallback(() => {
    if (addModelLoading) return
    setAddModelOpen(false)
    setAddModelName('')
    setAddModelError(null)
  }, [addModelLoading])

  const handleAddModel = useCallback(async () => {
    if (!supabase) return
    if (!canWrite) return

    const trimmed = addModelName.trim()
    if (!trimmed) return

    setAddModelLoading(true)
    setAddModelError(null)

    try {
      // Insert/ensure model now; microphone is only created/updated when MicEditor is submitted.
      const { data, error: modelCreateError } = await supabase
        .from('model')
        .upsert({ name: trimmed }, { onConflict: 'name' })
        .select('id')
        .single()

      if (modelCreateError) throw modelCreateError

      await loadModels()

      const createdId = data?.id as number | undefined

      setAddModelOpen(false)
      setAddModelName('')
      setAddModelError(null)

      if (typeof createdId === 'number' && !Number.isNaN(createdId)) {
        setModelId(createdId)
        // Remember that this model was created from the nested modal.
        setNewModelIds((prev) => (prev.includes(createdId) ? prev : [...prev, createdId]))
      } else {
        const found = models.find((m) => m.name === trimmed)
        if (found) {
          setModelId(found.id)
        }
      }
    } catch (e) {
      setAddModelError(e instanceof Error ? e.message : editorStrings.feedback.addNewModelCreateFailed)
    } finally {
      setAddModelLoading(false)
    }
  }, [addModelName, addModelLoading, canWrite, editorStrings.feedback.addNewModelCreateFailed, loadModels, models])

  const handleSubmit = useCallback(async () => {
    if (!supabase) return
    if (!canWrite) return

    const parsedIdentifier = Number.parseInt(identifier, 10)
    if (Number.isNaN(parsedIdentifier)) return
    if (modelId === '' || micTypeId === '') return

    setError(null)
    setLoading(true)

    try {
      const payload = {
        identifier: parsedIdentifier,
        model: modelId,
        mic_type: micTypeId,
      }

      if (isEditMode && micId) {
        const { error: updateError } = await supabase
          .from('microphone')
          .update(payload)
          .eq('id', micId)

        if (updateError) throw updateError
      } else {
        const { error: createError } = await supabase
          .from('microphone')
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
  }, [canWrite, close, editorStrings.feedback.createFailed, editorStrings.feedback.updateFailed, identifier, isEditMode, micId, micTypeId, modelId, onSaved])

  const modal = useMemo(() => {
    if (!isOpen) return null

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditMode ? editorStrings.titleEdit : editorStrings.titleCreate}
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
              <h3 style={{ margin: '0 0 6px 0' }}>{isEditMode ? editorStrings.titleEdit : editorStrings.titleCreate}</h3>
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
            <label htmlFor="mic-editor-identifier" style={{ textAlign: 'left' }}>
              {editorStrings.fields.identifier}
            </label>

            <input
              id="mic-editor-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              type="number"
              required
              placeholder={editorStrings.fields.identifier}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 10,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            />

            <label htmlFor="mic-editor-model" style={{ textAlign: 'left' }}>
              {editorStrings.fields.modelName}
            </label>

            <div>
              <select
                id="mic-editor-model"
                value={modelId}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'add-new-model') {
                    setAddModelOpen(true)
                    setAddModelName('')
                    setAddModelError(null)
                    return
                  }

                  const parsed = Number.parseInt(v, 10)
                  setModelId(Number.isNaN(parsed) ? '' : parsed)
                }}
                disabled={loading || modelsLoading}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              >
                <option value="">{editorStrings.fields.modelName}</option>

                {modelsLoading ? (
                  <option value="" disabled>
                    {editorStrings.feedback.loadingModels}
                  </option>
                ) : models.length === 0 ? (
                  <option value="" disabled>
                    {editorStrings.feedback.noModels}
                  </option>
                ) : (
                  models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))
                )}

                <option value="add-new-model">{editorStrings.feedback.addNewModel}</option>
              </select>

              {modelsError ? (
                <div style={{ color: 'crimson', marginTop: 6, fontSize: 13 }}>
                  <strong>{messages.auth.feedback.error}</strong> {modelsError}
                </div>
              ) : null}
            </div>

            <label htmlFor="mic-editor-mic-type" style={{ textAlign: 'left' }}>
              {editorStrings.fields.micTypeName}
            </label>

            <select
              id="mic-editor-mic-type"
              value={micTypeId}
              onChange={(e) => {
                const v = e.target.value
                const parsed = Number.parseInt(v, 10)
                setMicTypeId(Number.isNaN(parsed) ? '' : parsed)
              }}
              disabled={loading || micTypesLoading}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 10,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              <option value="">{editorStrings.fields.micTypeName}</option>

              {micTypesLoading ? (
                <option value="" disabled>
                  {editorStrings.feedback.loadingMicTypes}
                </option>
              ) : micTypeChoices.length === 0 ? (
                <option value="" disabled>
                  {editorStrings.feedback.noMicTypes}
                </option>
              ) : (
                micTypeChoices.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>

            {micTypesError ? (
              <div style={{ color: 'crimson', marginTop: 6, fontSize: 13 }}>
                <strong>{messages.auth.feedback.error}</strong> {micTypesError}
              </div>
            ) : null}

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

          {addModelOpen ? (
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
                padding: 16,
                zIndex: 60,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) createModelModalClose()
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
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0' }}>{addNewModelDialogStrings.title}</h3>
                    <p style={{ margin: 0, color: 'var(--text)' }}>{addNewModelDialogStrings.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={createModelModalClose}
                    aria-label={messages.menu.close}
                    disabled={addModelLoading}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text)',
                      cursor: addModelLoading ? 'not-allowed' : 'pointer',
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
                    void handleAddModel()
                  }}
                  style={{ display: 'grid', gap: 10, marginTop: 14 }}
                >
                  <label htmlFor="mic-editor-add-model-name" style={{ textAlign: 'left' }}>
                    {addNewModelDialogStrings.fields.modelName}
                  </label>
                  <input
                    id="mic-editor-add-model-name"
                    value={addModelName}
                    onChange={(e) => setAddModelName(e.target.value)}
                    type="text"
                    required
                    placeholder={addNewModelDialogStrings.fields.modelName}
                    disabled={addModelLoading}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: 10,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                    }}
                  />

                  {addModelError ? (
                    <div style={{ color: 'crimson' }}>
                      <strong>{messages.auth.feedback.error}</strong> {addModelError}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={createModelModalClose}
                      disabled={addModelLoading}
                      style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
                    >
                      {addNewModelDialogStrings.actions.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={addModelLoading || !addModelName.trim()}
                      style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
                    >
                      {addModelLoading ? addNewModelDialogStrings.feedback.submitting : addNewModelDialogStrings.actions.save}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }, [
    addModelLoading,
    addModelName,
    addModelOpen,
    addModelError,
    addNewModelDialogStrings,
    canWrite,
    close,
    createModelModalClose,
    editorStrings,
    error,
    handleAddModel,
    handleSubmit,
    identifier,
    isEditMode,
    loading,
    messages,
    micTypeChoices,
    micTypeId,
    micTypesError,
    micTypesLoading,
    modelId,
    models,
    modelsError,
    modelsLoading,
    onClose,
    onSaved,
    reset,
    submitDisabled,
  ])

  return modal
}

