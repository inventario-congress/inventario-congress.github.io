import type { DeleteEntityDescriptor } from '../DeleteConfirmation'

// An extra action offered when the whole selection is of one item type.
export type BulkSelectionAction = {
  itemType: string
  label: string
  dialogTitle: string
  dialogMessagePrefix: string
  failedMessage: string
  // Returns the entities the user must confirm; throws if the action is not applicable.
  prepare: (ids: number[]) => Promise<DeleteEntityDescriptor[]>
  // Cheap check (no row transfer) for whether execute would change anything.
  hasWork: (ids: number[]) => Promise<boolean>
  execute: (ids: number[]) => Promise<void>
}
