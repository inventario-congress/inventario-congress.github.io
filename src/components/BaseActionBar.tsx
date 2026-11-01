function BaseActionButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
    >
      {children}
    </button>
  )
}

export default function BaseActionBar({
  labels,
  onMove,
  onDetach,
  onEdit,
  onDelete,
  moveDisabled,
  detachDisabled,
  editDisabled,
  deleteDisabled,
}: {
  labels: { move: string; detach: string; edit: string; delete: string }
  onMove: () => void
  onDetach: () => void
  onEdit: () => void
  onDelete: () => void
  moveDisabled: boolean
  detachDisabled: boolean
  editDisabled: boolean
  deleteDisabled: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <BaseActionButton onClick={onMove} disabled={moveDisabled}>
        {labels.move}
      </BaseActionButton>
      <BaseActionButton onClick={onDetach} disabled={detachDisabled}>
        {labels.detach}
      </BaseActionButton>
      <BaseActionButton onClick={onEdit} disabled={editDisabled}>
        {labels.edit}
      </BaseActionButton>
      <BaseActionButton onClick={onDelete} disabled={deleteDisabled}>
        {labels.delete}
      </BaseActionButton>
    </div>
  )
}
