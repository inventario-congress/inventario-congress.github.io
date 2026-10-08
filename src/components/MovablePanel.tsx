import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import DeleteConfirmation from './DeleteConfirmation'
import MovableEditor from './MovableEditor'
import EntityMover from './EntityMover'
import type { ExtraColumn, ExtraField, MovableRow, MovableStrings, MoveDialogStrings } from './movable/types'

const BUILT_IN_SORT_COLUMNS = ['identifier', 'model', 'latest_location_room', 'latest_return_date']

type SortColumn = string
type SortDirection = 'asc' | 'desc'

type MovablePanelProps<T extends MovableRow> = {
  // Table / movement column name. Treated as opaque.
  type: string
  // Db function returning rows that satisfy MovableRow (plus any extra fields).
  rpcName: string
  rpcArgs?: Record<string, unknown>
  strings: MovableStrings
  moveDialogStrings: MoveDialogStrings
  // Pass stable (module-level or memoized) arrays.
  extraColumns?: ExtraColumn<T>[]
  extraFields?: ExtraField[]
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

function TriangleIcon({ isOpen }: { isOpen: boolean }) {
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

function formatDateOnly(value: string | null): string {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString([], { year: 'numeric', month: 'numeric', day: 'numeric' })
}

const NO_EXTRA_COLUMNS: ExtraColumn<never>[] = []

export default function MovablePanel<T extends MovableRow>({
  type,
  rpcName,
  rpcArgs,
  strings,
  moveDialogStrings,
  extraColumns = NO_EXTRA_COLUMNS as ExtraColumn<T>[],
  extraFields,
  messages,
  canWrite,
}: MovablePanelProps<T>) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [movableEditorOpen, setMovableEditorOpen] = useState(false)
  const [editingMovableId, setEditingMovableId] = useState<number | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [expandedMovableRowId, setExpandedMovableRowId] = useState<number | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveMovableId, setMoveMovableId] = useState<number | null>(null)
  const [moveLocationId, setMoveLocationId] = useState<number | null>(null)
  const [moveRoomId, setMoveRoomId] = useState<number | null>(null)
  const [moveReturnDate, setMoveReturnDate] = useState<string | null>(null)

  const SORT_STORAGE_KEY = `inventario_congress:${type}s:sort`

  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    try {
      const raw = window.localStorage.getItem(SORT_STORAGE_KEY)
      if (!raw) return 'identifier'
      const parsed = JSON.parse(raw) as { sortColumn?: unknown; sortDirection?: unknown }
      const candidate = parsed.sortColumn
      if (
        typeof candidate === 'string' &&
        (BUILT_IN_SORT_COLUMNS.includes(candidate) || extraColumns.some((c) => c.key === candidate && c.sortValue))
      ) return candidate
    } catch {
      // ignore
    }
    return 'identifier'
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

  // Serialized so callers can pass inline arg objects without retriggering loads.
  const rpcArgsKey = JSON.stringify(rpcArgs ?? {})

  const loadMovables = useCallback(async () => {
    if (!supabase) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: loadError } = await supabase
        .rpc(rpcName, JSON.parse(rpcArgsKey) as Record<string, unknown>)

      if (loadError) throw loadError

      setRows((data ?? []) as T[])
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [rpcName, rpcArgsKey, strings.feedback.loadFailed])

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

      await loadMovables()
    })()

    return () => {
      active = false
    }
  }, [loadMovables])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    const dirMul = sortDirection === 'asc' ? 1 : -1

    copy.sort((a, b) => {
      switch (sortColumn) {
        case 'identifier':
          return (a.identifier - b.identifier) * dirMul
        case 'model':
          return a.model.localeCompare(b.model) * dirMul
        case 'latest_location_room': {
          const av = a.latest_location_room ?? ''
          const bv = b.latest_location_room ?? ''
          return av.localeCompare(bv) * dirMul
        }
        case 'latest_return_date': {
          if (a.latest_return_date === null && b.latest_return_date === null) return 0
          if (a.latest_return_date === null) return 1
          if (b.latest_return_date === null) return -1
          return a.latest_return_date.localeCompare(b.latest_return_date) * dirMul
        }
        default: {
          const sortValue = extraColumns.find((c) => c.key === sortColumn)?.sortValue
          if (!sortValue) return 0
          const av = sortValue(a)
          const bv = sortValue(b)
          if (av === null && bv === null) return 0
          if (av === null) return 1
          if (bv === null) return -1
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dirMul
          return String(av).localeCompare(String(bv)) * dirMul
        }
      }
    })

    return copy
  }, [extraColumns, rows, sortColumn, sortDirection])

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

  function startEdit(row: T) {
    if (!canWrite) return
    setEditingMovableId(row.id)
    setMovableEditorOpen(true)
  }

  async function deleteMovable(id: number) {
    if (!supabase || !canWrite) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase.from(type).delete().eq('id', id)
      if (deleteError) throw deleteError

      await loadMovables()
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.feedback.deleteFailed)
    } finally {
      setLoading(false)
    }
  }

  const resetMoveDialog = useCallback(() => {
    setMoveDialogOpen(false)
    setMoveMovableId(null)
    setMoveLocationId(null)
    setMoveRoomId(null)
    setMoveReturnDate(null)
  }, [])

  function openMoveDialog(row: T) {
    if (!canWrite) return
    setError(null)
    setMoveDialogOpen(true)
    setMoveMovableId(row.id)
    setMoveLocationId(row.latest_location_id)
    setMoveRoomId(row.latest_room_id)
    setMoveReturnDate(row.latest_return_date)
  }

  function cancelMoveDialog() {
    resetMoveDialog()
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0, marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>{strings.title}</h2>

        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              setEditingMovableId(null)
              setMovableEditorOpen(true)
            }}
            aria-label={strings.actions.create}
            title={strings.actions.create}
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
                  name: deleteTarget.name,
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
          await deleteMovable(id)
        }}
      />

      <MovableEditor
        type={type}
        strings={strings}
        extraFields={extraFields}
        messages={messages}
        canWrite={canWrite}
        isOpen={movableEditorOpen}
        movableId={editingMovableId}
        onClose={() => {
          setMovableEditorOpen(false)
          setEditingMovableId(null)
        }}
        onSaved={async () => {
          setError(null)
          setMovableEditorOpen(false)
          setEditingMovableId(null)
          await loadMovables()
        }}
      />

      <EntityMover
        messages={messages}
        canWrite={canWrite}
        open={moveDialogOpen}
        entityId={moveMovableId}
        entityType={type}
        locationId={moveLocationId}
        roomId={moveRoomId}
        latestReturnDate={moveReturnDate}
        dialogStrings={moveDialogStrings}
        onClose={() => cancelMoveDialog()}
        onMoved={async () => {
          setError(null)
          await loadMovables()
        }}
      />

      {error ? (
        <div style={{ color: 'crimson', marginBottom: 10 }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 2, textAlign: 'left' }}>
      {rows.length === 0 ? (
        <div>{strings.table.empty}</div>
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
                  {strings.table.identifier}
                  <SortIcon active={sortColumn === 'identifier'} sortDirection={sortDirection} />
                </th>
                <th
                  onClick={() => toggleSort('model')}
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
                  {strings.table.model}
                  <SortIcon active={sortColumn === 'model'} sortDirection={sortDirection} />
                </th>
                <th
                  onClick={() => toggleSort('latest_location_room')}
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
                  {strings.table.latestLocationRoom}
                  <SortIcon active={sortColumn === 'latest_location_room'} sortDirection={sortDirection} />
                </th>
                <th
                  onClick={() => toggleSort('latest_return_date')}
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
                  {strings.table.latestReturnDate}
                  <SortIcon active={sortColumn === 'latest_return_date'} sortDirection={sortDirection} />
                </th>
                {extraColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={col.sortValue ? () => toggleSort(col.key) : undefined}
                    style={{
                      cursor: col.sortValue ? 'pointer' : undefined,
                      userSelect: 'none',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--table-header-bg)',
                      padding: '8px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.header}
                    {col.sortValue ? <SortIcon active={sortColumn === col.key} sortDirection={sortDirection} /> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    style={{ cursor: canWrite ? 'pointer' : undefined }}
                    onClick={() => {
                      if (!canWrite) return
                      const nextExpanded = expandedMovableRowId === row.id ? null : row.id
                      setExpandedMovableRowId(nextExpanded)
                    }}
                  >
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {canWrite ? <TriangleIcon isOpen={expandedMovableRowId === row.id} /> : null}
                      {row.identifier}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.model}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.latest_location_room ?? ''}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{formatDateOnly(row.latest_return_date)}</td>
                    {extraColumns.map((col) => (
                      <td key={col.key} style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>

                  {canWrite ? (
                    <tr>
                      <td
                        colSpan={4 + extraColumns.length}
                        style={{ padding: 0, borderBottom: '1px solid var(--border)' }}
                      >
                        <div
                          style={{
                            overflow: 'hidden',
                            transition: 'max-height 120ms ease, opacity 120ms ease, transform 120ms ease',
                            maxHeight: expandedMovableRowId === row.id ? 200 : 0,
                            opacity: expandedMovableRowId === row.id ? 1 : 0,
                            transform: expandedMovableRowId === row.id ? 'translateY(0px)' : 'translateY(-4px)',
                            pointerEvents: expandedMovableRowId === row.id ? 'auto' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 6px 16px 6px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openMoveDialog(row)
                              }}
                              disabled={loading}
                              style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                            >
                              {strings.actions.move}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                startEdit(row)
                              }}
                              disabled={loading}
                              style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                            >
                              {strings.actions.edit}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTarget({ id: row.id, name: `${row.identifier}` })
                                setDeleteDialogOpen(true)
                              }}
                              disabled={loading}
                              style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                            >
                              {strings.actions.delete}
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
