import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import DeleteConfirmation from './DeleteConfirmation'
import MicEditor from './MicEditor'



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

function SortIcon({ active, sortDirection }: { active: boolean; sortDirection: 'asc' | 'desc' }) {
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

export default function MicrophonesPanel({ messages, canWrite }: MicrophonesPanelProps) {

  const [micEditorOpen, setMicEditorOpen] = useState(false)
  const [editingMicId, setEditingMicId] = useState<number | null>(null)

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
  void status

  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [attachDialogLoading, setAttachDialogLoading] = useState(false)
  const [attachBaseChoices, setAttachBaseChoices] = useState<Array<{ id: number; label: string }>>([])
  const [attachBaseId, setAttachBaseId] = useState('')
  const [attachForMicrophone, setAttachForMicrophone] = useState<MicrophoneRow | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number
    identifier: number
    name: string
  } | null>(null)


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
      // Fetch microphones using RPC get_mics(), which returns the same fields as MicrophoneRow
      const { data: mappedRows, error: rpcError } = await supabase.rpc('get_mics')
      if (rpcError) throw rpcError
      if (!mappedRows) throw new Error('No data returned from get_mics RPC')

      // Stable baseline ordering; `sortedRows` applies actual sort.
      mappedRows.sort((a: MicrophoneRow, b: MicrophoneRow) => {
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

  function startEdit(row: MicrophoneRow) {
    if (!canWrite) return
    setEditingMicId(row.id)
    setMicEditorOpen(true)
  }

  function startCreate() {
    if (!canWrite) return
    setEditingMicId(null)
    setMicEditorOpen(true)
  }

  function cancelEditor() {
    setMicEditorOpen(false)
    setEditingMicId(null)
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

      // MicEditor handles editor closing; keep delete logic independent.
      // (No inline mic editor state remains here.)

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


  return (

      <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <h2 style={{ marginTop: 24 }}>{messages.microphones.title}</h2>

      <DeleteConfirmation
        open={deleteDialogOpen}
        title={messages.deleteConfirmation.title}
        messagePrefix={messages.deleteConfirmation.messagePrefix}
        entities={
          deleteTarget
            ? [
                {
                  id: deleteTarget.id,
                  identifier: deleteTarget.identifier,
                  // Use the model name as secondary label: "identifier (model)"
                  secondary: deleteTarget.name,
                },
              ]
            : []
        }
        confirmLabel={messages.deleteConfirmation.actions.confirm}
        cancelLabel={messages.deleteConfirmation.actions.cancel}
        loading={loading}
        onCancel={() => {
          setDeleteDialogOpen(false)
          setDeleteTarget(null)
        }}
        onConfirm={async () => {
          if (!deleteTarget) return
          const id = deleteTarget.id
          setDeleteDialogOpen(false)
          setDeleteTarget(null)
          await deleteMicrophone(id)
        }}
      />


      {canWrite ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
          <div style={{ marginTop: 6 }} />
          <button
            type="button"
            onClick={startCreate}
            aria-label={messages.microphones.actions.create}
            title={messages.microphones.actions.create}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              lineHeight: 1,
              padding: 0,
            }}
            disabled={loading}
          >
            +
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 12, textAlign: 'left' }}>{messages.microphones.readOnly}</div>
      )}

      <MicEditor
        messages={messages}
        canWrite={canWrite}
        isOpen={micEditorOpen}
        micId={editingMicId}
        onClose={cancelEditor}
        onSaved={async () => {
          setError(null)
          setStatus(null)
          setMicEditorOpen(false)
          setEditingMicId(null)
          await loadMicrophones()
        }}
      />


      {error ? (
        <div style={{ marginTop: 12, color: 'crimson', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 24, textAlign: 'left' }}>
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
                      background: 'var(--table-header-bg)',
                      padding: '8px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {messages.microphones.table.identifier}
                    <SortIcon active={sortColumn === 'identifier'} sortDirection={sortDirection} />
                  </th>

                  <th
                    onClick={() => toggleSort('modelName')}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--table-header-bg)',
                      padding: '8px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {messages.microphones.table.modelName}
                    <SortIcon active={sortColumn === 'modelName'} sortDirection={sortDirection} />
                  </th>

                  <th
                    onClick={() => toggleSort('micTypeName')}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--table-header-bg)',
                      padding: '8px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {messages.microphones.table.micTypeName}
                    <SortIcon active={sortColumn === 'micTypeName'} sortDirection={sortDirection} />
                  </th>

                  <th
                    onClick={() => toggleSort('latestAttachmentBase')}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--table-header-bg)',
                      padding: '8px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {messages.microphones.table.latestAttachmentBase}
                    <SortIcon active={sortColumn === 'latestAttachmentBase'} sortDirection={sortDirection} />
                  </th>

                  {canWrite ? (
                    <th
                      style={{
                        textAlign: 'left',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--table-header-bg)',
                        padding: '8px 6px',
                      }}
                    >
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
                            onClick={() => {
                              setDeleteTarget({ id: row.id, identifier: row.identifier, name: row.modelName })
                              setDeleteDialogOpen(true)
                            }}
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

