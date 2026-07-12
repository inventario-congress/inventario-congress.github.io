import { useCallback, useEffect, useMemo, useState } from 'react'
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

type SortColumn = 'identifier' | 'modelName' | 'micTypeName' | 'latestAttachmentBase'

type SortDirection = 'asc' | 'desc'

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

  const SORT_STORAGE_KEY = 'inventario_congress:microphones:sort'

  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    try {
      const raw = window.localStorage.getItem(SORT_STORAGE_KEY)
      if (!raw) return 'modelName'
      const parsed = JSON.parse(raw) as { sortColumn?: unknown; sortDirection?: unknown }
      const candidate = parsed.sortColumn
      if (
        candidate === 'identifier' ||
        candidate === 'modelName' ||
        candidate === 'micTypeName' ||
        candidate === 'latestAttachmentBase'
      ) {
        return candidate
      }
    } catch {
      // ignore
    }
    return 'modelName'
  })

  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    try {
      const raw = window.localStorage.getItem(SORT_STORAGE_KEY)
      if (!raw) return 'asc'
      const parsed = JSON.parse(raw) as { sortColumn?: unknown; sortDirection?: unknown }
      const candidate = parsed.sortDirection
      if (candidate === 'asc' || candidate === 'desc') return candidate
    } catch {
      // ignore
    }
    return 'asc'
  })

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<MicrophoneRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [attachDialogLoading, setAttachDialogLoading] = useState(false)
  const [attachBaseChoices, setAttachBaseChoices] = useState<Array<{ id: number; label: string }>>([])
  const [attachBaseId, setAttachBaseId] = useState('')
  const [attachForMicrophone, setAttachForMicrophone] = useState<MicrophoneRow | null>(null)

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    const dirMul = sortDirection === 'asc' ? 1 : -1

    copy.sort((a, b) => {
      switch (sortColumn) {
        case 'identifier':
          return (a.identifier - b.identifier) * dirMul
        case 'modelName':
          return a.modelName.localeCompare(b.modelName) * dirMul
        case 'micTypeName':
          return a.micTypeName.localeCompare(b.micTypeName) * dirMul
        case 'latestAttachmentBase': {
          const av = a.latestAttachmentBase ?? -Infinity
          const bv = b.latestAttachmentBase ?? -Infinity
          if (av === bv) return 0
          return (av - bv) * dirMul
        }
        default:
          return 0
      }
    })

    return copy
  }, [rows, sortColumn, sortDirection])

  const loadMicrophones = useCallback(async () => {
    if (!supabase) return

    setError(null)
    setLoading(true)

    try {
      const [{ data: microphones, error: microphonesError }, { data: micTypes, error: micTypesError }] =
        await Promise.all([
          supabase
            .from('microphone')
            .select('id, identifier, model, mic_type')
            .order('id', { ascending: false }),
          supabase.from('mic_type').select('id, name').order('name', { ascending: true }),
        ])

      if (microphonesError) throw microphonesError
      if (micTypesError) throw micTypesError

      const micTypeNames = Array.from(new Set((micTypes ?? []).map((t) => (t.name as string) ?? ''))).filter(Boolean)
      setMicTypeChoices(micTypeNames)

      const modelIds = Array.from(new Set((microphones ?? []).map((microphone) => microphone.model as number)))

      let modelMap = new Map<number, string>()
      if (modelIds.length > 0) {
        const { data: models, error: modelsError } = await supabase.from('model').select('id, name').in('id', modelIds)
        if (modelsError) throw modelsError
        modelMap = new Map((models ?? []).map((model) => [model.id as number, model.name as string]))
      }

      const micTypeMap = new Map<number, string>((micTypes ?? []).map((t) => [t.id as number, t.name as string]))

      const mappedRows: MicrophoneRow[] = (microphones ?? []).map((microphone) => ({
        id: microphone.id as number,
        identifier: microphone.identifier as number,
        modelId: microphone.model as number,
        modelName: modelMap.get(microphone.model as number) ?? '',
        micTypeId: microphone.mic_type ? (microphone.mic_type as number) : null,
        micTypeName: microphone.mic_type ? micTypeMap.get(microphone.mic_type as number) ?? '' : '',
        latestAttachmentBase: null,
      }))

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
          const baseIdentifier =
            (attachments?.[0] as { base?: { identifier?: number | null } } | undefined)?.base?.identifier ?? null
          row.latestAttachmentBase = baseIdentifier
        }
      }

      // Stable baseline ordering; `sortedRows` applies actual sort.
      mappedRows.sort((a, b) => {
        const modelNameComparison = a.modelName.localeCompare(b.modelName)
        if (modelNameComparison !== 0) return modelNameComparison
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
    if (!supabase) return

    let active = true

    ;(async () => {
      await supabase.auth.getSession()
      if (!active) return
      await loadMicrophones()
    })()

    return () => {
      active = false
    }
  }, [loadMicrophones])

  async function ensureModelId(name: string): Promise<number> {
    if (!supabase) throw new Error(messages.microphones.feedback.authRequired)
    const trimmed = name.trim()

    const { data, error } = await supabase
      .from('model')
      .upsert({ name: trimmed }, { onConflict: 'name' })
      .select('id')
      .single()

    if (error || !data?.id) throw error ?? new Error(messages.microphones.feedback.createFailed)
    return data.id as number
  }

  async function ensureMicTypeId(name: string): Promise<number> {
    if (!supabase) throw new Error(messages.microphones.feedback.authRequired)
    const trimmed = name.trim()

    const { data, error } = await supabase
      .from('mic_type')
      .upsert({ name: trimmed }, { onConflict: 'name' })
      .select('id')
      .single()

    if (error || !data?.id) throw error ?? new Error(messages.microphones.feedback.createFailed)
    return data.id as number
  }

  async function handleSubmit() {
    if (!supabase) return
    if (!canWrite) return

    const trimmedName = modelName.trim()
    const trimmedMicTypeName = micTypeName.trim()
    const parsedIdentifier = Number.parseInt(identifier, 10)

    if (!trimmedName || !trimmedMicTypeName || Number.isNaN(parsedIdentifier)) return

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
        const { error } = await supabase.from('microphone').update(microphonePayload).eq('id', editingId)
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
    if (!supabase) return
    if (!canWrite) return

    setError(null)
    setStatus(null)
    setLoading(true)

    try {
      const { error } = await supabase.from('microphone').delete().eq('id', id)
      if (error) throw error

      if (editingId === id) cancelEdit()

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
    if (!supabase) return
    if (!canWrite) return

    setError(null)
    setStatus(null)
    setAttachDialogOpen(true)
    setAttachForMicrophone(row)
    setAttachBaseChoices([])
    setAttachBaseId('')
    setAttachDialogLoading(true)

    try {
      const micId = row.id
      const modelId = row.modelId

      const { data: currentAttachments, error: attachmentsError } = await supabase
        .from('attachment')
        .select('base')
        .eq('microphone', micId)

      if (attachmentsError) throw attachmentsError

      const alreadyAttachedBaseIds = new Set<number>(
        (currentAttachments ?? []).map((a) => (a.base as number) ?? -1).filter((n) => n !== -1),
      )

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
    if (!supabase) return
    if (!canWrite) return
    if (!attachForMicrophone) return

    const baseId = Number.parseInt(attachBaseId, 10)
    const microphoneId = attachForMicrophone.id

    if (Number.isNaN(baseId)) return

    setError(null)
    setStatus(null)
    setAttachDialogLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const userId = session?.user?.id
      if (!userId) throw new Error(messages.microphones.feedback.authRequired)

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

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      const next: SortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(next)
      window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ sortColumn: column, sortDirection: next }))
    } else {
      const next: SortDirection = 'asc'
      setSortColumn(column)
      setSortDirection(next)
      window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ sortColumn: column, sortDirection: next }))
    }
  }

  function SortIcon({ active }: { active: boolean }) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 14,
          textAlign: 'center',
          marginLeft: 6,
          transform: active && sortDirection === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 120ms ease',
          visibility: active ? 'visible' : 'hidden',
        }}
      >
        ▼
      </span>
    )
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
        <div style={{ marginTop: 12, textAlign: 'left' }}>{messages.microphones.readOnly}</div>
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
                  <th
                    onClick={() => toggleSort('identifier')}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      padding: '8px 6px',
                      opacity: sortColumn === 'identifier' ? 1 : 0.9,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {messages.microphones.table.identifier}
                    <SortIcon active={sortColumn === 'identifier'} />
                  </th>

                  <th
                    onClick={() => toggleSort('modelName')}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      padding: '8px 6px',
                      opacity: sortColumn === 'modelName' ? 1 : 0.9,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {messages.microphones.table.modelName}
                    <SortIcon active={sortColumn === 'modelName'} />
                  </th>

                  <th
                    onClick={() => toggleSort('micTypeName')}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      padding: '8px 6px',
                      opacity: sortColumn === 'micTypeName' ? 1 : 0.9,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {messages.microphones.table.micTypeName}
                    <SortIcon active={sortColumn === 'micTypeName'} />
                  </th>

                  <th
                    onClick={() => toggleSort('latestAttachmentBase')}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      padding: '8px 6px',
                      opacity: sortColumn === 'latestAttachmentBase' ? 1 : 0.9,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {messages.microphones.table.latestAttachmentBase}
                    <SortIcon active={sortColumn === 'latestAttachmentBase'} />
                  </th>

                  {canWrite ? (
                    <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {messages.microphones.table.actions}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.identifier}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.modelName}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.micTypeName}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {row.latestAttachmentBase ? row.latestAttachmentBase : null}
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

