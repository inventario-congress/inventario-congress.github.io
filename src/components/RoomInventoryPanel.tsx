import { useEffect, useState } from 'react'

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
          setRows((data ?? []) as RoomInventoryRow[])
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
  }, [messages.roomInventory.feedback.loadFailed, roomId])

  const itemTypeLabels: Record<RoomInventoryRow['item_type'], string> = {
    base: messages.bulkMove.itemTypeBase,
    combo: messages.bulkMove.itemTypeCombo,
    handheld: messages.bulkMove.itemTypeHandheld,
    console: messages.bulkMove.itemTypeConsole,
    case: messages.bulkMove.itemTypeCase,
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>
        {messages.roomInventory.title}: {roomName}
      </h2>

      {error ? (
        <div style={{ color: 'crimson', marginBottom: 10 }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: '10px 6px' }}>
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
                  messages.roomInventory.table.type,
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
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.item_type}-${row.item_id}`}>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px', verticalAlign: 'top' }}>
                    {itemTypeLabels[row.item_type]}
                  </td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px', verticalAlign: 'top' }}>
                    {row.item_identifier}
                  </td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    <div>{row.item_model}</div>
                    {row.item_type === 'base' ? (
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          marginTop: 8,
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                        }}
                      >
                        <thead>
                          <tr>
                            {[messages.bases.table.identifier, messages.bases.table.model, messages.bases.table.type].map((label) => (
                              <th
                                key={label}
                                style={{
                                  textAlign: 'left',
                                  borderBottom: '1px solid var(--border)',
                                  background: 'var(--table-header-bg)',
                                  padding: '6px 4px',
                                  whiteSpace: 'nowrap',
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
                                  {microphone.model_name}
                                </td>
                                <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                                  {microphone.mic_type_name}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    ) : null}
                  </td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px', verticalAlign: 'top' }}>
                    {formatDateOnly(row.return_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
