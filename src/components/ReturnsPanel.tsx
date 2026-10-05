import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type ReturnRow = {
  type: 'Base' | 'Combo'
  base_id: number | null
  base_identifier: number | null
  base_mic_model_name: string | null
  combo_id: number | null
  combo_identifier: number | null
  combo_model: string | null
  return_date: string | null
  location: string | null
}

type ReturnsPanelProps = {
  messages: Messages
}

type SortColumn = 'identifier' | 'name' | 'location' | 'return_date'
type SortDirection = 'asc' | 'desc'

const SORT_STORAGE_KEY = 'inventario_congress:returns:sort'

function getIdentifier(row: ReturnRow): number | null {
  return row.type === 'Base' ? row.base_identifier : row.combo_identifier
}

function getName(row: ReturnRow): string {
  return (row.type === 'Base' ? row.base_mic_model_name : row.combo_model) ?? ''
}

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

export default function ReturnsPanel({ messages }: ReturnsPanelProps) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(SORT_STORAGE_KEY) ?? '{}') as { sortColumn?: unknown }
      const c = parsed.sortColumn
      if (c === 'identifier' || c === 'name' || c === 'location' || c === 'return_date') return c
    } catch {
      // ignore
    }
    return 'return_date'
  })
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(SORT_STORAGE_KEY) ?? '{}') as { sortDirection?: unknown }
      if (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc') return parsed.sortDirection
    } catch {
      // ignore
    }
    return 'asc'
  })

  const loadReturns = useCallback(async () => {
    if (!supabase) return

    setError(null)
    setLoading(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('get_upcoming_returns')
      if (rpcError) throw rpcError
      if (!data) throw new Error('No data returned from get_upcoming_returns()')

      setRows(data as ReturnRow[])
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

  function toggleSort(column: SortColumn) {
    const nextDirection: SortDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortColumn(column)
    setSortDirection(nextDirection)
    window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ sortColumn: column, sortDirection: nextDirection }))
  }

  const sortedRows = useMemo(() => {
    const dirMul = sortDirection === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      let result: number
      if (sortColumn === 'identifier') {
        result = (getIdentifier(a) ?? 0) - (getIdentifier(b) ?? 0)
      } else if (sortColumn === 'name') {
        result = getName(a).localeCompare(getName(b))
      } else if (sortColumn === 'location') {
        result = (a.location ?? '').localeCompare(b.location ?? '')
      } else {
        result = (parseDateOnly(a.return_date)?.getTime() ?? 0) - (parseDateOnly(b.return_date)?.getTime() ?? 0)
      }
      return result * dirMul
    })
  }, [rows, sortColumn, sortDirection])

  const columns: { key: SortColumn; label: string }[] = [
    { key: 'identifier', label: messages.returns.table.identifier },
    { key: 'name', label: messages.returns.table.name },
    { key: 'location', label: messages.returns.table.location },
    { key: 'return_date', label: messages.returns.table.returnDate },
  ]

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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} style={thStyle}>
                      {col.label}
                      <SortIcon active={sortColumn === col.key} sortDirection={sortDirection} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const cellStyle = { borderBottom: '1px solid var(--border)', padding: '8px 6px' }
                  return (
                    <tr
                      key={`${row.type}-${row.type === 'Base' ? row.base_id : row.combo_id}-${row.return_date}`}
                      style={isDueOrOverdue(row.return_date) ? { color: 'red' } : undefined}
                    >
                      <td style={cellStyle}>{getIdentifier(row) ?? ''}</td>
                      <td style={cellStyle}>{getName(row)}</td>
                      <td style={cellStyle}>{row.location ?? ''}</td>
                      <td style={cellStyle}>{formatDateOnly(row.return_date)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
