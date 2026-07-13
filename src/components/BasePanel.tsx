import { useEffect, useMemo, useState, useCallback } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import BaseEditor from './BaseEditor'



type BaseRow = {
  id: number
  identifier: number
  maxMicCount: number
  latestLocationName: string | null
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



  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BaseRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveDialogLoading, setMoveDialogLoading] = useState(false)
  const [moveBaseId, setMoveBaseId] = useState<number | null>(null)


  const [moveLocationId, setMoveLocationId] = useState<number | ''>('')
  const [moveLocationChoices, setMoveLocationChoices] = useState<LocationChoice[]>([])

  type SortColumn = 'identifier' | 'latestLocationName'
  type SortDirection = 'asc' | 'desc'

  const SORT_STORAGE_KEY = 'inventario_congress:bases:sort'

  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    try {
      const raw = window.localStorage.getItem(SORT_STORAGE_KEY)
      if (!raw) return 'identifier'
      const parsed = JSON.parse(raw) as { sortColumn?: unknown; sortDirection?: unknown }
      const candidate = parsed.sortColumn
      if (candidate === 'identifier' || candidate === 'latestLocationName') return candidate
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
      const latestName = baseRow.latestLocationName

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


    setError(null)
    setLoading(true)

    try {
      const { data, error: loadError } = await supabase
        .from('base')
        .select('id, identifier, max_mic_count')
        .order('id', { ascending: false })

      if (loadError) throw loadError

      const baseRows: BaseRow[] = (data ?? []).map((entry) => ({
        id: entry.id as number,
        identifier: entry.identifier as number,
        maxMicCount: entry.max_mic_count as number,
        latestLocationName: null,
      }))

      // Populate latest location name from the latest movement row for each base
      for (const row of baseRows) {
        const { data: movements, error: movementError } = await supabase
          .from('movement')
          .select('location(name)')
          .eq('base', row.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (movementError) {
          console.error('Error fetching latest movement for base', row.id, movementError)
          continue
        }

        const latest = movements?.[0] as
          | {
              location?: { name?: string | null } | null
            }
          | undefined

        row.latestLocationName = latest?.location?.name ?? null
      }

      setRows(baseRows)

      setStatus(messages.bases.feedback.loaded)
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bases.feedback.loadFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [messages.bases.feedback.loaded, messages.bases.feedback.loadFailed])

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
    setStatus(null)
    setMoveDialogOpen(true)
    setMoveBaseId(row.id)
    setMoveLocationId('')

    setMoveLocationChoices([])

    void loadMoveChoices(row)
  }

  function cancelMoveDialog() {
    resetMoveDialog()
  }

  async function confirmMoveBase() {
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
    setStatus(null)
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

      setStatus(messages.bases.feedback.updated)
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
    setStatus(null)

    try {
      const { error: deleteError } = await supabase.from('base').delete().eq('id', id)
      if (deleteError) throw deleteError



      setStatus(messages.bases.feedback.deleted)
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
        case 'identifier':
          return (a.identifier - b.identifier) * dirMul
        case 'latestLocationName': {
          const av = a.latestLocationName ?? ''
          const bv = b.latestLocationName ?? ''
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



  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <BaseEditor
        messages={messages}
        canWrite={canWrite}
        isOpen={baseEditorOpen}
        onClose={() => setBaseEditorOpen(false)}
        onSaved={async () => {
          setError(null)
          setStatus(null)
          await loadBases()
        }}

      />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>{messages.bases.title}</h2>

        {canWrite ? (
          <button
            type="button"
            onClick={() => setBaseEditorOpen(true)}

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

      {!canWrite ? (
        <div style={{ marginTop: 12, textAlign: 'left' }}>{messages.bases.readOnly}</div>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <button
            type="button"
            onClick={loadBases}
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.bases.actions.refresh}
          </button>
        </div>
      )}

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
          <h3 style={{ margin: '0 0 10px' }}>{messages.bases.table.title}</h3>

        {rows.length === 0 ? (
          <div>{messages.bases.table.empty}</div>
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
                    {messages.bases.table.identifier}
                    <SortIcon active={sortColumn === 'identifier'} sortDirection={sortDirection} />
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
                    onClick={() => toggleSort('latestLocationName')}
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
                    <SortIcon active={sortColumn === 'latestLocationName'} sortDirection={sortDirection} />
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


                  <tr key={row.id}>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.identifier}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.maxMicCount}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {row.latestLocationName ?? ''}
                    </td>
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
                            onClick={() => deleteBase(row.id)}
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
              {rows.find((r) => r.id === moveBaseId)?.identifier ?? ''}
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


