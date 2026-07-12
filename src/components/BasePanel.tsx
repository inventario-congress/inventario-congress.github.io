import { useEffect, useMemo, useState, useCallback } from 'react'


import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

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

type LocationChoice = {
  id: number
  name: string
}

export default function BasePanel({ messages, canWrite }: BasePanelProps) {
  const [identifier, setIdentifier] = useState('')
  const [maxMicCount, setMaxMicCount] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

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

  function resetForm() {
    setIdentifier('')
    setMaxMicCount('')
    setEditingId(null)
  }

  async function handleSubmit() {
    if (!supabase) {
      return
    }

    if (!canWrite) {
      return
    }

    const parsedIdentifier = Number.parseInt(identifier, 10)
    const parsedMaxMicCount = Number.parseInt(maxMicCount, 10)

    if (Number.isNaN(parsedIdentifier) || Number.isNaN(parsedMaxMicCount)) {
      return
    }

    setError(null)
    setStatus(null)
    setLoading(true)

    try {
      const payload = {
        identifier: parsedIdentifier,
        max_mic_count: parsedMaxMicCount,
      }

      if (editingId === null) {
        const { error: createError } = await supabase.from('base').insert(payload)
        if (createError) throw createError
        setStatus(messages.bases.feedback.created)
      } else {
        const { error: updateError } = await supabase.from('base').update(payload).eq('id', editingId)
        if (updateError) throw updateError
        setStatus(messages.bases.feedback.updated)
      }

      resetForm()
      await loadBases()
    } catch (e) {
      const fallback = editingId === null ? messages.bases.feedback.createFailed : messages.bases.feedback.updateFailed
      const msg = e instanceof Error ? e.message : fallback
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(row: BaseRow) {
    if (!canWrite) {
      return
    }

    setEditingId(row.id)
    setIdentifier(String(row.identifier))
    setMaxMicCount(String(row.maxMicCount))
    setError(null)
    setStatus(null)
  }

  function cancelEdit() {
    resetForm()
  }

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

      if (editingId === id) {
        cancelEdit()
      }

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
      <h2 style={{ marginTop: 24 }}>{messages.bases.title}</h2>



      {canWrite ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label htmlFor="base-identifier" style={{ textAlign: 'left' }}>
            {messages.bases.fields.identifier}
          </label>

          <input
            id="base-identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            type="number"
            required
            placeholder={messages.bases.fields.identifier}

            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />

          <label htmlFor="base-max-mic-count" style={{ textAlign: 'left' }}>
            {messages.bases.fields.maxMicCount}
          </label>

          <input
            id="base-max-mic-count"
            value={maxMicCount}
            onChange={(event) => setMaxMicCount(event.target.value)}
            type="number"
            required
            placeholder={messages.bases.fields.maxMicCount}

            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button

              type="button"
              onClick={handleSubmit}
              disabled={loading || !identifier.trim() || !maxMicCount.trim()}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
            {editingId === null ? messages.bases.actions.create : messages.bases.actions.update}
            </button>



            {editingId !== null ? (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={loading}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {messages.bases.actions.cancelEdit}

              </button>
            ) : null}

            <button
              type="button"
              onClick={loadBases}
              disabled={loading}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.bases.actions.refresh}
            </button>

          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, textAlign: 'left' }}>
          {messages.bases.readOnly}

        </div>
      )}

      {!canWrite ? (
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
                    <SortIcon active={sortColumn === 'identifier'} />
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
                    <SortIcon active={sortColumn === 'latestLocationName'} />
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
                            onClick={() => startEdit(row)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.bases.actions.edit}
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


