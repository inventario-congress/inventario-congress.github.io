import type { ReactNode } from 'react'

import type { Messages } from '../../i18n'

// Minimum shape any movable entity must satisfy. Entity-specific fields extend this.
export type MovableRow = {
  id: number
  identifier: number
  model: string
  latest_location_room: string | null
  latest_location_id: number | null
  latest_room_id: number | null
  latest_return_date: string | null
}

export type ExtraColumn<T extends MovableRow> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  // Omit to make the column non-sortable.
  sortValue?: (row: T) => string | number | null
}

export type ExtraField = {
  key: string
  label: string
  type: 'text' | 'number'
}

type WidenStrings<T> = T extends string ? string : { -readonly [K in keyof T]: WidenStrings<T[K]> }

export type MovableStrings = WidenStrings<Omit<Messages['combos'], 'dialogs'> & {
  dialogs: { editor: Messages['combos']['dialogs']['editor'] }
}>

export type MoveDialogStrings = WidenStrings<Messages['combos']['dialogs']['moveCombo']>
