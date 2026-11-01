import { useEffect, useMemo, useState, useCallback, Fragment } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import BaseEditor from './BaseEditor'
import BaseActionBar from './BaseActionBar'
import BaseMicAttacher from './BaseMicAttacher'
import DeleteConfirmation, { type DeleteEntityDescriptor } from './DeleteConfirmation'
import EntityMover from './EntityMover'
import MicrophoneTable from './MicrophoneTable'
import { sortMicrophones, type MicAttachment, type MicSortColumn } from './microphoneSorting'
import SortIcon from './SortIcon'
import { createDetachMicrophonesAction } from './bulkMove/detachMicrophonesAction'

type BaseRow = {
  base_id: number
  base_identifier: number
  mic_count: number
  max_mic_count: number
  latest_location_id: number | null
  latest_location_name: string | null
  latest_room_id: number | null
  latest_return_date: string | null
  model_names: string // comma-delimited, already sorted; never null
}

function parseDateOrNull(value: string | null): number | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getTime()
}

function compareNullableDates(a: string | null, b: string | null, dirMul: number): number {
  const at = parseDateOrNull(a)
  const bt = parseDateOrNull(b)

  if (at === null && bt === null) return 0
  if (at === null) return 1 * dirMul
  if (bt === null) return -1 * dirMul

  return (at - bt) * dirMul
}

type BasePanelProps = {
  messages: Messages
  canWrite: boolean
}

type SortColumn = 'base_identifier' | 'latest_location_name' | 'latest_return_date' | 'model_names'

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

// Helper for sorting logic
function useSortableState<T>(
  storageKey: string,
  allowedColumns: readonly T[],
  defaultColumn: T,
  defaultDirection: 'asc' | 'desc',
  storageFields: { sortColumn: string; sortDirection: string } = {
    sortColumn: 'sortColumn',
    sortDirection: 'sortDirection',
  }
) {
  const [sortColumn, setSortColumn] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return defaultColumn
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const candidate = parsed[storageFields.sortColumn] ?? parsed.sortColumn
      return allowedColumns.find((column) => column === candidate) ?? defaultColumn
    } catch {
      return defaultColumn
    }
  })

  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return defaultDirection
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const candidate = parsed[storageFields.sortDirection] ?? parsed.sortDirection
      if (candidate === 'asc' || candidate === 'desc') return candidate
    } catch {
      return defaultDirection
    }
    return defaultDirection
  })

  const toggleSort = useCallback((column: T) => {
    if (sortColumn === column) {
      const next: 'asc' | 'desc' = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(next)
      window.localStorage.setItem(storageKey, JSON.stringify({
        [storageFields.sortColumn]: column,
        [storageFields.sortDirection]: next,
      }))
    } else {
      const next: 'asc' | 'desc' = 'asc'
      setSortColumn(column)
      setSortDirection(next)
      window.localStorage.setItem(storageKey, JSON.stringify({
        [storageFields.sortColumn]: column,
        [storageFields.sortDirection]: next,
      }))
    }
  }, [sortColumn, sortDirection, storageFields, storageKey])

  return { sortColumn, sortDirection, toggleSort }
}

export default function BasePanel({ messages, canWrite }: BasePanelProps) {
  const detachAction = useMemo(() => createDetachMicrophonesAction(messages), [messages])
  const [detachAllTarget, setDetachAllTarget] = useState<{ baseId: number; entities: DeleteEntityDescriptor[] } | null>(null)
  const [baseEditorOpen, setBaseEditorOpen] = useState(false)
  const [editingBaseId, setEditingBaseId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BaseRow[]>([])
  const [micsByBaseId, setMicsByBaseId] = useState<Record<number, MicAttachment[]>>({})
  const [loadingMicsByBaseId, setLoadingMicsByBaseId] = useState<Record<number, boolean>>({})

  const [error, setError] = useState<string | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveBaseId, setMoveBaseId] = useState<number | null>(null)
  const [moveLocationId, setMoveLocationId] = useState<number | null>(null)
  const [moveRoomId, setMoveRoomId] = useState<number | null>(null)
  const [moveReturnDate, setMoveReturnDate] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name?: string | null } | null>(null)
  const [expandedBaseRowId, setExpandedBaseRowId] = useState<number | null>(null)
  const [detachDialogOpen, setDetachDialogOpen] = useState(false)
  const [detachTarget, setDetachTarget] = useState<{
    micId: number
    micIdentifier: number
    baseId: number
    baseIdentifier: number
  } | null>(null)
  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [attachBaseRow, setAttachBaseRow] = useState<BaseRow | null>(null)

  const SORT_STORAGE_KEY = 'inventario_congress:bases:sort'
  const MIC_SORT_STORAGE_KEY = 'inventario_congress:base_mics:sort'

  const { sortColumn, sortDirection, toggleSort } = useSortableState<SortColumn>(
    SORT_STORAGE_KEY,
    ['base_identifier', 'latest_location_name', 'latest_return_date', 'model_names'],
    'base_identifier',
    'asc'
  )
  const {
    sortColumn: micSortColumn,
    sortDirection: micSortDirection,
    toggleSort: toggleMicSort
  } = useSortableState<MicSortColumn>(
    MIC_SORT_STORAGE_KEY,
    ['mic_identifier', 'mic_type_name', 'mic_attachment_date', 'mic_attachment_user_name'],
    'mic_identifier',
    'asc',
    { sortColumn: 'micSortColumn', sortDirection: 'micSortDirection' }
  )

  const resetMoveDialog = useCallback(() => {
    setMoveDialogOpen(false)
    setMoveBaseId(null)
    setMoveLocationId(null)
    setMoveRoomId(null)
    setMoveReturnDate(null)
  }, [])

  const loadBases = useCallback(async () => {
    if (!supabase) {
      return
    }

    setError(null)
    setLoading(true)

    try {
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
    setMoveReturnDate(row.latest_return_date)
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

  async function openDetachAll(baseId: number) {
    if (!canWrite) return

    setError(null)
    setLoading(true)

    try {
      const entities = await detachAction.prepare([baseId])
      setDetachAllTarget({ baseId, entities })
    } catch (e) {
      setError(e instanceof Error ? e.message : detachAction.failedMessage)
    } finally {
      setLoading(false)
    }
  }

  async function confirmDetachAll() {
    if (!canWrite || !detachAllTarget) return
    const { baseId } = detachAllTarget

    setError(null)
    setLoading(true)

    try {
      await detachAction.execute([baseId])
      setDetachAllTarget(null)
      await loadMicsForBase(baseId)
    } catch (e) {
      setError(e instanceof Error ? e.message : detachAction.failedMessage)
    } finally {
      setLoading(false)
    }
  }

  async function detachMicrophone() {
    if (!supabase) return
    if (!canWrite) return
    if (!detachTarget) return

    setError(null)
    setLoading(true)

    try {
      const { data: attachment, error: findError } = await supabase
        .from('attachment')
        .select('id')
        .eq('microphone', detachTarget.micId)
        .eq('base', detachTarget.baseId)
        .eq('is_active', true)
        .maybeSingle()

      if (findError) throw findError
      if (!attachment) throw new Error('No active attachment found')

      const { error: updateError } = await supabase
        .from('attachment')
        .update({ is_active: false })
        .eq('id', attachment.id)

      if (updateError) throw updateError

      setDetachDialogOpen(false)
      setDetachTarget(null)
      if (expandedBaseRowId !== null) {
        await loadMicsForBase(expandedBaseRowId)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.microphones.feedback.deleteFailed
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
        case 'latest_return_date':
          return compareNullableDates(a.latest_return_date, b.latest_return_date, dirMul)
        case 'model_names': {
          return a.model_names.localeCompare(b.model_names) * dirMul
        }
        default:
          return 0
      }
    })

    return copy
  }, [rows, sortColumn, sortDirection])

  async function loadMicsForBase(baseId: number) {
    if (!supabase) return
    if (loadingMicsByBaseId[baseId]) return

    setError(null)
    setLoadingMicsByBaseId((prev) => ({ ...prev, [baseId]: true }))

    try {
      const { data, error: rpcError } = await supabase.rpc('get_mics_for_base', { base_id: baseId })
      if (rpcError) throw rpcError

      setMicsByBaseId((prev) => ({ ...prev, [baseId]: (data ?? []) as MicAttachment[] }))
      const newCount = (data ?? []).length
      setRows((prev) => prev.map((row) =>
        row.base_id === baseId ? { ...row, mic_count: newCount } : row
      ))
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bases.feedback.loadFailed
      setError(msg)
    } finally {
      setLoadingMicsByBaseId((prev) => ({ ...prev, [baseId]: false }))
    }
  }

  function formatDateTime(value: string | null): [string, string] {
    if (!value) return ['', '']
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ['', '']
    const datePart = d.toLocaleDateString([], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    const timePart = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    return [datePart, timePart]
  }

  function formatDateOnly(value: string | null): string {
    if (!value) return ''
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString([], { year: 'numeric', month: 'numeric', day: 'numeric' })
  }

  function disableDelete(row: BaseRow): boolean {
    return loading || loadingMicsByBaseId[row.base_id] || getBaseMics(row).length > 0
  }

  function getBaseMics(row: BaseRow): MicAttachment[] {
    const raw = micsByBaseId[row.base_id]
    if (!raw) return []
    if (!Array.isArray(raw)) return []

    return raw
  }

  function renderTableHeader(label: string, column: SortColumn) {
    return (
      <th
        onClick={() => toggleSort(column)}
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
        {label}
        <SortIcon active={sortColumn === column} sortDirection={sortDirection} />
      </th>
    )
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0, marginTop: 0 }}>
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

      <div style={{ marginTop: 2, textAlign: 'left' }}>
        {rows.length === 0 ? (
          <div>{messages.bases.table.empty}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {renderTableHeader(messages.bases.table.identifier, 'base_identifier')}
                  {renderTableHeader(messages.bases.table.micModelNames, 'model_names')}
                  {renderTableHeader(messages.bases.table.latestLocation, 'latest_location_name')}
                  {renderTableHeader(messages.bases.table.latestReturnDate, 'latest_return_date')}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row: BaseRow) => (
                  <Fragment key={row.base_id}>
                    <tr
                      style={{
                        cursor: 'pointer',
                        background: expandedBaseRowId === row.base_id ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : undefined,
                        fontWeight: expandedBaseRowId === row.base_id ? 'bold' : undefined,
                      }}
                      onClick={() => {
                        const nextExpanded = expandedBaseRowId === row.base_id ? null : row.base_id

                        setExpandedBaseRowId(nextExpanded)

                        if (nextExpanded !== null && row.mic_count > 0) {
                          void loadMicsForBase(row.base_id)
                        }
                      }}
                    >
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        <TriangleIcon isOpen={expandedBaseRowId === row.base_id} />
                        {row.base_identifier}
                      </td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.model_names}</td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.latest_location_name ?? ''}</td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{formatDateOnly(row.latest_return_date)}</td>
                    </tr>

                    <tr>
                      <td
                        colSpan={5}
                        style={{ padding: 0, borderBottom: '1px solid var(--border)' }}
                      >
                        <div
                          style={{
                            overflow: 'hidden',
                            border: expandedBaseRowId === row.base_id ? '2px solid var(--accent-border)' : '0px solid transparent',
                            borderRadius: 12,
                            transition: 'max-height 120ms ease, opacity 120ms ease, transform 120ms ease, border 120ms ease',
                            maxHeight: expandedBaseRowId === row.base_id ? 1000 : 0,
                            opacity: expandedBaseRowId === row.base_id ? 1 : 0,
                            transform: expandedBaseRowId === row.base_id ? 'translateY(0px)' : 'translateY(-4px)',
                            pointerEvents: expandedBaseRowId === row.base_id ? 'auto' : 'none',
                          }}
                        >
                          {loadingMicsByBaseId[row.base_id] ? (
                            <div style={{ padding: '10px 6px 14px 6px' }}>
                              {canWrite ? (
                                <BaseActionBar
                                  labels={{
                                    move: messages.bases.actions.move,
                                    detach: messages.microphones.actions.detach,
                                    edit: messages.bases.actions.edit,
                                    delete: messages.bases.actions.delete,
                                  }}
                                  onMove={() => openMoveDialog(row)}
                                  onDetach={() => void openDetachAll(row.base_id)}
                                  onEdit={() => {
                                    setEditingBaseId(row.base_id)
                                    setBaseEditorOpen(true)
                                  }}
                                  onDelete={() => {
                                    setDeleteTarget({ id: row.base_id, name: row.base_identifier.toString() })
                                    setDeleteDialogOpen(true)
                                  }}
                                  moveDisabled={loading}
                                  detachDisabled={loading}
                                  editDisabled={disableDelete(row)}
                                  deleteDisabled={disableDelete(row)}
                                />
                              ) : null}
                              <div style={{ fontSize: 18, color: 'var(--muted)', fontWeight: 'bold' }}>{messages.bases.table.mics}</div>
                              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>{messages.bases.feedback.loading_mics}</div>
                            </div>
                          ) : (
                            (() => {
                              const mics = getBaseMics(row)
                              const maxMicCount = row.max_mic_count ?? 0
                              const availableSlots = Math.max(0, maxMicCount - mics.length)

                              if (maxMicCount <= 0) {
                                return <div style={{ height: 18 }} />
                              }

                              return (
                                <div style={{ padding: '10px 6px 14px 6px' }}>
                                  {canWrite ? (
                                    <BaseActionBar
                                      labels={{
                                        move: messages.bases.actions.move,
                                        detach: messages.microphones.actions.detach,
                                        edit: messages.bases.actions.edit,
                                        delete: messages.bases.actions.delete,
                                      }}
                                      onMove={() => openMoveDialog(row)}
                                      onDetach={() => void openDetachAll(row.base_id)}
                                      onEdit={() => {
                                        setEditingBaseId(row.base_id)
                                        setBaseEditorOpen(true)
                                      }}
                                      onDelete={() => {
                                        setDeleteTarget({ id: row.base_id, name: row.base_identifier.toString() })
                                        setDeleteDialogOpen(true)
                                      }}
                                      moveDisabled={loading}
                                      detachDisabled={loading || mics.length === 0}
                                      editDisabled={disableDelete(row)}
                                      deleteDisabled={disableDelete(row)}
                                    />
                                  ) : null}
                                  <div style={{ fontSize: 18, color: 'var(--muted)', fontWeight: 'bold' }}>{messages.bases.table.mics}</div>
                                  <MicrophoneTable
                                    mics={sortMicrophones(mics, micSortColumn, micSortDirection)}
                                    availableSlots={availableSlots}
                                    canWrite={canWrite}
                                    sortColumn={micSortColumn}
                                    sortDirection={micSortDirection}
                                    labels={{
                                      identifier: messages.bases.table.identifier,
                                      type: messages.bases.table.type,
                                      date: messages.bases.table.date,
                                      user: messages.bases.table.user,
                                      available: messages.bases.table.available,
                                    }}
                                    onSort={toggleMicSort}
                                    onDetach={(mic) => {
                                      setDetachTarget({
                                        micId: mic.mic_id,
                                        micIdentifier: mic.mic_identifier,
                                        baseId: row.base_id,
                                        baseIdentifier: row.base_identifier,
                                      })
                                      setDetachDialogOpen(true)
                                    }}
                                    onAttach={() => {
                                      setAttachBaseRow(row)
                                      setAttachDialogOpen(true)
                                    }}
                                    formatDateTime={formatDateTime}
                                  />
                                </div>
                              )
                            })()
                          )}
                        </div>
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

      <DeleteConfirmation
        open={detachDialogOpen}
        title={messages.microphones.dialogs.detachConfirmation.title}
        messagePrefix={
            messages.deleteConfirmation.detachConfirmation.replace(
                '{micIdentifier}', '' + (detachTarget?.micIdentifier ?? '')
            ).replace(
                '{baseIdentifier}', '' + (detachTarget?.baseIdentifier ?? '')
            )
        }
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

      <DeleteConfirmation
        open={detachAllTarget !== null}
        title={detachAction.dialogTitle}
        messagePrefix={detachAction.dialogMessagePrefix}
        entities={detachAllTarget?.entities ?? []}
        confirmLabel={messages.microphones.actions.detach}
        cancelLabel={messages.deleteConfirmation.actions.cancel}
        loading={loading}
        confirmDisabled={false}
        onCancel={() => setDetachAllTarget(null)}
        onConfirm={confirmDetachAll}
      />

      <BaseMicAttacher
        key={attachDialogOpen ? `attach-${attachBaseRow?.base_id}` : 'closed'}
        messages={messages}
        canWrite={canWrite}
        open={attachDialogOpen}
        base={attachBaseRow ? { id: attachBaseRow.base_id, identifier: attachBaseRow.base_identifier } : null}
        onClose={() => {
          setAttachDialogOpen(false)
          setAttachBaseRow(null)
        }}
        onAttached={async () => {
          if (expandedBaseRowId !== null) {
            await loadMicsForBase(expandedBaseRowId)
          }
        }}
      />

      <EntityMover
        messages={messages}
        canWrite={canWrite}
        open={moveDialogOpen}
        entityId={moveBaseId}
        entityType="base"
        locationId={moveLocationId}
        roomId={moveRoomId}
        latestReturnDate={moveReturnDate}
        dialogStrings={messages.bases.dialogs.moveBase}
        detachAction={detachAction}
        onClose={() => cancelMoveDialog()}
        onMoved={async () => {
          setError(null)
          await loadBases()
        }}
      />
    </div>
  )
}
