import { useEffect, useMemo, useState, useCallback, Fragment } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import BaseEditor from './BaseEditor'
import DeleteConfirmation from './DeleteConfirmation'
import BaseMover from './BaseMover'



type BaseRow = {
  base_id: number
  base_identifier: number
  max_mic_count: number
  latest_location_id: number | null
  latest_location_name: string | null
  latest_room_id: number | null
  model_names: string // comma-delimited, already sorted; never null
}


type BasePanelProps = {
  messages: Messages
  canWrite: boolean
}


type MicAttachment = {
  mic_id: number
  mic_identifier: number
  mic_model_name: string
  mic_type_name: string
  mic_attachment_date: string | null
  mic_attachment_user_name: string | null
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




export default function BasePanel({ messages, canWrite }: BasePanelProps) {
  const [baseEditorOpen, setBaseEditorOpen] = useState(false)
  const [editingBaseId, setEditingBaseId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BaseRow[]>([])
  const [micsByBaseId, setMicsByBaseId] = useState<Record<number, MicAttachment[]> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveBaseId, setMoveBaseId] = useState<number | null>(null)
  const [moveLocationId, setMoveLocationId] = useState<number | null>(null)
  const [moveRoomId, setMoveRoomId] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name?: string | null } | null>(null)
  const [expandedBaseRowId, setExpandedBaseRowId] = useState<number | null>(null)



  type SortColumn = 'base_identifier' | 'latest_location_name' | 'model_names'
  type SortDirection = 'asc' | 'desc'

  const SORT_STORAGE_KEY = 'inventario_congress:bases:sort'

  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    try {
      const raw = window.localStorage.getItem(SORT_STORAGE_KEY)
      if (!raw) return 'base_identifier'
      const parsed = JSON.parse(raw) as { sortColumn?: unknown; sortDirection?: unknown }
      const candidate = parsed.sortColumn
      if (candidate === 'base_identifier' || candidate === 'latest_location_name' || candidate === 'model_names') return candidate

    } catch {
      // ignore
    }
    return 'base_identifier'
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



  const resetMoveDialog = useCallback(() => {
    setMoveDialogOpen(false)
    setMoveBaseId(null)
    setMoveLocationId(null)
    setMoveRoomId(null)
  }, [])



  const loadBases = useCallback(async () => {
    if (!supabase) {
      return
    }

    setError(null)
    setLoading(true)

    try {
      // Load the microphones attached to each base from the attachment table using the get_mics_for_bases() function
      const { data: micData, error: micError } = await supabase.rpc('get_mics_for_bases')
      if (micError) {
        throw micError
      }

      if (!micData) {
        // RPC returns '{}' when no microphones are attached to any base.
        setMicsByBaseId({})
      } else {
        // get_mics_for_bases() returns a jsonb object keyed by base_id as string.
        setMicsByBaseId(micData as Record<number, MicAttachment[]>)
      }

      // Load the rows by calling db function get_bases_with_models() to get the base data along with associated mic
      // model names and latest location name. This avoids multiple queries and simplifies the logic.
      await supabase.rpc('get_bases_with_models').then(({ data: rpcData, error: rpcError }) => {
        if (rpcError) {
          throw rpcError
        }

        if (!rpcData) {
          throw new Error('No data returned from get_bases_with_models()')
        }

        setRows(rpcData as BaseRow[])
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bases.feedback.loadFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  // 'messages.bases.feedback.loaded' isn't used inside this callback; remove it to satisfy exhaustive-deps.
  }, [messages.bases.feedback.loadFailed])

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

      await loadBases()
    })()

    return () => {
      active = false
    }
  }, [loadBases])



  function openMoveDialog(row: BaseRow) {
    if (!canWrite) {
      return
    }

    setError(null)
    setMoveDialogOpen(true)
    setMoveBaseId(row.base_id)
    setMoveLocationId(row.latest_location_id)
    setMoveRoomId(row.latest_room_id)
  }


  function cancelMoveDialog() {
    resetMoveDialog()
  }



  async function deleteBase(id: number) {
    if (!supabase) {
      return
    }


    if (!canWrite) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase.from('base').delete().eq('id', id)
      if (deleteError) throw deleteError



      await loadBases()
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bases.feedback.deleteFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    const dirMul = sortDirection === 'asc' ? 1 : -1

    copy.sort((a, b) => {
      switch (sortColumn) {
        case 'base_identifier':
          return (a.base_identifier - b.base_identifier) * dirMul
        case 'latest_location_name': {
          const av = a.latest_location_name ?? ''
          const bv = b.latest_location_name ?? ''
          return av.localeCompare(bv) * dirMul
        }
        case 'model_names': {
          return a.model_names.localeCompare(b.model_names) * dirMul
        }
        default:
          return 0

      }
    })

    return copy
  }, [rows, sortColumn, sortDirection])

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

  function formatDateTime(value: string | null): string {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString()
  }

  function getBaseMics(row: BaseRow): MicAttachment[] {
    if (!micsByBaseId) return []
    const raw = (micsByBaseId as Record<number, MicAttachment[]>)[row.base_id]
    if (!raw) return []
    if (!Array.isArray(raw)) return []

    // The RPC returns an array of microphone attachment objects.
    // At runtime we trust the shape and rely on TypeScript for correctness.
    return raw as MicAttachment[]
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <BaseEditor
        messages={messages}
        canWrite={canWrite}
        isOpen={baseEditorOpen}
        baseId={editingBaseId}
        onClose={() => {
          setBaseEditorOpen(false)
          setEditingBaseId(null)
        }}
        onSaved={async () => {
          setError(null)
          setEditingBaseId(null)
          setBaseEditorOpen(false)
          await loadBases()
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>{messages.bases.title}</h2>

        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              setEditingBaseId(null)
              setBaseEditorOpen(true)
            }}

            aria-label={messages.bases.actions.create}
            title={messages.bases.actions.create}

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

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 24, textAlign: 'left' }}>

        {rows.length === 0 ? (
          <div>{messages.bases.table.empty}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    onClick={() => toggleSort('base_identifier')}
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
                    {messages.bases.table.identifier}
                    <SortIcon active={sortColumn === 'base_identifier'} sortDirection={sortDirection} />
                  </th>
                  <th
                    onClick={() => toggleSort('model_names')}
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
                    {messages.bases.table.micModelNames}
                    <SortIcon active={sortColumn === 'model_names'} sortDirection={sortDirection} />
                  </th>


                  <th
                    onClick={() => toggleSort('latest_location_name')}
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
                    {messages.bases.table.latestLocation}
                    <SortIcon active={sortColumn === 'latest_location_name'} sortDirection={sortDirection} />
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
                      {messages.bases.table.actions}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row: BaseRow) => (
                  <Fragment key={row.base_id}>
                    <tr
                      style={{ cursor: getBaseMics(row).length === 0 ? 'default' : 'pointer' }}
                      onClick={() => {
                        // If there are no microphone attachments for this base, do not allow expansion.
                        if (getBaseMics(row).length === 0) return

                        // Toggle visibility of the spacer row for this base.
                        // Clicking on action buttons should not toggle; those handlers stop propagation.
                        setExpandedBaseRowId((prev) => (prev === row.base_id ? null : row.base_id))
                      }}
                    >
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        {getBaseMics(row).length === 0 ? null : (
                          <TriangleIcon isOpen={expandedBaseRowId === row.base_id} />
                        )}
                        {row.base_identifier}
                      </td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.model_names}</td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.latest_location_name ?? ''}</td>

                      {canWrite ? (
                        <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openMoveDialog(row)
                              }}
                              disabled={loading}
                              style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                            >
                              {messages.bases.actions.move}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingBaseId(row.base_id)
                                setBaseEditorOpen(true)
                              }}
                              disabled={loading}
                              style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                            >
                              {messages.bases.actions.edit}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTarget({ id: row.base_id, name: row.base_identifier.toString() })
                                setDeleteDialogOpen(true)
                              }}
                              disabled={loading}
                              style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                            >
                              {messages.bases.actions.delete}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>

                    <tr
                      style={{ display: expandedBaseRowId === row.base_id ? 'table-row' : 'none' }}
                    >
                      <td colSpan={canWrite ? 4 : 3} style={{ padding: 0, borderBottom: '1px solid var(--border)' }}>
                        {getBaseMics(row).length === 0 ? (
                          <div style={{ height: 18 }} />
                        ) : (
                          <div style={{ padding: '10px 6px 14px 6px' }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{messages.bases.table.mics}</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                              <thead>
                                <tr>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 4px', whiteSpace: 'nowrap' }}>
                                    {messages.bases.table.identifier}
                                  </th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                                    {messages.bases.table.model}
                                  </th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                                    {messages.bases.table.type}
                                  </th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 4px', whiteSpace: 'nowrap' }}>
                                    {messages.bases.table.date}
                                  </th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                                    {messages.bases.table.user}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {getBaseMics(row).map((m) => (
                                  <tr key={m.mic_id}>
                                    <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px', whiteSpace: 'nowrap' }}>
                                      {m.mic_identifier}
                                    </td>
                                    <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                                      {m.mic_model_name}
                                    </td>
                                    <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                                      {m.mic_type_name}
                                    </td>
                                    <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px', whiteSpace: 'nowrap' }}>
                                      {formatDateTime(m.mic_attachment_date)}
                                    </td>
                                    <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                                      {m.mic_attachment_user_name ?? ''}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  name: deleteTarget.name,
                  identifier: (deleteTarget.name ?? '') ? undefined : deleteTarget.id,
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
          await deleteBase(id)
        }}
      />

      <BaseMover
        messages={messages}
        canWrite={canWrite}
        open={moveDialogOpen}
        baseId={moveBaseId}
        locationId={moveLocationId}
        roomId={moveRoomId}
        onClose={() => cancelMoveDialog()}
        onMoved={async () => {
          setError(null)
          await loadBases()
        }}
      />


    </div>
  )
}
