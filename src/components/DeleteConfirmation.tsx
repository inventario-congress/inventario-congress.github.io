import { useEffect, useMemo, useState } from 'react'

export type DeleteEntityDescriptor = {
  id: number | string
  name?: string | null
  identifier?: string | number | null
  // Optional secondary display value (e.g., microphone "Model #123")
  secondary?: string | null
}

type DeleteConfirmationProps = {
  open: boolean
  title: string
  messagePrefix: string
  entities: DeleteEntityDescriptor[]
  confirmLabel: string
  cancelLabel: string
  loading?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function formatEntityForDisplay(entity: DeleteEntityDescriptor): string {
  const maybeName = (entity.name ?? '').toString().trim()
  if (maybeName) return maybeName

  const maybeIdentifier = (entity.identifier ?? '').toString().trim()
  if (maybeIdentifier) {
    const secondary = (entity.secondary ?? '').toString().trim()
    return secondary ? `${maybeIdentifier} (${secondary})` : maybeIdentifier
  }

  return String(entity.id)
}

export default function DeleteConfirmation({
  open,
  title,
  messagePrefix,
  entities,
  confirmLabel,
  cancelLabel,
  loading,
  confirmDisabled,
  onConfirm,
  onCancel,
}: DeleteConfirmationProps) {
  const [hasInteracted, setHasInteracted] = useState(false)

  useEffect(() => {
    if (!open) {
      setHasInteracted(false)
    }
  }, [open])

  const items = useMemo(() => entities.map(formatEntityForDisplay), [entities])

  // Very small accessibility improvement: focus cancel when the dialog opens.
  useEffect(() => {
    if (!open) return
    const el = document.querySelector<HTMLButtonElement>('[data-delete-confirmation="cancel"]')
    el?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
      onMouseDown={(e) => {
        // Clicking the overlay should cancel (but avoid cancel on clicks inside dialog)
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 16,
          background: 'var(--bg)',
          color: 'var(--text)',
          width: '100%',
          maxWidth: 520,
          textAlign: 'left',
          boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h4 style={{ margin: '0 0 10px' }}>{title}</h4>

        <div style={{ marginBottom: 12, opacity: 0.95 }}>
          {messagePrefix}
          {items.length > 0 ? ':' : null}
        </div>

        {items.length > 0 ? (
          <ul style={{ margin: '0 0 14px 18px', padding: 0 }}>
            {items.map((it, idx) => (
              <li key={`${it}-${idx}`} style={{ marginBottom: 4 }}>
                {it}
              </li>
            ))}
          </ul>
        ) : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            data-delete-confirmation="cancel"
            onClick={() => {
              setHasInteracted(true)
              onCancel()
            }}
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              setHasInteracted(true)
              onConfirm()
            }}
            disabled={Boolean(loading) || Boolean(confirmDisabled) || items.length === 0}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            aria-disabled={Boolean(loading) || Boolean(confirmDisabled) || items.length === 0}
          >
            {confirmLabel}
          </button>
        </div>

        {/* Keep this for potential future validation UI; avoids empty fragment warnings. */}
        {hasInteracted ? null : null}
      </div>
    </div>
  )
}

