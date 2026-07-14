import { useEffect, useMemo, useState, useCallback } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import BaseEditor from './BaseEditor'
import DeleteConfirmation from './DeleteConfirmation'


type BaseRow = {
  base_id: number
  base_identifier: number
  max_mic_count: number
  latest_location_id: number | null
  latest_location_name: string | null
  model_names: string // comma-delimited, already sorted; never null
}


type BasePanelProps = {
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


type LocationChoice = {
  id: number
  name: string
}

export default function BasePanel({ messages, canWrite }: BasePanelProps) {
  const [baseEditorOpen, setBaseEditorOpen] = useState(false)
  const [editingBaseId, setEditingBaseId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BaseRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveDialogLoading, setMoveDialogLoading] = useState(false)
  const [moveBaseId, setMoveBaseId] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name?: string | null } | null>(null)
  const [moveLocationId, setMoveLocationId] = useState<number | ''>('')
  const [moveLocationChoices, setMoveLocationChoices] = useState<LocationChoice[]>([])

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
    setMoveDialogLoading(false)
    setMoveBaseId(null)
    setMoveLocationId('')

    setMoveLocationChoices([])
  }, [])

  const loadMoveChoices = useCallback(async (baseRow: BaseRow) => {
    if (!supabase) {
      return
    }

    setMoveDialogLoading(true)

    try {
      // Candidate locations are all locations except the one the base was most recently moved to.
      const latestName = baseRow.latest_location_name

      const { data: locations, error: locationsError } = await supabase
        .from('location')
        .select('id, name')
        .order('id', { ascending: true })

      if (locationsError) throw locationsError

      const mapped: LocationChoice[] = (locations ?? [])
        .map((l) => ({ id: l.id as number, name: l.name as string }))
        .filter((l) => (latestName ? l.name !== latestName : true))

      // Ensure no duplicates and sort alphabetically by location name.
      const seen = new Set<number>()
      const unique = mapped.filter((l) => {
        if (seen.has(l.id)) return false
        seen.add(l.id)
        return true
      })

      unique.sort((a, b) => a.name.localeCompare(b.name))

      setMoveLocationChoices(unique)

    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bases.feedback.loadFailed
      setError(msg)
    } finally {
      setMoveDialogLoading(false)
    }
  }, [messages.bases.feedback.loadFailed])


  const loadBases = useCallback(async () => {
    if (!supabase) {
      return
    }

    const dash = '—'

    setError(null)
    setLoading(true)

    try {
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
    setMoveLocationId('')

    setMoveLocationChoices([])

    void loadMoveChoices(row)
  }

  function cancelMoveDialog() {
    resetMoveDialog()
  }

  async function confirmMoveBase() {
    console.log('confirmMoveBase', { moveBaseId, moveLocationId })
    if (!supabase) {
      return
    }

    if (!canWrite) {
      return
    }

    if (!moveBaseId) {
      return
    }

    const locationId = typeof moveLocationId === 'number' ? moveLocationId : Number.parseInt(String(moveLocationId), 10)
    if (Number.isNaN(locationId)) {
      return
    }

    setError(null)
    setMoveDialogLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const userId = session?.user?.id
      if (!userId) {
        throw new Error(messages.microphones.feedback.authRequired)
      }

      const payload = {
        base: moveBaseId,
        location: locationId,
        user: userId,
      }

      const { error: createError } = await supabase.from('movement').insert(payload)
      if (createError) throw createError

      resetMoveDialog()
      await loadBases()
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bases.feedback.loadFailed
      setError(msg)
    } finally {
      setMoveDialogLoading(false)
    }
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
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--table-header-bg)',
                      padding: '8px 6px',
                    }}
                  >
                    {messages.bases.table.maxMicCount}
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

                  <tr key={row.base_id}>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.base_identifier}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.max_mic_count}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.model_names}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.latest_location_name ?? ''}</td>
                    {canWrite ? (

                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => openMoveDialog(row)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.bases.actions.move}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
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
                            onClick={() => {
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
                  id: deleteTarget.base_id,
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

      {moveDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            background: 'var(--card)',
            textAlign: 'left',
          }}
        >

          <h4 style={{ margin: '0 0 10px' }}>{messages.bases.dialogs.moveBase.title}</h4>

          {moveBaseId !== null ? (
            <div style={{ marginBottom: 10, opacity: 0.9 }}>
              {rows.find((r) => r.base_id === moveBaseId)?.base_identifier ?? ''}
            </div>
          ) : null}

          <select
            value={moveLocationId}

            onChange={(e) => {
              const value = e.target.value
              setMoveLocationId(value === '' ? '' : Number.parseInt(value, 10))
            }}
            disabled={moveDialogLoading || moveLocationChoices.length === 0}

            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
              marginTop: 10,
            }}
          >
            <option value="">{messages.bases.dialogs.moveBase.searchLabel}</option>
            {moveLocationChoices.length === 0 ? (
              <option value="" disabled>
                {messages.bases.dialogs.moveBase.empty}
              </option>
            ) : (
              moveLocationChoices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}

          </select>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              type="button"
              onClick={confirmMoveBase}
              disabled={moveDialogLoading || moveLocationId === ''}
              title={messages.bases.dialogs.moveBase.moveDisabledReason}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.bases.actions.move}
            </button>
            <button
              type="button"
              onClick={cancelMoveDialog}
              disabled={moveDialogLoading}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.bases.actions.cancelMove}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
