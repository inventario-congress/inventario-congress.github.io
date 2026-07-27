import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import EntityMover from './EntityMover'

type LocationChoice = {
  id: number
  name: string
}

type RoomItem = {
  room_id: number
  room_name: string
  item_type: 'base' | 'combo'
  item_id: number
  item_identifier: number
  item_model: string
}

type RoomGroup = {
  room_id: number
  room_name: string
  items: RoomItem[]
}

type SelectionMap = Record<string, boolean> // key: `${item_type}-${item_id}`

type SortColumn = 'item_identifier' | 'item_model' | 'item_type'
type SortDirection = 'asc' | 'desc'

type BulkMovePanelProps = {
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

export default function BulkMovePanel({ messages, canWrite }: BulkMovePanelProps) {
  const [locations, setLocations] = useState<LocationChoice[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('')
  const [roomGroups, setRoomGroups] = useState<RoomGroup[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [selection, setSelection] = useState<SelectionMap>({})
  const [error, setError] = useState<string | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('item_identifier')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const loadLocations = useCallback(async () => {
    if (!supabase) return

    setLocationsLoading(true)
    setError(null)

    try {
      const { data, error: locError } = await supabase
        .from('location')
        .select('id, name')
        .order('name', { ascending: true })

      if (locError) throw locError

      setLocations(
        (data ?? []).map((l) => ({
          id: l.id as number,
          name: l.name as string,
        }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.bulkMove.feedback.loadFailed)
    } finally {
      setLocationsLoading(false)
    }
  }, [messages.bulkMove.feedback.loadFailed])

  useEffect(() => {
    if (!supabase) return

    let active = true

    ;(async () => {
      await supabase.auth.getSession()
      if (!active) return
      await loadLocations()
    })()

    return () => {
      active = false
    }
  }, [loadLocations])

  const loadItemsForLocation = useCallback(
    async (locationId: number) => {
      if (!supabase) return

      setItemsLoading(true)
      setError(null)
      setSelection({})

      try {
        const { data, error: rpcError } = await supabase.rpc('get_items_by_room_for_location', {
          p_location_id: locationId,
        })

        if (rpcError) throw rpcError

        const rawItems = (data ?? []) as RoomItem[]
        const groupsMap = new Map<number, RoomGroup>()

        for (const item of rawItems) {
          let group = groupsMap.get(item.room_id)
          if (!group) {
            group = { room_id: item.room_id, room_name: item.room_name, items: [] }
            groupsMap.set(item.room_id, group)
          }
          group.items.push(item)
        }

        const groups = Array.from(groupsMap.values()).sort((a, b) =>
          a.room_name.localeCompare(b.room_name)
        )

        setRoomGroups(groups)
      } catch (e) {
        setError(e instanceof Error ? e.message : messages.bulkMove.feedback.loadFailed)
        setRoomGroups([])
      } finally {
        setItemsLoading(false)
      }
    },
    [messages.bulkMove.feedback.loadFailed]
  )

  // Reset sort when location changes
  useEffect(() => {
    setSortColumn('item_identifier')
    setSortDirection('asc')
  }, [selectedLocationId])

  useEffect(() => {
    if (selectedLocationId === '' || typeof selectedLocationId !== 'number') {
      setRoomGroups([])
      setSelection({})
      return
    }

    let active = true

    queueMicrotask(() => {
      if (!active) return
      void loadItemsForLocation(selectedLocationId as number)
    })

    return () => {
      active = false
    }
  }, [selectedLocationId, loadItemsForLocation])

  const selectionCount = useMemo(() => Object.keys(selection).filter((k) => selection[k]).length, [selection])

  const selectedItems = useMemo(() => {
    return Object.entries(selection)
      .filter(([, v]) => v)
      .map(([key]) => {
        const [itemType, itemIdStr] = key.split('-')
        return {
          entityType: itemType as 'base' | 'combo',
          entityId: Number.parseInt(itemIdStr, 10),
        }
      })
  }, [selection])

  function toggleItem(key: string) {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleRoom(roomId: number, checked: boolean) {
    setSelection((prev) => {
      const next = { ...prev }
      const group = roomGroups.find((g) => g.room_id === roomId)
      if (!group) return next
      for (const item of group.items) {
        const key = `${item.item_type}-${item.item_id}`
        next[key] = checked
      }
      return next
    })
  }

  function isRoomFullySelected(roomId: number): boolean {
    const group = roomGroups.find((g) => g.room_id === roomId)
    if (!group || group.items.length === 0) return false
    return group.items.every((item) => selection[`${item.item_type}-${item.item_id}`])
  }

  function isRoomPartiallySelected(roomId: number): boolean {
    const group = roomGroups.find((g) => g.room_id === roomId)
    if (!group || group.items.length === 0) return false
    const anySelected = group.items.some((item) => selection[`${item.item_type}-${item.item_id}`])
    return anySelected && !isRoomFullySelected(roomId)
  }

  function handleMoveClick() {
    if (!canWrite || selectionCount === 0) return
    setMoveDialogOpen(true)
  }

  function keyForItem(item: RoomItem): string {
    return `${item.item_type}-${item.item_id}`
  }

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedRoomGroups = useMemo(() => {
    const dirMul = sortDirection === 'asc' ? 1 : -1
    return roomGroups.map((group) => {
      const sorted = [...group.items].sort((a, b) => {
        switch (sortColumn) {
          case 'item_identifier':
            return (a.item_identifier - b.item_identifier) * dirMul
          case 'item_model':
            return a.item_model.localeCompare(b.item_model) * dirMul
          case 'item_type': {
            const aType = a.item_type === 'base' ? 0 : 1
            const bType = b.item_type === 'base' ? 0 : 1
            return (aType - bType) * dirMul
          }
          default:
            return 0
        }
      })
      return { ...group, items: sorted }
    })
  }, [roomGroups, sortColumn, sortDirection])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
      <h2 style={{ margin: '24px 0 0 0' }}>{messages.bulkMove.title}</h2>

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16, textAlign: 'left' }}>
        <label htmlFor="bulk-move-location" style={{ display: 'block', marginBottom: 6 }}>
          {messages.bulkMove.venueLabel}
        </label>
        <select
          id="bulk-move-location"
          value={selectedLocationId}
          onChange={(e) => {
            const value = e.target.value
            setSelectedLocationId(value === '' ? '' : Number.parseInt(value, 10))
          }}
          disabled={locationsLoading || locations.length === 0}
          style={{
            width: '100%',
            maxWidth: 400,
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}
        >
          <option value="">{messages.bulkMove.venuePlaceholder}</option>
          {locations.length === 0 ? (
            <option value="" disabled>
              {messages.bulkMove.venueEmpty}
            </option>
          ) : (
            locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div style={{ marginTop: 20 }}>
        {selectedLocationId === '' || typeof selectedLocationId !== 'number' ? (
          <div style={{ color: 'var(--muted)' }}>{messages.bulkMove.noItems}</div>
        ) : itemsLoading ? (
          <div style={{ color: 'var(--muted)' }}>{messages.bulkMove.loadingItems}</div>
        ) : roomGroups.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>{messages.bulkMove.noItems}</div>
        ) : (
          sortedRoomGroups.map((group) => {
            const fullySelected = isRoomFullySelected(group.room_id)
            const partiallySelected = isRoomPartiallySelected(group.room_id)

            return (
              <div
                key={group.room_id}
                style={{
                  marginBottom: 20,
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
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
                    ref={(el) => {
                      if (el) el.indeterminate = partiallySelected && !fullySelected
                    }}
                    onChange={(e) => toggleRoom(group.room_id, e.target.checked)}
                    aria-label={`${messages.bulkMove.selectAllLabel} - ${group.room_name}`}
                  />
                  <strong>{messages.bulkMove.roomTableHeader.replace('{roomName}', group.room_name)}</strong>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          width: 40,
                          textAlign: 'center',
                          borderBottom: '1px solid var(--border)',
                          padding: '6px 4px',
                          background: 'var(--table-header-bg)',
                        }}
                      />
                      <th
                        onClick={() => toggleSort('item_identifier')}
                        style={{
                          cursor: 'pointer',
                          userSelect: 'none',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--border)',
                          padding: '6px 4px',
                          background: 'var(--table-header-bg)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {messages.combos.table.identifier}
                        <SortIcon active={sortColumn === 'item_identifier'} sortDirection={sortDirection} />
                      </th>
                      <th
                        onClick={() => toggleSort('item_model')}
                        style={{
                          cursor: 'pointer',
                          userSelect: 'none',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--border)',
                          padding: '6px 4px',
                          background: 'var(--table-header-bg)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {messages.combos.table.model}
                        <SortIcon active={sortColumn === 'item_model'} sortDirection={sortDirection} />
                      </th>
                      <th
                        onClick={() => toggleSort('item_type')}
                        style={{
                          cursor: 'pointer',
                          userSelect: 'none',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--border)',
                          padding: '6px 4px',
                          background: 'var(--table-header-bg)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {messages.microphones.fields.micTypeName}
                        <SortIcon active={sortColumn === 'item_type'} sortDirection={sortDirection} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => {
                      const k = keyForItem(item)
                      return (
                        <tr
                          key={k}
                          onClick={() => toggleItem(k)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td
                            style={{
                              textAlign: 'center',
                              borderBottom: '1px solid var(--border)',
                              padding: '6px 4px',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!!selection[k]}
                              onChange={() => toggleItem(k)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                            {item.item_identifier}
                          </td>
                          <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                            {item.item_model}
                          </td>
                          <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
                            {item.item_type === 'base'
                              ? messages.bulkMove.itemTypeBase
                              : messages.bulkMove.itemTypeCombo}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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
            {messages.bulkMove.selectedCount.replace('{count}', String(selectionCount))}
          </span>
          <button
            type="button"
            onClick={handleMoveClick}
            disabled={selectionCount === 0}
            style={{
              padding: '10px 18px',
              borderRadius: 6,
              cursor: selectionCount === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {messages.bulkMove.moveButton}
          </button>
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
          setError(null)
          setMoveDialogOpen(false)
          setSelection({})
          if (typeof selectedLocationId === 'number') {
            await loadItemsForLocation(selectedLocationId)
          }
        }}
      />
    </div>
  )
}

