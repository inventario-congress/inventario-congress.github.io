import { useEffect, useState, useCallback } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type MicrophoneRow = {
  id: number
  identifier: number
  modelId: number
  modelName: string
  micTypeId: number | null
  micTypeName: string
  latestAttachmentBase: number | null
}



type MicrophonesPanelProps = {
  messages: Messages
  canWrite: boolean
}

export default function MicrophonesPanel({ messages, canWrite }: MicrophonesPanelProps) {
  const [modelName, setModelName] = useState('')
  const [micTypeName, setMicTypeName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const [micTypeChoices, setMicTypeChoices] = useState<string[]>([])



  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<MicrophoneRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [attachDialogLoading, setAttachDialogLoading] = useState(false)
  const [attachBaseChoices, setAttachBaseChoices] = useState<Array<{ id: number; label: string }>>([])
  const [attachBaseId, setAttachBaseId] = useState('')
  const [attachForMicrophone, setAttachForMicrophone] = useState<MicrophoneRow | null>(null)

  const loadMicrophones = useCallback(async () => {
    if (!supabase) {
      return
    }

    setError(null)
    setLoading(true)

    try {
      const [{ data: microphones, error: microphonesError }, { data: micTypes, error: micTypesError }] = await Promise.all([
        supabase
          .from('microphone')
          .select('id, identifier, model, mic_type')
          .order('id', { ascending: false }),
        supabase.from('mic_type').select('id, name').order('name', { ascending: true }),
      ])

      if (microphonesError) throw microphonesError
      if (micTypesError) throw micTypesError

      const micTypeNames = Array.from(
        new Set((micTypes ?? []).map((t) => (t.name as string) ?? '')),
      ).filter(Boolean)
      setMicTypeChoices(micTypeNames)

      const modelIds = Array.from(
        new Set((microphones ?? []).map((microphone) => microphone.model as number)),
      )


      let modelMap = new Map<number, string>()

      if (modelIds.length > 0) {
        const { data: models, error: modelsError } = await supabase
          .from('model')
          .select('id, name')
          .in('id', modelIds)

        if (modelsError) throw modelsError

        modelMap = new Map(
          (models ?? []).map((model) => [model.id as number, model.name as string]),
        )
      }

      const micTypeMap = new Map<number, string>((micTypes ?? []).map((t) => [t.id as number, t.name as string]))

      const mappedRows: MicrophoneRow[] = (microphones ?? []).map((microphone) => ({
        id: microphone.id as number,
        identifier: microphone.identifier as number,
        modelId: microphone.model as number,
        modelName: modelMap.get(microphone.model as number) ?? '',
        micTypeId: microphone.mic_type ? (microphone.mic_type as number) : null,
        micTypeName: microphone.mic_type
          ? micTypeMap.get(microphone.mic_type as number) ?? ''
          : '',
        latestAttachmentBase: null, // Placeholder for the latest attachment base
      }))
      // Populate the latestAttachmentBase for each microphone
      for (const row of mappedRows) {
          const { data: attachments, error: attachmentsError } = await supabase
              .from('attachment')
              .select('base:base(identifier)')
              .eq('microphone', row.id)
              .order('created_at', { ascending: false })
              .limit(1)

          if (attachmentsError) {
              console.error('Error fetching latest attachment:', attachmentsError)
          } else {
              // Get the base identifier for the latest attachment
              const baseIdentifier = (attachments?.[0] as { base?: { identifier?: number | null } } | undefined)?.base?.identifier ?? null
              row.latestAttachmentBase = baseIdentifier
          }


      }

      // Sort the rows by model name, then by identifier
      mappedRows.sort((a, b) => {
        const modelNameComparison = a.modelName.localeCompare(b.modelName)
        if (modelNameComparison !== 0) {
          return modelNameComparison
        }
        return a.identifier - b.identifier
      })

      setRows(mappedRows)
      setStatus(messages.microphones.feedback.loaded)

    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.microphones.feedback.loadFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [messages.microphones.feedback.loaded, messages.microphones.feedback.loadFailed])

  useEffect(() => {
    if (!supabase) {
      return
    }

    let active = true

    ;(async () => {
      await supabase.auth.getSession()

      if (!active) {
        return
      }

      await loadMicrophones()
    })()

    return () => {
      active = false
    }
  }, [loadMicrophones])

  async function ensureModelId(name: string): Promise<number> {
    if (!supabase) {
      throw new Error(messages.microphones.feedback.authRequired)
    }

    const trimmed = name.trim()

    const { data, error } = await supabase
      .from('model')
      .upsert({ name: trimmed }, { onConflict: 'name' })
      .select('id')
      .single()

    if (error || !data?.id) {
      throw error ?? new Error(messages.microphones.feedback.createFailed)
    }

    return data.id as number
  }

  async function ensureMicTypeId(name: string): Promise<number> {
    if (!supabase) {
      throw new Error(messages.microphones.feedback.authRequired)
    }

    const trimmed = name.trim()

    const { data, error } = await supabase
      .from('mic_type')
      .upsert({ name: trimmed }, { onConflict: 'name' })
      .select('id')
      .single()

    if (error || !data?.id) {
      throw error ?? new Error(messages.microphones.feedback.createFailed)
    }

    return data.id as number
  }


  async function handleSubmit() {
    if (!supabase) {
      return
    }

    if (!canWrite) {
      return
    }

    const trimmedName = modelName.trim()
    const trimmedMicTypeName = micTypeName.trim()
    const parsedIdentifier = Number.parseInt(identifier, 10)

    if (!trimmedName || !trimmedMicTypeName || Number.isNaN(parsedIdentifier)) {
      return
    }


    setError(null)
    setStatus(null)
    setLoading(true)

    try {
      const resolvedModelId = await ensureModelId(trimmedName)
      const resolvedMicTypeId = await ensureMicTypeId(trimmedMicTypeName)

      const microphonePayload = {
        identifier: parsedIdentifier,
        model: resolvedModelId,
        mic_type: resolvedMicTypeId,
      }



      if (editingId === null) {
        const { error } = await supabase.from('microphone').insert(microphonePayload)

        if (error) throw error

        setStatus(messages.microphones.feedback.created)
      } else {
        const { error } = await supabase
          .from('microphone')
          .update(microphonePayload)
          .eq('id', editingId)

        if (error) throw error

        setStatus(messages.microphones.feedback.updated)
      }

      setModelName('')
      setMicTypeName('')
      setIdentifier('')
      setEditingId(null)
      await loadMicrophones()

    } catch (e) {
      const fallback = editingId === null ? messages.microphones.feedback.createFailed : messages.microphones.feedback.updateFailed
      const msg = e instanceof Error ? e.message : fallback
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(row: MicrophoneRow) {
    setEditingId(row.id)
    setModelName(row.modelName)
    setMicTypeName(row.micTypeName)
    setIdentifier(String(row.identifier))
    setError(null)
    setStatus(null)
  }


  function cancelEdit() {
    setEditingId(null)
    setModelName('')
    setMicTypeName('')
    setIdentifier('')
  }


  async function deleteMicrophone(id: number) {
    if (!supabase) {
      return
    }

    if (!canWrite) {
      return
    }

    setError(null)
    setStatus(null)
    setLoading(true)

    try {
      const { error } = await supabase.from('microphone').delete().eq('id', id)
      if (error) throw error

      if (editingId === id) {
        cancelEdit()
      }

      setStatus(messages.microphones.feedback.deleted)
      await loadMicrophones()
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.microphones.feedback.deleteFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function attachMicrophone(row: MicrophoneRow) {

    if (!supabase) {
      return
    }

    if (!canWrite) {
      return
    }

    setError(null)
    setStatus(null)
    setAttachDialogOpen(true)
    setAttachForMicrophone(row)
    setAttachBaseChoices([])
    setAttachBaseId('')

    setAttachDialogLoading(true)

    try {
      // Find bases compatible with this microphone's model.
      // Filter out bases the microphone is already attached to.
      const micId = row.id
      const modelId = row.modelId

      // 1) Fetch current attachments for this microphone
      const { data: currentAttachments, error: attachmentsError } = await supabase
        .from('attachment')
        .select('base')
        .eq('microphone', micId)

      if (attachmentsError) throw attachmentsError

      const alreadyAttachedBaseIds = new Set<number>(
        (currentAttachments ?? []).map((a) => (a.base as number) ?? -1).filter((n) => n !== -1),
      )

      // 2) Fetch candidate base ids from base_mic_models for this model
      const { data: baseMicModelRows, error: baseMicModelsError } = await supabase
        .from('base_mic_models')
        .select('base')
        .eq('model', modelId)

      if (baseMicModelsError) throw baseMicModelsError

      const candidateBaseIds = Array.from(
        new Set(
          (baseMicModelRows ?? [])
            .map((r) => (r.base as number) ?? -1)
            .filter((n) => n !== -1)
            .filter((baseId) => !alreadyAttachedBaseIds.has(baseId)),
        ),
      )

      if (candidateBaseIds.length === 0) {
        setAttachBaseChoices([])
        setAttachBaseId('')
        setError(null)
        setStatus(messages.microphones.feedback.loadFailed)
        return
      }

      // 3) Fetch base labels for the dropdown
      const { data: bases, error: basesError } = await supabase
        .from('base')
        .select('id, identifier')
        .in('id', candidateBaseIds)

      if (basesError) throw basesError

      const mapped = (bases ?? [])
        .map((b) => ({ id: b.id as number, label: String(b.identifier) }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))

      setAttachBaseChoices(mapped)
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.microphones.feedback.loadFailed
      setError(msg)
    } finally {
      setAttachDialogLoading(false)
    }
  }

  async function confirmAttach() {
    if (!supabase) {
      return
    }
    if (!canWrite) {
      return
    }
    if (!attachForMicrophone) {
      return
    }

    const baseId = Number.parseInt(attachBaseId, 10)
    const microphoneId = attachForMicrophone.id

    if (Number.isNaN(baseId)) {
      return
    }

    setError(null)
    setStatus(null)
    setAttachDialogLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const userId = session?.user?.id
      if (!userId) {
        throw new Error(messages.microphones.feedback.authRequired)
      }

      const payload = {
        base: baseId,
        microphone: microphoneId,
        user: userId,
      }

      const { error: createError } = await supabase.from('attachment').insert(payload)
      if (createError) throw createError

      setStatus(messages.attachments.feedback.created)


      setAttachDialogOpen(false)
      setAttachForMicrophone(null)
      setAttachBaseChoices([])
      setAttachBaseId('')

      await loadMicrophones()
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.attachments.feedback.createFailed
      setError(msg)
    } finally {
      setAttachDialogLoading(false)
    }
  }

  function cancelAttachDialog() {
    setAttachDialogOpen(false)
    setAttachForMicrophone(null)
    setAttachBaseChoices([])
    setAttachBaseId('')
  }


  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <h2 style={{ marginTop: 24 }}>{messages.microphones.title}</h2>

      {canWrite ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>

          <label htmlFor="microphone-identifier" style={{ textAlign: 'left' }}>
            {messages.microphones.fields.identifier}
          </label>
          <input
            id="microphone-identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            type="number"
            required
            placeholder={messages.microphones.fields.identifier}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />

          <label htmlFor="microphone-model-name" style={{ textAlign: 'left' }}>
            {messages.microphones.fields.modelName}
          </label>
          <input
            id="microphone-model-name"
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
            type="text"
            required
            placeholder={messages.microphones.fields.modelName}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />

          <label htmlFor="microphone-mic-type" style={{ textAlign: 'left' }}>
            {messages.microphones.fields.micTypeName}
          </label>
          <select
            id="microphone-mic-type"
            value={micTypeName}
            onChange={(event) => setMicTypeName(event.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          >
            <option value="">{messages.microphones.fields.micTypeName}</option>
            {micTypeChoices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>

          <label htmlFor="microphone-mic-type-new" style={{ textAlign: 'left', marginTop: 6 }}>
            {messages.microphones.fields.micTypeName}
          </label>
          {/* <input
            id="microphone-mic-type-new"
            value={micTypeName}
            onChange={(event) => setMicTypeName(event.target.value)}
            type="text"
            required
            placeholder={messages.microphones.fields.micTypeName}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
              marginTop: 8,
            }}
          /> */}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !modelName.trim() || !micTypeName.trim() || !identifier.trim()}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {editingId === null ? messages.microphones.actions.create : messages.microphones.actions.update}
            </button>


            {editingId !== null ? (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={loading}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {messages.microphones.actions.cancelEdit}
              </button>
            ) : null}

            <button
              type="button"
              onClick={loadMicrophones}
              disabled={loading}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.microphones.actions.refresh}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, textAlign: 'left' }}>
          {messages.microphones.readOnly}
        </div>
      )}
      {!canWrite ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <button
            type="button"
            onClick={loadMicrophones}
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.microphones.actions.refresh}
          </button>
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      {status ? (
        <div style={{ marginTop: 12, color: 'green', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.status}</strong> {status}
        </div>
      ) : null}

      <div style={{ marginTop: 24, textAlign: 'left' }}>
        <h3 style={{ margin: '0 0 10px' }}>{messages.microphones.table.title}</h3>

        {attachDialogOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              background: 'var(--card)',
            }}
          >
            <h4 style={{ margin: '0 0 10px' }}>{messages.microphones.actions.attach}</h4>

            {attachForMicrophone ? (
              <div style={{ marginBottom: 10, opacity: 0.9 }}>
                {attachForMicrophone.modelName} #{attachForMicrophone.identifier}
              </div>
            ) : null}

            <label htmlFor="attach-base" style={{ textAlign: 'left' }}>
              {messages.attachments.fields.selectBase}
            </label>
            <select
              id="attach-base"
              value={attachBaseId}
              onChange={(event) => setAttachBaseId(event.target.value)}
              disabled={attachDialogLoading}
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
              {attachBaseChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <button
                type="button"
                onClick={confirmAttach}
                disabled={attachDialogLoading || !attachBaseId}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {messages.microphones.actions.attach}
              </button>
              <button
                type="button"
                onClick={cancelAttachDialog}
                disabled={attachDialogLoading}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {messages.microphones.actions.cancelEdit}
              </button>
            </div>
          </div>
        ) : null}


        {rows.length === 0 ? (
          <div>{messages.microphones.table.empty}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.microphones.table.identifier}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.microphones.table.modelName}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.microphones.table.micTypeName}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.microphones.table.latestAttachmentBase}
                  </th>
                  {canWrite ? (
                    <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {messages.microphones.table.actions}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.identifier}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.modelName}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.micTypeName}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        {row.latestAttachmentBase ? ( <>{row.latestAttachmentBase}</> ) : null}
                    </td>
                    {canWrite ? (
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => attachMicrophone(row)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.microphones.actions.attach}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.microphones.actions.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMicrophone(row.id)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.microphones.actions.delete}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
