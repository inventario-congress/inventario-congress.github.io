import { useCallback, useEffect, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type CountableAdderProps = {
  messages: Messages
  canWrite: boolean
  countableId: number
  countableName: string
  targetRoomId: number
  onClose: () => void
  onAdded: () => Promise<void> | void
}

type TargetRoom = {
  name: string
  location: { name: string } | null
}

export default function CountableAdder({ messages, canWrite, countableId, countableName, targetRoomId, onClose, onAdded }: CountableAdderProps) {
  const strings = messages.countables.dialogs.adder
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetLabel, setTargetLabel] = useState('')
  const [quantity, setQuantity] = useState('')

  useEffect(() => {
    if (!supabase || !canWrite) return

    let active = true

    void (async () => {
      try {
        const { data, error: roomError } = await supabase
          .from('room')
          .select('name, location(name)')
          .eq('id', targetRoomId)
          .single()

        if (roomError) throw roomError
        if (!active) return
        const room = data as unknown as TargetRoom
        setTargetLabel(room.location ? `${room.location.name}, ${room.name}` : room.name)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : strings.feedback.loadFailed)
      }
    })()

    return () => {
      active = false
    }
  }, [canWrite, strings.feedback.loadFailed, targetRoomId])

  const parsedQuantity = Number(quantity)
  const quantityIsValid = Number.isInteger(parsedQuantity) && parsedQuantity > 0
  const submitDisabled = !canWrite || !supabase || loading || !targetLabel || !quantityIsValid

  const handleSubmit = useCallback(async () => {
    if (!supabase || !canWrite || !quantityIsValid) return

    setLoading(true)
    setError(null)

    try {
      const { error: movementError } = await supabase
        .from('countable_movement')
        .insert({
          countable: countableId,
          from_room: null,
          to_room: targetRoomId,
          quantity: parsedQuantity,
        })

      if (movementError) throw movementError

      await onAdded()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.feedback.addFailed)
    } finally {
      setLoading(false)
    }
  }, [canWrite, countableId, onAdded, onClose, parsedQuantity, quantityIsValid, strings.feedback.addFailed, targetRoomId])

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
          <div>
            {strings.addedTo}: <strong>{targetLabel || messages.menu.loading}</strong>
          </div>

          <label htmlFor="countable-adder-quantity">{strings.fields.quantity}</label>
          <input
            id="countable-adder-quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={loading}
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
          />

          {error ? <div style={{ color: 'crimson' }}><strong>{messages.auth.feedback.error}</strong> {error}</div> : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={loading} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
              {strings.actions.cancel}
            </button>
            <button type="submit" disabled={submitDisabled} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
              {loading ? `${strings.actions.add}...` : strings.actions.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
