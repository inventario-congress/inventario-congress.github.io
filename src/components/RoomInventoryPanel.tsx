import { Fragment, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type RoomMicrophone = {
  id: number
  identifier: number
  model_name: string
  mic_type_name: string
}

type RoomInventoryRow = {
  item_type: 'base' | 'combo' | 'handheld' | 'console' | 'case'
  item_id: number
  item_identifier: number
  item_model: string
  return_date: string | null
  microphones: RoomMicrophone[]
}

type RoomInventoryPanelProps = {
  messages: Messages
  roomId: number
  roomName: string
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

export default function RoomInventoryPanel({ messages, roomId, roomName }: RoomInventoryPanelProps) {
  const [rows, setRows] = useState<RoomInventoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsedBaseIds, setCollapsedBaseIds] = useState<Set<number>>(new Set())

  const itemTypeLabels = useMemo(() => {
    const labels: Record<RoomInventoryRow['item_type'], string> = {
        base: messages.bulkMove.itemTypeBase,
        combo: messages.bulkMove.itemTypeCombo,
        handheld: messages.bulkMove.itemTypeHandheld,
        console: messages.bulkMove.itemTypeConsole,
        case: messages.bulkMove.itemTypeCase,
    }
    return labels
  }, [messages.bulkMove.itemTypeBase, messages.bulkMove.itemTypeCombo, messages.bulkMove.itemTypeHandheld, messages.bulkMove.itemTypeConsole, messages.bulkMove.itemTypeCase])

  useEffect(() => {
    if (!supabase) return

    let active = true

    ;(async () => {
      setLoading(true)
      setError(null)

      try {
        const { data, error: loadError } = await supabase.rpc('get_room_inventory', {
          p_room_id: roomId,
        })

        if (loadError) throw loadError

        if (active) {
          // FIX ME! Temporarily disable countable categories.
          const filtered_data = (data ?? []).filter((item: RoomInventoryRow) => itemTypeLabels[item.item_type] !== undefined)
          setRows(filtered_data as RoomInventoryRow[])
          // setRows((data ?? []) as RoomInventoryRow[])
          // END FIX ME!
        }
      } catch (e) {
        if (active) {
          setRows([])
          setError(e instanceof Error ? e.message : messages.roomInventory.feedback.loadFailed)
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [messages.roomInventory.feedback.loadFailed, roomId, itemTypeLabels])

  return (
    <div style={{ width: 'fit-content', maxWidth: '100%', margin: '0 auto', padding: 0, textAlign: 'left', fontSize: 'inherit' }}>
      <h2
        style={{
          margin: '0 0 12px',
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--accent-border)',
          fontSize: 20,
          fontWeight: 'bold'
        }}
      >
        {messages.roomInventory.title}: {roomName}
      </h2>

      {error ? (
        <div style={{ color: 'crimson', marginBottom: 10 }}>
          <span>{messages.auth.feedback.error}</span> {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: '10px 6px', fontSize: 'inherit' }}>
          {messages.roomInventory.loading}
        </div>
      ) : rows.length === 0 ? (
        <div>{messages.roomInventory.empty}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  messages.bases.table.identifier,
                  messages.bases.table.model,
                  messages.bases.table.latestReturnDate,
                ].map((label) => (
                  <th
                    key={label}
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--table-header-bg)',
                      padding: '8px 6px',
                      whiteSpace: 'nowrap',
                      fontSize: 'inherit',
                      fontWeight: 'normal',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isBase = row.item_type === 'base'
                const isExpanded = isBase && !collapsedBaseIds.has(row.item_id)

                return (
                  <Fragment key={`${row.item_type}-${row.item_id}`}>
                    <tr
                      onClick={isBase ? () =>
                            setCollapsedBaseIds(prev => {
                              const next = new Set(prev)
                              if (next.has(row.item_id)) next.delete(row.item_id)
                              else next.add(row.item_id)
                              return next
                            })
                          : undefined}
                      style={{
                        cursor: isBase ? 'pointer' : undefined,
                        fontWeight: isExpanded ? 'bold' : undefined,
                      }}
                    >
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px', verticalAlign: 'top' }}>
                        {isBase ? <TriangleIcon isOpen={isExpanded} /> : null}
                        {row.item_identifier}
                      </td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{itemTypeLabels[row.item_type] ?? row.item_type}</div>
                        <div>{row.item_model}</div>
                      </td>
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px', verticalAlign: 'top' }}>
                        {formatDateOnly(row.return_date)}
                      </td>
                    </tr>
                    {isBase ? (
                      <tr>
                        <td colSpan={3} style={{ padding: 0, borderBottom: '1px solid var(--border)' }}>
                          <div
                            style={{
                              overflow: 'hidden',
                              width: '85%',
                              marginLeft: 'auto',
                              border: isExpanded ? '2px solid var(--accent-border)' : '0px solid transparent',
                              borderRadius: 12,
                              transition: 'max-height 120ms ease, opacity 120ms ease, transform 120ms ease, border 120ms ease',
                              maxHeight: isExpanded ? 1000 : 0,
                              opacity: isExpanded ? 1 : 0,
                              transform: isExpanded ? 'translateY(0px)' : 'translateY(-4px)',
                              pointerEvents: isExpanded ? 'auto' : 'none',
                            }}
                          >
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  {[messages.bases.table.identifier, messages.bases.table.type].map((label) => (
                                    <th
                                      key={label}
                                      style={{
                                        textAlign: 'left',
                                        borderBottom: '1px solid var(--border)',
                                        background: 'var(--table-header-bg)',
                                        padding: '6px 4px',
                                        whiteSpace: 'nowrap',
                                        fontSize: 'inherit',
                                        fontWeight: 'normal',
                                      }}
                                    >
                                      {label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[...row.microphones]
                                  .sort((a, b) => a.identifier - b.identifier)
                                  .map((microphone) => (
                                    <tr key={microphone.id}>
                                      <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                                        {microphone.identifier}
                                      </td>
                                      <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                                        {microphone.mic_type_name}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
