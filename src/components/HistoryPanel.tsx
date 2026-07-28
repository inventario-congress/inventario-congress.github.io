import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type HistoryItem = {
  id: number
  identifier: number
  item_type: 'base' | 'combo' | 'microphone'
  model_name: string
}

type MovementRecord = {
  created_at: string
  user_name: string | null
  location_name: string
  room_name: string
}

type AttachmentRecord = {
  created_at: string
  user_name: string | null
  base_identifier: number
}

type HistoryPanelProps = {
  messages: Messages
}

export default function HistoryPanel({ messages }: HistoryPanelProps) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [historyData, setHistoryData] = useState<Record<string, MovementRecord[] | AttachmentRecord[]>>({})
  const [historyLoading, setHistoryLoading] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const loadItems = useCallback(async () => {
    if (!supabase) return

    setItemsLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('get_bases_combos_mics')

      if (rpcError) throw rpcError

      setItems((data ?? []) as HistoryItem[])
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.history.noItems)
    } finally {
      setItemsLoading(false)
    }
  }, [messages.history.noItems])

  useEffect(() => {
    if (!supabase) return

    let active = true

    ;(async () => {
      await supabase.auth.getSession()
      if (!active) return
      await loadItems()
    })()

    return () => {
      active = false
    }
  }, [loadItems])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items

    const lower = searchTerm.toLowerCase()
    return items.filter(
      (item) =>
        String(item.identifier).includes(lower) ||
        item.model_name.toLowerCase().includes(lower) ||
        item.item_type.toLowerCase().includes(lower)
    )
  }, [items, searchTerm])

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedKeys.has(getItemKey(item)))
  }, [items, selectedKeys])

  function toggleItem(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function getItemKey(item: HistoryItem): string {
    return `${item.item_type}-${item.id}`
  }

  function formatDateTime(value: string): [string, string] {
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

  async function fetchItemHistory(item: HistoryItem): Promise<MovementRecord[] | AttachmentRecord[]> {
    if (!supabase) return []

    if (item.item_type === 'microphone') {
      const { data, error: queryError } = await supabase
        .from('attachment')
        .select(`
          created_at,
          user,
          base!inner(identifier)
        `)
        .eq('microphone', item.id)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      // Fetch display names for users
      const userIds = [...new Set((data ?? []).map((r) => r.user).filter(Boolean))]
      const userNames = await fetchUserDisplayNames(userIds)

      return (data ?? []).map((r) => ({
        created_at: r.created_at,
        user_name: userNames[r.user] ?? null,
        base_identifier: (r.base as unknown as { identifier: number }).identifier,
      }))
    } else {
      // base or combo
      const column = item.item_type === 'base' ? 'base' : 'combo'
      const { data, error: queryError } = await supabase
        .from('movement')
        .select(`
          created_at,
          user,
          location!inner(name),
          room!inner(name)
        `)
        .eq(column, item.id)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      const userIds = [...new Set((data ?? []).map((r) => r.user).filter(Boolean))]
      const userNames = await fetchUserDisplayNames(userIds)

      return (data ?? []).map((r) => ({
        created_at: r.created_at,
        user_name: userNames[r.user] ?? null,
        location_name: (r.location as unknown as { name: string }).name,
        room_name: (r.room as unknown as { name: string }).name,
      }))
    }
  }

  async function fetchUserDisplayNames(userIds: string[]): Promise<Record<string, string>> {
    if (!supabase || userIds.length === 0) return {}

    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)

      if (queryError) throw queryError

      const map: Record<string, string> = {}
      for (const row of data ?? []) {
        map[row.id] = row.display_name
      }
      return map
    } catch {
      return {}
    }
  }

  // Load history for newly selected items
  useEffect(() => {
    if (!supabase) return

    // Defer all setState calls outside the synchronous effect body
    Promise.resolve().then(() => {
      const keys = new Set(selectedItems.map(getItemKey))
      const loadingKeys = new Set<string>()

      // Mark selected keys as loading (skip already-loaded ones)
      for (const key of keys) {
        if (!historyData[key]) {
          loadingKeys.add(key)
        }
      }

      if (loadingKeys.size === 0) return

      setHistoryLoading((prev) => {
        const next = new Set(prev)
        for (const k of loadingKeys) next.add(k)
        return next
      })

      for (const item of selectedItems) {
        const key = getItemKey(item)
        if (historyData[key]) continue

        Promise.resolve().then(async () => {
          try {
            const records = await fetchItemHistory(item)
            // Check if this item is still selected
            if (keys.has(key)) {
              setHistoryData((prev) => ({ ...prev, [key]: records }))
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : messages.history.loadingHistory)
          } finally {
            // Only update loading state if item is still selected
            if (keys.has(key)) {
              setHistoryLoading((prev) => {
                const next = new Set(prev)
                next.delete(key)
                return next
              })
            }
          }
        })
      }
    })
  }, [selectedItems]) // eslint-disable-line react-hooks/exhaustive-deps

  function getItemTypeLabel(itemType: string): string {
    switch (itemType) {
      case 'base':
        return messages.bulkMove.itemTypeBase
      case 'combo':
        return messages.bulkMove.itemTypeCombo
      case 'microphone':
        return messages.microphones.title
      default:
        return itemType
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
      <h2 style={{ margin: '24px 0 0 0' }}>{messages.history.title}</h2>

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      {/* Dropdown with checkboxes */}
      <div style={{ marginTop: 12, position: 'relative' }} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          disabled={itemsLoading}
          style={{
            width: '100%',
            maxWidth: 400,
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text-h)',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            {selectedItems.length === 0
              ? messages.history.itemDropdownPlaceholder
              : messages.history.selectedCount
                  ?.replace('{count}', String(selectedItems.length))
                  ?.replace(/\{plural\}/g, selectedItems.length === 1 ? '' : 's') ?? `${selectedItems.length} selected`}
          </span>
          <span aria-hidden="true" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 120ms ease' }}>
            ▼
          </span>
        </button>

        {dropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              maxWidth: 400,
              maxHeight: 320,
              overflowY: 'auto',
              marginTop: 4,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg)',
              zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {/* Search input */}
            <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={messages.history.itemDropdownPlaceholder}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-h)',
                }}
              />
            </div>

            {itemsLoading ? (
              <div style={{ padding: 12, color: 'var(--muted)' }}>{messages.history.loadingItems}</div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: 12, color: 'var(--muted)' }}>{messages.history.noItems}</div>
            ) : (
              filteredItems.map((item) => {
                const itemKey = getItemKey(item)
                return (
                  <label
                    key={itemKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      background: selectedKeys.has(itemKey) ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(itemKey)}
                      onChange={() => toggleItem(itemKey)}
                    />
                    <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>
                        <strong>{`N°${item.identifier}`}</strong>
                        {' — '}
                        <span style={{ color: 'var(--muted)' }}>{item.model_name}</span>
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: 12, alignSelf: 'center' }}>
                        {getItemTypeLabel(item.item_type)}
                      </span>
                    </span>
                  </label>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* History sections */}
      <div style={{ marginTop: 20 }}>
        {selectedItems.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>{messages.history.loadingItems}</div>
        ) : (
          selectedItems.map((item) => {
            const key = getItemKey(item)
            const isLoading = historyLoading.has(key)
            const records = historyData[key]

            return (
              <div
                key={key}
                style={{
                  marginBottom: 20,
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 12px',
                    background: 'var(--table-header-bg)',
                    borderBottom: '1px solid var(--border)',
                    fontWeight: 600,
                  }}
                >
                  {messages.history.historyTitle
                    .replace('{identifier}', item.item_type === 'microphone' ? `N°${item.identifier}` : `N°${item.identifier}`)
                    .replace('{modelName}', item.model_name)}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>
                    ({getItemTypeLabel(item.item_type)})
                  </span>
                </div>

                {isLoading ? (
                  <div style={{ padding: 16, color: 'var(--muted)' }}>{messages.history.loadingHistory}</div>
                ) : !records || (Array.isArray(records) && records.length === 0) ? (
                  <div style={{ padding: 16, color: 'var(--muted)' }}>{messages.history.table.empty}</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border)',
                            padding: '6px 8px',
                            whiteSpace: 'nowrap',
                            background: 'var(--table-header-bg)',
                          }}
                        >
                          {messages.history.table.date}
                        </th>
                        <th
                          style={{
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border)',
                            padding: '6px 8px',
                            background: 'var(--table-header-bg)',
                          }}
                        >
                          {messages.history.table.user}
                        </th>
                        <th
                          style={{
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border)',
                            padding: '6px 8px',
                            background: 'var(--table-header-bg)',
                          }}
                        >
                          {messages.history.table.destination}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(records as (MovementRecord | AttachmentRecord)[]).map((record, idx) => {
                        const [datePart, timePart] = formatDateTime(record.created_at)
                        let destination: string

                        if ('base_identifier' in record) {
                          destination = `Base N°${record.base_identifier}`
                        } else {
                          destination = `${(record as MovementRecord).location_name}, ${(record as MovementRecord).room_name}`
                        }

                        return (
                          <tr key={idx}>
                            <td
                              style={{
                                borderBottom: '1px solid var(--border)',
                                padding: '6px 8px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <div>{datePart}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{timePart}</div>
                            </td>
                            <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 8px' }}>
                              {record.user_name ?? ''}
                            </td>
                            <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 8px' }}>
                              {destination}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

