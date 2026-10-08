import type { DeleteEntityDescriptor } from '../DeleteConfirmation'

// An extra action offered in BulkMovePanel when the whole selection is of one item type.
export type BulkSelectionAction = {
  itemType: string
  label: string
  dialogTitle: string
  dialogMessagePrefix: string
  failedMessage: string
  // Returns the entities the user must confirm; throws if the action is not applicable.
  prepare: (ids: number[]) => Promise<DeleteEntityDescriptor[]>
  execute: (ids: number[]) => Promise<void>
}
