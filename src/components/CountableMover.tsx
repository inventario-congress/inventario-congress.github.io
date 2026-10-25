import { useCallback, useEffect, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type LocationChoice = {
  id: number
  name: string
  room: {
    id: number
    name: string
    countable_quantity: {
      countable: number
      quantity: number
    }[]
  }[]
}

type SelectedSourceRoom = {
  id: number
  name: string
  quantity: number
}

function findSourceRoom(locations: LocationChoice[], countableId: number, roomId: number | ''): SelectedSourceRoom | undefined {
  for (const location of locations) {
    const room = location.room.find((candidate) => candidate.id === roomId)
    const allocation = room?.countable_quantity.find((quantity) => quantity.countable === countableId)
    if (room && allocation) {
      return {
        id: room.id,
        name: room.name,
        quantity: allocation.quantity,
      }
    }
  }
  return undefined
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
  const [initialLoading, setInitialLoading] = useState(() => Boolean(supabase && canWrite))
  const [error, setError] = useState<string | null>(null)
  const [locations, setLocations] = useState<LocationChoice[]>([])
  const [selectedFromRoomId, setSelectedFromRoomId] = useState<number | ''>('')
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('')
  const [selectedToRoomId, setSelectedToRoomId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('')
  const [returnDate, setReturnDate] = useState('')

  useEffect(() => {
    if (!supabase || !canWrite) return

    let active = true

    void (async () => {
      try {
        const { data, error: locationError } = await supabase
          .from('location')
          .select('id, name, room(id, name, countable_quantity(countable, quantity))')
          .eq('room.countable_quantity.countable', countableId)
          .gt('room.countable_quantity.quantity', 0)
          .order('name', { ascending: true })
          .order('name', { ascending: true, referencedTable: 'room' })

        if (locationError) throw locationError
        if (!active) return
        setLocations(data ?? [])
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

  const selectedSourceRoom = findSourceRoom(locations, countableId, selectedFromRoomId)
  const selectedLocation = locations.find((location) => location.id === selectedLocationId)
  const targetRooms = selectedLocation?.room ?? []
  const hasSourceRooms = locations.some((location) =>
    location.room.some((room) =>
      room.countable_quantity.some((allocation) => allocation.countable === countableId && allocation.quantity > 0)
    )
  )
  const parsedQuantity = Number(quantity)
  const quantityIsValid = Number.isInteger(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= (selectedSourceRoom?.quantity ?? 0)
  const submitDisabled =
    !canWrite ||
    !supabase ||
    loading ||
    initialLoading ||
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
          from_room: selectedFromRoomId,
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
  }, [canWrite, countableId, onClose, onMoved, parsedQuantity, quantityIsValid, returnDate, selectedFromRoomId, selectedLocationId, selectedSourceRoom, selectedToRoomId, strings.feedback.authRequired, strings.feedback.moveFailed, strings.feedback.returnDateMustBeFuture])

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
              const room = findSourceRoom(locations, countableId, roomId)
              setSelectedFromRoomId(roomId)
              setQuantity(room ? String(room.quantity) : '')
              if (roomId === selectedToRoomId) setSelectedToRoomId('')
            }}
            disabled={loading || initialLoading || !hasSourceRooms}
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="">{initialLoading ? messages.menu.loading : strings.placeholders.fromRoom}</option>
            {!hasSourceRooms ? (
              <option value="" disabled>{strings.feedback.noSourceRooms}</option>
            ) : locations.map((location) => location.room.map((room) => {
              const allocation = room.countable_quantity.find((item) => item.countable === countableId)
              if (!allocation) return null
              return (
                <option key={room.id} value={room.id}>
                  {location.name} - {room.name} ({allocation.quantity})
                </option>
              )
            }))}
          </select>

          <label htmlFor="countable-mover-location">{strings.fields.location}</label>
          <select
            id="countable-mover-location"
            value={selectedLocationId}
            onChange={(e) => {
              const value = e.target.value
              setSelectedLocationId(value === '' ? '' : Number.parseInt(value, 10))
              setSelectedToRoomId('')
              setError(null)
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
            disabled={loading || selectedLocationId === '' || targetRooms.length === 0}
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="">{strings.placeholders.toRoom}</option>
            {targetRooms.length === 0 ? <option value="" disabled>{strings.feedback.noTargetRooms}</option> : targetRooms.map((room) => (
              <option key={room.id} value={room.id} disabled={room.id === selectedFromRoomId}>{room.name}</option>
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
