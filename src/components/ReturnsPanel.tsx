import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import DeleteConfirmation, { type DeleteEntityDescriptor } from './DeleteConfirmation'
import EntityMover from './EntityMover'
import type { BulkSelectionAction } from './bulkMove/types'

type ReturnRow = {
  item_type: string
  item_id: number
  item_identifier: number | null
  item_name: string | null
  return_date: string | null
  location_name: string | null
  room_name: string | null
}

type ReturnsPanelProps = {
  messages: Messages
  canWrite: boolean
  // Display label per item_type returned by get_upcoming_returns_loc_room()
  itemTypeLabels: Record<string, string>
  selectionActions?: BulkSelectionAction[]
}

type SelectionMap = Record<string, boolean>
type SortColumn = 'identifier' | 'name' | 'room_name'
type SortDirection = 'asc' | 'desc'
type SortState = {
  column: SortColumn
  direction: SortDirection
}

const NO_ACTIONS: BulkSelectionAction[] = []

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateOnly(value: string | null): string {
  const date = parseDateOnly(value)
  if (!date) return ''
  return date.toLocaleDateString([], { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function isDueOrOverdue(value: string | null): boolean {
  const date = parseDateOnly(value)
  if (!date) return false
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return date.getTime() <= today.getTime()
}

function SortIcon({ active, sortDirection }: { active: boolean; sortDirection: SortDirection }) {
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

const thStyle = {
  cursor: 'pointer',
  userSelect: 'none',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--table-header-bg)',
  padding: '8px 6px',
  whiteSpace: 'nowrap',
} as const

export default function ReturnsPanel({
  messages,
  canWrite,
  itemTypeLabels,
  selectionActions = NO_ACTIONS,
}: ReturnsPanelProps) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [selection, setSelection] = useState<SelectionMap>({})
  const [error, setError] = useState<string | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [actionDialogLoading, setActionDialogLoading] = useState(false)
  const [sortStates, setSortStates] = useState<Record<string, SortState>>({})
  const [pendingAction, setPendingAction] = useState<{
    action: BulkSelectionAction
    ids: number[]
    entities: DeleteEntityDescriptor[]
  } | null>(null)

  const loadReturns = useCallback(async () => {
    if (!supabase) return

    setError(null)
    setLoading(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('get_upcoming_returns_loc_room')
      if (rpcError) throw rpcError
      if (!data) throw new Error('No data returned from get_upcoming_returns_loc_room()')

      setRows(data as ReturnRow[])
      setSelection({})
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.returns.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [messages.returns.feedback.loadFailed])

  useEffect(() => {
    if (!supabase) return

    let active = true

    ;(async () => {
      await supabase.auth.getSession()
      if (!active) return
      await loadReturns()
    })()

    return () => {
      active = false
    }
  }, [loadReturns])

  function toggleSort(groupKey: string, column: SortColumn) {
    setSortStates((previous) => {
      const current = previous[groupKey]
      const direction: SortDirection =
        current?.column === column && current.direction === 'asc' ? 'desc' : 'asc'
      return { ...previous, [groupKey]: { column, direction } }
    })
  }

  function compareRows(a: ReturnRow, b: ReturnRow, sortState: SortState): number {
    let result: number
    if (sortState.column === 'identifier') {
      result = (a.item_identifier ?? 0) - (b.item_identifier ?? 0)
    } else if (sortState.column === 'name') {
      result = (a.item_name ?? '').localeCompare(b.item_name ?? '')
    } else {
      result = (a.room_name ?? '').localeCompare(b.room_name ?? '')
    }
    return result * (sortState.direction === 'asc' ? 1 : -1)
  }

  const columns: { key: SortColumn; label: string }[] = [
    { key: 'identifier', label: messages.returns.table.identifier },
    { key: 'name', label: messages.returns.table.name },
    { key: 'room_name', label: messages.returns.table.room },
  ]

  const returnGroups = useMemo(() => {
    const groups = new Map<string, { locationName: string; returnDate: string | null; rows: ReturnRow[] }>()
    for (const row of rows) {
      const locationName = row.location_name ?? ''
      const groupKey = JSON.stringify([locationName, row.return_date])
      const group = groups.get(groupKey)
      if (group) {
        group.rows.push(row)
      } else {
        groups.set(groupKey, { locationName, returnDate: row.return_date, rows: [row] })
      }
    }
    return Array.from(groups.values())
  }, [rows])

  const selectionCount = useMemo(() => Object.values(selection).filter(Boolean).length, [selection])

  const selectedItems = useMemo(() => {
    return Object.entries(selection)
      .filter(([, isSelected]) => isSelected)
      .map(([key]) => {
        const [entityType, entityId] = key.split('-')
        return { entityType, entityId: Number.parseInt(entityId, 10) }
      })
  }, [selection])

  const availableAction = useMemo(() => {
    if (!canWrite || selectedItems.length === 0) return null
    return (
      selectionActions.find((action) => selectedItems.every((item) => item.entityType === action.itemType)) ?? null
    )
  }, [canWrite, selectedItems, selectionActions])

  function keyForRow(row: ReturnRow): string {
    return `${row.item_type}-${row.item_id}`
  }

  function toggleRow(key: string) {
    setSelection((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  function toggleLocation(locationRows: ReturnRow[], checked: boolean) {
    setSelection((previous) => {
      const next = { ...previous }
      for (const row of locationRows) next[keyForRow(row)] = checked
      return next
    })
  }

  function isLocationFullySelected(locationRows: ReturnRow[]): boolean {
    return locationRows.length > 0 && locationRows.every((row) => selection[keyForRow(row)])
  }

  function isLocationPartiallySelected(locationRows: ReturnRow[]): boolean {
    return locationRows.some((row) => selection[keyForRow(row)]) && !isLocationFullySelected(locationRows)
  }

  async function handleActionClick(action: BulkSelectionAction) {
    if (!canWrite) return
    const ids = selectedItems.filter((item) => item.entityType === action.itemType).map((item) => item.entityId)
    if (ids.length === 0) return

    setError(null)
    setActionDialogLoading(true)

    try {
      const entities = await action.prepare(ids)
      setPendingAction({ action, ids, entities })
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.bulkMove.feedback.loadFailed)
    } finally {
      setActionDialogLoading(false)
    }
  }

  async function confirmPendingAction() {
    if (!canWrite || !pendingAction) return
    const { action, ids } = pendingAction

    setError(null)
    setActionDialogLoading(true)

    try {
      await action.execute(ids)
      setPendingAction(null)
      setSelection({})
      await loadReturns()
    } catch (e) {
      setError(e instanceof Error ? e.message : action.failedMessage)
    } finally {
      setActionDialogLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0, marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>{messages.returns.title}</h2>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 2, textAlign: 'left' }}>
        {rows.length === 0 ? (
          <div>{loading ? messages.menu.loading : messages.returns.table.empty}</div>
        ) : (
          returnGroups.map((group) => {
            const fullySelected = isLocationFullySelected(group.rows)
            const partiallySelected = isLocationPartiallySelected(group.rows)
            const groupTitle = `${group.locationName} — ${formatDateOnly(group.returnDate)}`
            const groupKey = JSON.stringify([group.locationName, group.returnDate])
            const sortState: SortState = sortStates[groupKey] ?? { column: 'room_name', direction: 'asc' }
            const displayRows = [...group.rows].sort((a, b) => compareRows(a, b, sortState))

            return (
              <div
                key={groupKey}
                style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--table-header-bg)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={fullySelected}
                    ref={(element) => {
                      if (element) element.indeterminate = partiallySelected && !fullySelected
                    }}
                    onChange={(event) => toggleLocation(group.rows, event.target.checked)}
                    aria-label={`${messages.bulkMove.selectAllLabel} - ${groupTitle}`}
                  />
                  <strong>{groupTitle}</strong>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: 40, cursor: 'default' }} />
                        {columns.map((col) => (
                          <th key={col.key} onClick={() => toggleSort(groupKey, col.key)} style={thStyle}>
                            {col.label}
                            <SortIcon
                              active={sortState.column === col.key}
                              sortDirection={sortState.direction}
                            />
                          </th>
                        ))}
                        <th style={{ ...thStyle, cursor: 'default' }}>{messages.returns.table.returnDate}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row) => {
                        const key = keyForRow(row)
                        const cellStyle = { borderBottom: '1px solid var(--border)', padding: '8px 6px' }
                        return (
                          <tr
                            key={key}
                            onClick={() => toggleRow(key)}
                            style={{ cursor: 'pointer', ...(isDueOrOverdue(row.return_date) ? { color: 'red' } : {}) }}
                          >
                            <td style={{ ...cellStyle, textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!!selection[key]}
                                onChange={() => toggleRow(key)}
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`${messages.returns.table.identifier}: ${row.item_identifier ?? ''}`}
                              />
                            </td>
                            <td style={cellStyle}>{row.item_identifier ?? ''}</td>
                            <td style={cellStyle}>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{itemTypeLabels[row.item_type] ?? row.item_type}</div>
                              <div>{row.item_name ?? ''}</div>
                            </td>
                            <td style={cellStyle}>{row.room_name ?? ''}</td>
                            <td style={cellStyle}>{formatDateOnly(row.return_date)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>

      {canWrite && selectionCount > 0 ? (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: '12px 0',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border)',
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--muted)' }}>
            {messages.bulkMove.selectedCount
              .replace('{count}', String(selectionCount))
              .replace(/\{plural\}/g, selectionCount === 1 ? '' : 's')}
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {availableAction ? (
              <button
                type="button"
                onClick={() => void handleActionClick(availableAction)}
                disabled={actionDialogLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: 6,
                  cursor: actionDialogLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {availableAction.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setMoveDialogOpen(true)}
              style={{ padding: '10px 18px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
            >
              {messages.bulkMove.moveButton}
            </button>
          </div>
        </div>
      ) : null}

      <EntityMover
        messages={messages}
        canWrite={canWrite}
        open={moveDialogOpen}
        items={selectedItems}
        locationId={null}
        roomId={null}
        dialogStrings={messages.bulkMove.dialogs.moveSelection}
        onClose={() => setMoveDialogOpen(false)}
        onMoved={async () => {
          setMoveDialogOpen(false)
          await loadReturns()
        }}
      />

      <DeleteConfirmation
        open={pendingAction !== null}
        title={pendingAction?.action.dialogTitle ?? ''}
        messagePrefix={pendingAction?.action.dialogMessagePrefix ?? ''}
        entities={pendingAction?.entities ?? []}
        confirmLabel={pendingAction?.action.label ?? ''}
        cancelLabel={messages.deleteConfirmation.actions.cancel}
        loading={actionDialogLoading}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
      />
    </div>
  )
}
