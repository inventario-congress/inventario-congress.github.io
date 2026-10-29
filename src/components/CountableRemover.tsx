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

type SourceRoom = {
  id: number
  label: string
  quantity: number
}

type CountableRemoverProps = {
  messages: Messages
  canWrite: boolean
  countableId: number
  countableName: string
  onClose: () => void
  onRemoved: (countableDeleted: boolean) => Promise<void> | void
}

export default function CountableRemover({ messages, canWrite, countableId, countableName, onClose, onRemoved }: CountableRemoverProps) {
  const strings = messages.countables.dialogs.remover
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(() => Boolean(supabase && canWrite))
  const [error, setError] = useState<string | null>(null)
  const [sourceRooms, setSourceRooms] = useState<SourceRoom[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('')
  const [confirming, setConfirming] = useState(false)

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

        const rooms: SourceRoom[] = []
        for (const location of (data ?? []) as LocationChoice[]) {
          for (const room of location.room) {
            const allocation = room.countable_quantity.find((item) => item.countable === countableId && item.quantity > 0)
            if (allocation) rooms.push({ id: room.id, label: `${location.name}, ${room.name}`, quantity: allocation.quantity })
          }
        }
        setSourceRooms(rooms)
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

  const selectedRoom = sourceRooms.find((room) => room.id === selectedRoomId)
  const parsedQuantity = Number(quantity)
  const quantityIsValid = Number.isInteger(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= (selectedRoom?.quantity ?? 0)
  const submitDisabled = !canWrite || !supabase || loading || initialLoading || !selectedRoom || !quantityIsValid

  // The countable is deleted by a database trigger once no room holds any quantity.
  const totalQuantity = sourceRooms.reduce((sum, room) => sum + room.quantity, 0)
  const willDeleteCountable = quantityIsValid && parsedQuantity === totalQuantity

  const performRemoval = useCallback(async () => {
    if (!supabase || !canWrite || selectedRoomId === '' || !quantityIsValid) return

    setLoading(true)
    setError(null)

    try {
      const { error: movementError } = await supabase
        .from('countable_movement')
        .insert({
          countable: countableId,
          from_room: selectedRoomId,
          to_room: null,
          quantity: parsedQuantity,
        })

      if (movementError) throw movementError

      await onRemoved(willDeleteCountable)
      onClose()
    } catch (e) {
      setConfirming(false)
      setError(e instanceof Error ? e.message : strings.feedback.removeFailed)
    } finally {
      setLoading(false)
    }
  }, [canWrite, countableId, onClose, onRemoved, parsedQuantity, quantityIsValid, selectedRoomId, strings.feedback.removeFailed, willDeleteCountable])

  if (!canWrite) return null

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 50,
  } as const

  const cardStyle = {
    width: '100%',
    maxWidth: 560,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: 'var(--shadow)',
    textAlign: 'left',
    padding: 16,
  } as const

  const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border)' } as const

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={strings.title}
        style={overlayStyle}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !loading) onClose()
        }}
      >
        <div style={cardStyle} onMouseDown={(e) => e.stopPropagation()}>
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
              if (willDeleteCountable) setConfirming(true)
              else void performRemoval()
            }}
            style={{ display: 'grid', gap: 10, marginTop: 14 }}
          >
            <label htmlFor="countable-remover-room">{strings.fields.room}</label>
            <select
              id="countable-remover-room"
              value={selectedRoomId}
              onChange={(e) => {
                const value = e.target.value
                setSelectedRoomId(value === '' ? '' : Number.parseInt(value, 10))
                setQuantity('')
              }}
              disabled={loading || initialLoading || sourceRooms.length === 0}
              style={fieldStyle}
            >
              <option value="">{initialLoading ? messages.menu.loading : strings.placeholders.room}</option>
              {!initialLoading && sourceRooms.length === 0 ? (
                <option value="" disabled>{strings.feedback.noSourceRooms}</option>
              ) : sourceRooms.map((room) => (
                <option key={room.id} value={room.id}>{room.label} ({room.quantity})</option>
              ))}
            </select>

            <label htmlFor="countable-remover-quantity">{strings.fields.quantity}</label>
            <input
              id="countable-remover-quantity"
              type="number"
              min={1}
              max={selectedRoom?.quantity}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={loading || !selectedRoom}
              style={fieldStyle}
            />

            {error ? <div style={{ color: 'crimson' }}><strong>{messages.auth.feedback.error}</strong> {error}</div> : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <button type="button" onClick={onClose} disabled={loading} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
                {strings.actions.cancel}
              </button>
              <button type="submit" disabled={submitDisabled} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
                {loading ? `${strings.actions.remove}...` : strings.actions.remove}
              </button>
            </div>
          </form>
        </div>
      </div>

      {confirming ? (
        <div role="alertdialog" aria-modal="true" aria-label={strings.confirm.title} style={{ ...overlayStyle, zIndex: 60 }}>
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 10px 0' }}>{strings.confirm.title}</h3>
            <p style={{ margin: 0 }}><strong>{countableName}</strong>: {strings.confirm.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <button type="button" onClick={() => setConfirming(false)} disabled={loading} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
                {strings.actions.cancel}
              </button>
              <button type="button" onClick={() => void performRemoval()} disabled={loading} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer', color: 'crimson' }}>
                {loading ? `${strings.actions.confirmDelete}...` : strings.actions.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
