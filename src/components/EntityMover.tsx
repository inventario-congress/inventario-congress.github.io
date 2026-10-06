import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type LocationChoice = {
  id: number
  name: string
}

type RoomChoice = {
  room_id: number
  room_name: string
}

type MoveDialogStrings = {
  title: string
  searchLabel: string
  searchPlaceholder: string
  roomLabel: string
  returnDateLabel: string
  roomSearchPlaceholder: string
  roomsNoneAssociated: string
  moveDisabledReason: string
  empty: string
  returnDateMustBeFuture: string
  returnDateMustChange: string
}

type BulkItem = {
  entityId: number
  entityType: 'base' | 'combo' | 'console'
}

type EntityMoverProps = {
  messages: Messages
  canWrite: boolean
  open: boolean
  entityId?: number | null
  entityType?: 'base' | 'combo' | 'console'
  items?: BulkItem[] | null
  locationId: number | null
  roomId: number | null
  latestReturnDate?: string | null
  dialogStrings: MoveDialogStrings
  onClose: () => void
  onMoved: () => Promise<void> | void
}

export default function EntityMover({ messages, canWrite, open, entityId, entityType, items, locationId, roomId, latestReturnDate, dialogStrings, onClose, onMoved }: EntityMoverProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locations, setLocations] = useState<LocationChoice[]>([])

  const [roomsLoading, setRoomsLoading] = useState(false)
  const [rooms, setRooms] = useState<RoomChoice[]>([])

  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('')
  const [selectedRoomId, setSelectedRoomId] = useState<number | ''>('')
  const [returnDate, setReturnDate] = useState('')

  const close = useCallback(() => {
    if (loading) return
    setError(null)
    setLoading(false)
    setLocations([])
    setRooms([])
    setLocationsLoading(false)
    setRoomsLoading(false)
    setSelectedLocationId('')
    setSelectedRoomId('')
    setReturnDate('')
    onClose()
  }, [loading, onClose])

  const loadLocations = useCallback(
    async (isActive: () => boolean) => {
      if (!supabase) return
      if (!isActive()) return


      setLocationsLoading(true)
      setError(null)

      const { data, error: locError } = await supabase
        .from('location')
        .select('id, name')
        .order('name', { ascending: true })

      if (!isActive()) return

      if (locError) {
        setError(locError.message)
        setLocations([])
        setLocationsLoading(false)
        return
      }

      const mapped: LocationChoice[] = (data ?? []).map((l) => ({
        id: l.id as number,
        name: l.name as string,
      }))

      if (!isActive()) return

      setLocations(mapped)
      setLocationsLoading(false)
    },
    []
  )




  const loadRoomsForLocation = useCallback(
    async (locationId: number, isActive: () => boolean) => {
      if (!supabase) return
      if (!isActive()) return

      setRoomsLoading(true)
      setError(null)

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_rooms_for_location', { p_location_id: locationId })
      if (!isActive()) return

      if (rpcError) {
        setError(rpcError.message)
        setRooms([])
        setSelectedRoomId('')
        setRoomsLoading(false)
        return
      }

      const mapped: RoomChoice[] = (rpcData as RoomChoice[]).sort((a, b) => a.room_name.localeCompare(b.room_name))
      if (!isActive()) return

      setRooms(mapped)
      setRoomsLoading(false)
    },
    []
  )



  useEffect(() => {
    if (!open) return
    if (!canWrite) return

    let active = true

    // Reset before kicking off async work; schedule on a microtask to avoid the lint rule.
    queueMicrotask(() => {
      if (!active) return
      setError(null)
      setSelectedLocationId(typeof locationId === 'number' ? locationId : '')
      setSelectedRoomId(typeof locationId === 'number' && typeof roomId === 'number' ? roomId : '')
      setReturnDate(latestReturnDate ?? '')
      setRooms([])
    })

    queueMicrotask(() => {
      if (!active) return
      void loadLocations(() => active)
    })

    return () => {
      active = false
    }
  }, [canWrite, latestReturnDate, loadLocations, locationId, open, roomId])



  useEffect(() => {
    if (!open) return
    if (!canWrite) return

    let active = true

    queueMicrotask(() => {
      if (!active) return
      if (selectedLocationId === '' || typeof selectedLocationId !== 'number') {
        setRooms([])
      }
    })

    if (selectedLocationId !== '' && typeof selectedLocationId === 'number') {
      queueMicrotask(() => {
        if (!active) return
        void loadRoomsForLocation(selectedLocationId, () => active)
      })
    }

    return () => {
      active = false
    }
  }, [canWrite, loadRoomsForLocation, open, selectedLocationId])

  const activeItems = useMemo(() => {
    // If `items` is provided (bulk mode), use it; otherwise fall back to single entity.
    if (items && items.length > 0) return items
    if (entityId && entityType) return [{ entityId, entityType }]
    return []
  }, [items, entityId, entityType])
  const isBulkMove = Boolean(items && items.length > 0)
  const hasChanges =
    selectedLocationId !== (typeof locationId === 'number' ? locationId : '') ||
    selectedRoomId !== (typeof locationId === 'number' && typeof roomId === 'number' ? roomId : '') ||
    returnDate !== (isBulkMove ? '' : latestReturnDate ?? '')

  const submitDisabled = useMemo(() => {
    if (!canWrite) return true
    if (!supabase) return true
    if (activeItems.length === 0) return true
    if (loading) return true
    if (locationsLoading || roomsLoading) return true
    if (selectedLocationId === '' || selectedRoomId === '') return true
    if (!hasChanges) return true
    return false
  }, [activeItems, canWrite, hasChanges, locationsLoading, loading, roomsLoading, selectedLocationId, selectedRoomId])

  const handleSubmit = useCallback(async () => {
    if (!supabase) return
    if (!canWrite) return
    if (activeItems.length === 0) return
    if (selectedLocationId === '' || selectedRoomId === '') return

    setError(null)
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const userId = session?.user?.id
      if (!userId) {
        throw new Error(messages.microphones.feedback.authRequired)
      }

      if (!isBulkMove) {
        const today = new Date()
        const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        if (returnDate && returnDate <= todayDate) {
          throw new Error(dialogStrings.returnDateMustBeFuture)
        }

        const latestMovements = new Map<string, { location: number; room: number; return_date: string | null }>()
        const baseIds = activeItems.filter((item) => item.entityType === 'base').map((item) => item.entityId)

        if (baseIds.length > 0) {
          let offset = 0
          while (true) {
            const { data, error: movementError } = await supabase
              .from('movement')
              .select('id, base, location, room, return_date')
              .in('base', baseIds)
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .range(offset, offset + 999)

            if (movementError) throw movementError

            for (const movement of data ?? []) {
              const key = `base:${movement.base}`
              if (!latestMovements.has(key)) {
                latestMovements.set(key, {
                  location: movement.location,
                  room: movement.room,
                  return_date: movement.return_date,
                })
              }
            }

            if (baseIds.every((id) => latestMovements.has(`base:${id}`)) || (data?.length ?? 0) < 1000) break
            offset += data.length
          }
        }

        for (const column of ['combo', 'console'] as const) {
          const ids = activeItems.filter((item) => item.entityType === column).map((item) => item.entityId)
          if (ids.length === 0) continue

          let offset = 0
          while (true) {
            const { data, error: movementError } = await supabase
              .from('movement')
              .select(`id, ${column}, location, room, return_date`)
              .in(column, ids)
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .range(offset, offset + 999)

            if (movementError) throw movementError

            for (const movement of data ?? []) {
              const key = `${column}:${(movement as unknown as Record<string, number>)[column]}`
              if (!latestMovements.has(key)) {
                latestMovements.set(key, {
                  location: movement.location,
                  room: movement.room,
                  return_date: movement.return_date,
                })
              }
            }

            if (ids.every((id) => latestMovements.has(`${column}:${id}`)) || (data?.length ?? 0) < 1000) break
            offset += data.length
          }
        }

        for (const item of activeItems) {
          const key = `${item.entityType}:${item.entityId}`
          const latestMovement = latestMovements.get(key)
          if (
            latestMovement &&
            latestMovement.location === selectedLocationId &&
            latestMovement.room === selectedRoomId &&
            latestMovement.return_date !== null &&
            (!returnDate || returnDate === latestMovement.return_date)
          ) {
            throw new Error(dialogStrings.returnDateMustChange)
          }
        }
      }

      const payloads: Record<string, number | string>[] = activeItems.map((item) => {
        const payload: Record<string, number | string> = {
          location: selectedLocationId,
          room: selectedRoomId,
          user: userId,
        }

        if (!isBulkMove && returnDate) payload.return_date = returnDate

        if (item.entityType === 'base') {
          payload.base = item.entityId
        } else if (item.entityType === 'console') {
          payload.console = item.entityId
        } else {
          payload.combo = item.entityId
        }

        return payload
      })

      const { error: createError } = await supabase.from('movement').insert(payloads)
      if (createError) throw createError

      await onMoved()
      close()
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bases.feedback.loadFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [activeItems, canWrite, close, dialogStrings.returnDateMustBeFuture, dialogStrings.returnDateMustChange, isBulkMove, messages.microphones.feedback.authRequired, onMoved, returnDate, selectedLocationId, selectedRoomId, messages.bases.feedback.loadFailed])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dialogStrings.title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: 'var(--shadow)',
          textAlign: 'left',
          padding: 16,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0' }}>{dialogStrings.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => close()}
            aria-label={messages.menu.close}
            disabled={loading}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
          style={{ display: 'grid', gap: 10, marginTop: 14 }}
        >
          <label htmlFor="entity-mover-location" style={{ textAlign: 'left' }}>
            {dialogStrings.searchLabel}
          </label>

          <select
            id="entity-mover-location"
            value={selectedLocationId}
            onChange={(e) => {
              const value = e.target.value
              setSelectedLocationId(value === '' ? '' : Number.parseInt(value, 10))
              setSelectedRoomId('')
            }}
            disabled={loading || locationsLoading || locations.length === 0}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          >
          <option value="">{dialogStrings.searchPlaceholder}</option>

            {locations.length === 0 ? (
              <option value="" disabled>
                {dialogStrings.empty}
              </option>
            ) : (
              locations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>

          <label htmlFor="entity-mover-room" style={{ textAlign: 'left' }}>
            {dialogStrings.roomLabel}
          </label>

          <select
            id="entity-mover-room"
            value={selectedRoomId}
            onChange={(e) => {
              const value = e.target.value
              setSelectedRoomId(value === '' ? '' : Number.parseInt(value, 10))
            }}
            disabled={loading || roomsLoading || selectedLocationId === '' || rooms.length === 0}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          >
            <option value="">{dialogStrings.roomSearchPlaceholder}</option>

            {rooms.length === 0 ? (
              <option value="" disabled>
                {dialogStrings.roomsNoneAssociated}
              </option>
            ) : (
              rooms.map((r) => (
                <option key={r.room_id} value={r.room_id}>
                  {r.room_name}
                </option>
              ))
            )}
          </select>

          {!isBulkMove ? (
            <>
              <label htmlFor="entity-mover-return-date" style={{ textAlign: 'left' }}>
                {dialogStrings.returnDateLabel}
              </label>

              <input
                id="entity-mover-return-date"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker()
                  } catch {
                    // showPicker can throw when unsupported; native behavior remains.
                  }
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              />
            </>
          ) : null}

          {error ? (
            <div style={{ color: 'crimson' }}>
              <strong>{messages.auth.feedback.error}</strong> {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <button
              type="button"
              onClick={close}
              disabled={loading}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.bases.actions.cancelMove}
            </button>
            <button type="submit" disabled={submitDisabled} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
              {loading ? messages.bases.actions.move + '...' : messages.bases.actions.move}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
