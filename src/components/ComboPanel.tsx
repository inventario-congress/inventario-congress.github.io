import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import DeleteConfirmation from './DeleteConfirmation'
import ComboEditor from './ComboEditor'
import EntityMover from './EntityMover'

type ComboRow = {
  id: number
  identifier: number
  model: string
  latest_location_room: string | null
}

type SortColumn = 'identifier' | 'model' | 'latest_location_room'
type SortDirection = 'asc' | 'desc'

type ComboPanelProps = {
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

export default function ComboPanel({ messages, canWrite }: ComboPanelProps) {
  const [rows, setRows] = useState<ComboRow[]>([])
  const [loading, setLoading] = useState(false)
  const [comboEditorOpen, setComboEditorOpen] = useState(false)
  const [editingComboId, setEditingComboId] = useState<number | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveComboId, setMoveComboId] = useState<number | null>(null)
  const [moveLocationId, setMoveLocationId] = useState<number | null>(null)
  const [moveRoomId, setMoveRoomId] = useState<number | null>(null)

  const SORT_STORAGE_KEY = 'inventario_congress:combos:sort'

  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    try {
      const raw = window.localStorage.getItem(SORT_STORAGE_KEY)
      if (!raw) return 'identifier'
      const parsed = JSON.parse(raw) as { sortColumn?: unknown; sortDirection?: unknown }
      const candidate = parsed.sortColumn
      if (candidate === 'identifier' || candidate === 'model' || candidate === 'latest_location_room') return candidate
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

  const loadCombos = useCallback(async () => {
    if (!supabase) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: loadError } = await supabase
        .rpc('get_combos_with_latest_location_room')

      if (loadError) throw loadError

      setRows((data ?? []) as ComboRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.combos.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [messages.combos.feedback.loadFailed])

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

      await loadCombos()
    })()

    return () => {
      active = false
    }
  }, [loadCombos])

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

  function startEdit(row: ComboRow) {
    if (!canWrite) return
    setEditingComboId(row.id)
    setComboEditorOpen(true)
  }

  async function deleteCombo(id: number) {
    if (!supabase || !canWrite) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase.from('combo').delete().eq('id', id)
      if (deleteError) throw deleteError

      await loadCombos()
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.combos.feedback.deleteFailed)
    } finally {
      setLoading(false)
    }
  }

  const resetMoveDialog = useCallback(() => {
    setMoveDialogOpen(false)
    setMoveComboId(null)
    setMoveLocationId(null)
    setMoveRoomId(null)
  }, [])

  function openMoveDialog(row: ComboRow) {
    if (!canWrite) return
    setError(null)
    setMoveDialogOpen(true)
    setMoveComboId(row.id)
    setMoveLocationId(null)
    setMoveRoomId(null)
  }

  function cancelMoveDialog() {
    resetMoveDialog()
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>{messages.combos.title}</h2>

        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              setEditingComboId(null)
              setComboEditorOpen(true)
            }}
            aria-label={messages.combos.actions.create}
            title={messages.combos.actions.create}
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
          await deleteCombo(id)
        }}
      />

      <ComboEditor
        messages={messages}
        canWrite={canWrite}
        isOpen={comboEditorOpen}
        comboId={editingComboId}
        onClose={() => {
          setComboEditorOpen(false)
          setEditingComboId(null)
        }}
        onSaved={async () => {
          setError(null)
          setComboEditorOpen(false)
          setEditingComboId(null)
          await loadCombos()
        }}
      />

      <EntityMover
        messages={messages}
        canWrite={canWrite}
        open={moveDialogOpen}
        entityId={moveComboId}
        entityType="combo"
        locationId={moveLocationId}
        roomId={moveRoomId}
        dialogStrings={messages.combos.dialogs.moveCombo}
        onClose={() => cancelMoveDialog()}
        onMoved={async () => {
          setError(null)
          await loadCombos()
        }}
      />

      {error ? (
        <div style={{ color: 'crimson', marginBottom: 10 }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 24, textAlign: 'left' }}>
      {rows.length === 0 ? (
        <div>{messages.combos.table.empty}</div>
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
                  {messages.combos.table.identifier}
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
                  {messages.combos.table.model}
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
                  {messages.combos.table.latestLocationRoom}
                  <SortIcon active={sortColumn === 'latest_location_room'} sortDirection={sortDirection} />
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
                    {messages.combos.table.actions}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.identifier}</td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.model}</td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.latest_location_room ?? ''}</td>
                  {canWrite ? (
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => openMoveDialog(row)}
                          disabled={loading}
                          style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          {messages.combos.actions.move}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={loading}
                          style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          {messages.combos.actions.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget({ id: row.id, name: `${row.identifier}` })
                            setDeleteDialogOpen(true)
                          }}
                          disabled={loading}
                          style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          {messages.combos.actions.delete}
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
