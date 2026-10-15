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

type SourceRoomChoice = {
  id: number
  name: string
  quantity: number
}

type CountableMoverProps = {
  messages: Messages
  canWrite: boolean
  countableId: number
  countableName: string
  onClose: () => void
  onMoved: () => Promise<void> | void
}

export default function CountableMover({ messages, canWrite, countableId, countableName, onClose, onMoved }: CountableMoverProps) {
  const strings = messages.countables.dialogs.mover
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceRooms, setSourceRooms] = useState<SourceRoomChoice[]>([])
  const [locations, setLocations] = useState<LocationChoice[]>([])
  const [targetRooms, setTargetRooms] = useState<RoomChoice[]>([])
  const [selectedFromRoomId, setSelectedFromRoomId] = useState<number | ''>('')
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('')
  const [selectedToRoomId, setSelectedToRoomId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('')
  const [returnDate, setReturnDate] = useState('')

  useEffect(() => {
    if (!supabase || !canWrite) {
      setInitialLoading(false)
      return
    }

    let active = true
    setInitialLoading(true)
    setError(null)

    void (async () => {
      try {
        const [{ data: allocationData, error: allocationError }, { data: locationData, error: locationError }] = await Promise.all([
          supabase
            .from('countable_location')
            .select('room, quantity')
            .eq('countable', countableId)
            .gt('quantity', 0),
          supabase
            .from('location')
            .select('id, name')
            .order('name', { ascending: true }),
        ])

        if (allocationError) throw allocationError
        if (locationError) throw locationError
        if (!active) return

        const allocations = (allocationData ?? []).map((allocation) => ({
          id: allocation.room as number,
          quantity: allocation.quantity as number,
        }))
        const roomIds = allocations.map((allocation) => allocation.id)
        const roomsById = new Map<number, string>()
        const locationNamesByRoom = new Map<number, string[]>()

        if (roomIds.length > 0) {
          const { data: roomData, error: roomError } = await supabase
            .from('room')
            .select('id, name')
            .in('id', roomIds)

          if (roomError) throw roomError

          for (const room of roomData ?? []) {
            roomsById.set(room.id as number, room.name as string)
          }

          const { data: locationRoomData, error: locationRoomError } = await supabase
            .from('location_rooms')
            .select('room, location')
            .in('room', roomIds)

          if (locationRoomError) throw locationRoomError

          const locationIds = [...new Set((locationRoomData ?? []).map((entry) => entry.location as number))]
          if (locationIds.length > 0) {
            const { data: associatedLocations, error: associatedLocationsError } = await supabase
              .from('location')
              .select('id, name')
              .in('id', locationIds)

            if (associatedLocationsError) throw associatedLocationsError

            const namesById = new Map<number, string>()
            for (const location of associatedLocations ?? []) {
              namesById.set(location.id as number, location.name as string)
            }
            for (const entry of locationRoomData ?? []) {
              const locationName = namesById.get(entry.location as number)
              if (!locationName) continue
              const names = locationNamesByRoom.get(entry.room as number) ?? []
              names.push(locationName)
              locationNamesByRoom.set(entry.room as number, names)
            }
          }
        }

        if (!active) return
        setSourceRooms(
          allocations
            .flatMap((allocation) => {
              const roomName = roomsById.get(allocation.id)
              if (!roomName) return []
              const locationName = locationNamesByRoom.get(allocation.id)?.sort((a, b) => a.localeCompare(b))[0]
              return [{
                id: allocation.id,
                name: locationName ? `${locationName} - ${roomName}` : roomName,
                quantity: allocation.quantity,
              }]
            })
            .sort((a, b) => a.name.localeCompare(b.name))
        )
        setLocations((locationData ?? []).map((location) => ({
          id: location.id as number,
          name: location.name as string,
        })))
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : strings.feedback.loadFailed)
      } finally {
        if (active) setInitialLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [canWrite, countableId, strings.feedback.loadFailed])

  useEffect(() => {
    if (!supabase || !canWrite || selectedLocationId === '') {
      setTargetRooms([])
      setRoomsLoading(false)
      return
    }

    let active = true
    setRoomsLoading(true)
    setError(null)

    void supabase
      .rpc('get_rooms_for_location', { p_location_id: selectedLocationId })
      .then(({ data, error: roomsError }) => {
        if (!active) return
        if (roomsError) throw roomsError
        setTargetRooms(((data ?? []) as RoomChoice[]).sort((a, b) => a.room_name.localeCompare(b.room_name)))
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : strings.feedback.loadFailed)
        setTargetRooms([])
      })
      .finally(() => {
        if (active) setRoomsLoading(false)
      })

    return () => {
      active = false
    }
  }, [canWrite, selectedLocationId, strings.feedback.loadFailed])

  const selectedSourceRoom = useMemo(
    () => sourceRooms.find((room) => room.id === selectedFromRoomId),
    [selectedFromRoomId, sourceRooms]
  )
  const parsedQuantity = Number(quantity)
  const quantityIsValid = Number.isInteger(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= (selectedSourceRoom?.quantity ?? 0)
  const submitDisabled =
    !canWrite ||
    !supabase ||
    loading ||
    initialLoading ||
    roomsLoading ||
    !selectedSourceRoom ||
    selectedLocationId === '' ||
    selectedToRoomId === '' ||
    selectedToRoomId === selectedFromRoomId ||
    !quantityIsValid

  const handleSubmit = useCallback(async () => {
    if (!supabase || !canWrite || !selectedSourceRoom || selectedLocationId === '' || selectedToRoomId === '' || !quantityIsValid) return

    setLoading(true)
    setError(null)

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!session?.user?.id) throw new Error(strings.feedback.authRequired)

      const today = new Date()
      const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      if (returnDate && returnDate <= todayDate) throw new Error(strings.feedback.returnDateMustBeFuture)

      const { error: movementError } = await supabase
        .from('countable_movement')
        .insert({
          countable: countableId,
          from_room: selectedSourceRoom.id,
          to_room: selectedToRoomId,
          quantity: parsedQuantity,
          return_date: returnDate || null,
        })

      if (movementError) throw movementError

      await onMoved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.feedback.moveFailed)
    } finally {
      setLoading(false)
    }
  }, [canWrite, countableId, onClose, onMoved, parsedQuantity, quantityIsValid, returnDate, selectedLocationId, selectedSourceRoom, selectedToRoomId, strings.feedback.authRequired, strings.feedback.moveFailed, strings.feedback.returnDateMustBeFuture])

  if (!canWrite) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={strings.title}
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
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
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
          <h3 style={{ margin: '0 0 6px 0' }}>{strings.title} {countableName}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={messages.menu.close}
            disabled={loading}
            style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
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
          <label htmlFor="countable-mover-from-room">{strings.fields.fromRoom}</label>
          <select
            id="countable-mover-from-room"
            value={selectedFromRoomId}
            onChange={(e) => {
              const value = e.target.value
              const roomId = value === '' ? '' : Number.parseInt(value, 10)
              const room = sourceRooms.find((choice) => choice.id === roomId)
              setSelectedFromRoomId(roomId)
              setQuantity(room ? String(room.quantity) : '')
              if (roomId === selectedToRoomId) setSelectedToRoomId('')
            }}
            disabled={loading || initialLoading || sourceRooms.length === 0}
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="">{initialLoading ? messages.menu.loading : strings.placeholders.fromRoom}</option>
            {sourceRooms.length === 0 ? <option value="" disabled>{strings.feedback.noSourceRooms}</option> : sourceRooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name} ({room.quantity})</option>
            ))}
          </select>

          <label htmlFor="countable-mover-location">{strings.fields.location}</label>
          <select
            id="countable-mover-location"
            value={selectedLocationId}
            onChange={(e) => {
              const value = e.target.value
              setSelectedLocationId(value === '' ? '' : Number.parseInt(value, 10))
              setSelectedToRoomId('')
              setTargetRooms([])
            }}
            disabled={loading || initialLoading || locations.length === 0}
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="">{strings.placeholders.location}</option>
            {locations.length === 0 ? <option value="" disabled>{strings.feedback.noLocations}</option> : locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>

          <label htmlFor="countable-mover-to-room">{strings.fields.toRoom}</label>
          <select
            id="countable-mover-to-room"
            value={selectedToRoomId}
            onChange={(e) => {
              const value = e.target.value
              setSelectedToRoomId(value === '' ? '' : Number.parseInt(value, 10))
            }}
            disabled={loading || roomsLoading || selectedLocationId === '' || targetRooms.length === 0}
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="">{strings.placeholders.toRoom}</option>
            {targetRooms.length === 0 ? <option value="" disabled>{strings.feedback.noTargetRooms}</option> : targetRooms.map((room) => (
              <option key={room.room_id} value={room.room_id} disabled={room.room_id === selectedFromRoomId}>{room.room_name}</option>
            ))}
          </select>

          <label htmlFor="countable-mover-quantity">{strings.fields.quantity}</label>
          <input
            id="countable-mover-quantity"
            type="number"
            min={1}
            max={selectedSourceRoom?.quantity}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={loading || !selectedSourceRoom}
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
          />

          <label htmlFor="countable-mover-return-date">{strings.fields.returnDate}</label>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
            <input
              id="countable-mover-return-date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker()
                } catch {
                  // Native date input behavior remains available if showPicker is unsupported.
                }
              }}
              disabled={loading}
              style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <button
              type="button"
              onClick={() => setReturnDate('')}
              disabled={loading || returnDate === ''}
              aria-label={strings.actions.clearReturnDate}
              title={strings.actions.clearReturnDate}
              style={{ width: 44, minWidth: 44, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading || returnDate === '' ? 'not-allowed' : 'pointer' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {error ? <div style={{ color: 'crimson' }}><strong>{messages.auth.feedback.error}</strong> {error}</div> : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={loading} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
              {messages.bases.actions.cancelMove}
            </button>
            <button type="submit" disabled={submitDisabled} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
              {loading ? `${messages.bases.actions.move}...` : messages.bases.actions.move}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
