import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import DeleteConfirmation from './DeleteConfirmation'
import MicAttacher from './MicAttacher'
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

function TriangleIcon({
  isOpen,
}: {
  isOpen: boolean
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 16,
        textAlign: 'center',
        marginRight: 8,
        color: 'var(--muted)',
        transition: 'transform 120ms ease',
        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        userSelect: 'none',
      }}
    >
      ▶
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
  const [attachForMicrophone, setAttachForMicrophone] = useState<MicrophoneRow | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number
    identifier: number
    name: string
  } | null>(null)

  const [detachDialogOpen, setDetachDialogOpen] = useState(false)
  const [detachTarget, setDetachTarget] = useState<{
    id: number
    identifier: number
    base: number
  } | null>(null)

  const [expandedMicRowId, setExpandedMicRowId] = useState<number | null>(null)

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

  function attachMicrophone(row: MicrophoneRow) {
    if (!supabase) return
    if (!canWrite) return

    setError(null)
    setStatus(null)
    setAttachForMicrophone(row)
    setAttachDialogOpen(true)
  }

  async function detachMicrophone() {
    if (!supabase) return
    if (!canWrite) return
    if (!detachTarget) return

    setError(null)
    setStatus(null)
    setLoading(true)

    try {
      // Find the active attachment for this microphone
      const { data: attachment, error: findError } = await supabase
        .from('attachment')
        .select('id')
        .eq('microphone', detachTarget.id)
        .eq('is_active', true)
        .maybeSingle()

      if (findError) throw findError
      if (!attachment) throw new Error('No active attachment found')

      // Deactivate it
      const { error: updateError } = await supabase
        .from('attachment')
        .update({ is_active: false })
        .eq('id', attachment.id)

      if (updateError) throw updateError

      setDetachDialogOpen(false)
      setDetachTarget(null)
      await loadMicrophones()
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.microphones.feedback.deleteFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
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

      <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>{messages.microphones.title}</h2>

        {canWrite ? (
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
        ) : null}
      </div>

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

      <DeleteConfirmation
        open={detachDialogOpen}
        title={messages.microphones.dialogs.detachConfirmation.title}
        messagePrefix={`${messages.microphones.actions.detach} N°${detachTarget?.identifier ?? ''} de la base ${detachTarget?.base ?? ''}`}
        entities={[]}
        confirmLabel={messages.microphones.actions.detach}
        cancelLabel={messages.deleteConfirmation.actions.cancel}
        loading={loading}
        confirmDisabled={false}
        onCancel={() => {
          setDetachDialogOpen(false)
          setDetachTarget(null)
        }}
        onConfirm={async () => {
          await detachMicrophone()
        }}
      />

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

      <MicAttacher
        key={attachDialogOpen ? `attach-${attachForMicrophone?.id}` : 'closed'}
        messages={messages}
        canWrite={canWrite}
        open={attachDialogOpen}
        microphone={attachForMicrophone}
        onClose={() => {
          setAttachDialogOpen(false)
          setAttachForMicrophone(null)
        }}
        onAttached={async () => {
          await loadMicrophones()
        }}
      />

      <div style={{ marginTop: 24, textAlign: 'left' }}>
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
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      style={{ cursor: canWrite ? 'pointer' : undefined }}
                      onClick={() => {
                        if (!canWrite) return
                        const nextExpanded = expandedMicRowId === row.id ? null : row.id
                        setExpandedMicRowId(nextExpanded)
                      }}
                    >
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        {canWrite ? <TriangleIcon isOpen={expandedMicRowId === row.id} /> : null}
                        {row.identifier}
                      </td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.modelName}</td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.micTypeName}</td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        {row.latestAttachmentBase ? row.latestAttachmentBase : null}
                      </td>
                    </tr>

                    {canWrite ? (
                      <tr>
                        <td
                          colSpan={4}
                          style={{ padding: 0, borderBottom: '1px solid var(--border)' }}
                        >
                          <div
                            style={{
                              overflow: 'hidden',
                              transition: 'max-height 120ms ease, opacity 120ms ease, transform 120ms ease',
                              maxHeight: expandedMicRowId === row.id ? 200 : 0,
                              opacity: expandedMicRowId === row.id ? 1 : 0,
                              transform: expandedMicRowId === row.id ? 'translateY(0px)' : 'translateY(-4px)',
                              pointerEvents: expandedMicRowId === row.id ? 'auto' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 6px 16px 6px' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  attachMicrophone(row)
                                }}
                                disabled={loading}
                                style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                              >
                                {messages.microphones.actions.attach}
                              </button>
                              {row.latestAttachmentBase != null ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDetachTarget({ id: row.id, identifier: row.identifier, base: row.latestAttachmentBase! })
                                    setDetachDialogOpen(true)
                                  }}
                                  disabled={loading}
                                  style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                                >
                                  {messages.microphones.actions.detach}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEdit(row)
                                }}
                                disabled={loading}
                                style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                              >
                                {messages.microphones.actions.edit}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteTarget({ id: row.id, identifier: row.identifier, name: row.modelName })
                                  setDeleteDialogOpen(true)
                                }}
                                disabled={loading}
                                style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                              >
                                {messages.microphones.actions.delete}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
