import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import EntityMover from './EntityMover'
import DeleteConfirmation, { type DeleteEntityDescriptor } from './DeleteConfirmation'

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
  const [detachDialogOpen, setDetachDialogOpen] = useState(false)
  const [detachDialogLoading, setDetachDialogLoading] = useState(false)
  const [detachEntities, setDetachEntities] = useState<DeleteEntityDescriptor[]>([])
  const [detachBaseIds, setDetachBaseIds] = useState<number[]>([])
  const [sortColumn, setSortColumn] = useState<SortColumn>('item_type')
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

      setLocations((data ?? []) as LocationChoice[])
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

  useEffect(() => {
    if (selectedLocationId === '' || typeof selectedLocationId !== 'number') {
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

  const selectedBaseItems = useMemo(
    () => selectedItems.filter((item) => item.entityType === 'base'),
    [selectedItems]
  )

  const selectedBaseIds = useMemo(
    () => selectedBaseItems.map((item) => item.entityId),
    [selectedBaseItems]
  )

  const canDetachSelectedBases = canWrite && selectionCount > 0 && selectedBaseItems.length === selectionCount

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

  async function handleDetachClick() {
    if (!canDetachSelectedBases || selectedBaseIds.length === 0 || !supabase) return

    setError(null)
    setDetachDialogLoading(true)

    try {
      const { data: attachmentRows, error: attachmentError } = await supabase
        .from('attachment')
        .select('microphone:microphone(id, identifier)')
        .in('base', selectedBaseIds)
        .eq('is_active', true)

      if (attachmentError) throw attachmentError

      const microphoneIds = Array.from(
        new Set(
          (attachmentRows ?? [])
            .map((row) => row.microphone)
            .filter((value): value is { id: number; identifier: number } => Boolean(value))
            .map((value) => value.id)
        )
      )

      if (microphoneIds.length === 0) {
        throw new Error(messages.bulkMove.feedback.noMicrophonesToDetach)
      }

      const entities = (attachmentRows ?? [])
        .map((row) => row.microphone)
        .filter((value): value is { id: number; identifier: number } => Boolean(value))
        .map((row) => ({ id: row.id, identifier: row.identifier }))
        .filter((entity, index, arr) => arr.findIndex((candidate) => candidate.id === entity.id) === index)
        .sort((a, b) => a.identifier - b.identifier)

      setDetachBaseIds(selectedBaseIds)
      setDetachEntities(entities)
      setDetachDialogOpen(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bulkMove.feedback.loadFailed
      setError(msg)
    } finally {
      setDetachDialogLoading(false)
    }
  }

  async function detachSelectedBases() {
    if (!supabase) return
    if (!canWrite) return
    if (detachBaseIds.length === 0) return

    setError(null)
    setDetachDialogLoading(true)

    try {
      const { error: detachError } = await supabase
        .from('attachment')
        .update({ is_active: false })
        .in('base', detachBaseIds)
        .eq('is_active', true)

      if (detachError) throw detachError

      setDetachDialogOpen(false)
      setDetachEntities([])
      setDetachBaseIds([])
      setSelection({})

      if (typeof selectedLocationId === 'number') {
        await loadItemsForLocation(selectedLocationId)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bulkMove.feedback.detachFailed
      setError(msg)
    } finally {
      setDetachDialogLoading(false)
    }
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

      <div style={{ marginTop: 2, textAlign: 'left' }}>
        <select
          id="bulk-move-location"
          value={selectedLocationId}
          onChange={(e) => {
            const value = e.target.value
            const newId = value === '' ? '' : Number.parseInt(value, 10)
            setSelectedLocationId(newId)
            setSortColumn('item_type')
            setSortDirection('asc')
            if (newId === '') {
              setRoomGroups([])
              setSelection({})
            }
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

      <div style={{ marginTop: 2 }}>
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
            {
              messages.bulkMove.selectedCount.replace(
                '{count}', String(selectionCount)
              ).replace(
                /\{plural\}/g, selectionCount === 1 ? '' : 's'
              )
            }
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {canDetachSelectedBases ? (
              <button
                type="button"
                onClick={handleDetachClick}
                disabled={detachDialogLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: 6,
                  cursor: detachDialogLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {messages.bulkMove.detachButton}
              </button>
            ) : null}
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

      <DeleteConfirmation
        open={detachDialogOpen}
        title={messages.bulkMove.dialogs.detachSelection.title}
        messagePrefix={messages.bulkMove.dialogs.detachSelection.messagePrefix}
        entities={detachEntities}
        confirmLabel={messages.bulkMove.detachButton}
        cancelLabel={messages.deleteConfirmation.actions.cancel}
        loading={detachDialogLoading}
        onCancel={() => {
          setDetachDialogOpen(false)
          setDetachEntities([])
          setDetachBaseIds([])
        }}
        onConfirm={async () => {
          await detachSelectedBases()
        }}
      />
    </div>
  )
}

