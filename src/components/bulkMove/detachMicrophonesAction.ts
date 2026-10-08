import type { Messages } from '../../i18n'
import { supabase } from '../../supabaseClient'
import type { BulkSelectionAction } from './types'

type AttachedMic = {
  microphone: Array<{ id: number; identifier: number }> | null
}

export function createDetachMicrophonesAction(messages: Messages): BulkSelectionAction {
  return {
    itemType: 'base',
    label: messages.bulkMove.detachButton,
    dialogTitle: messages.bulkMove.dialogs.detachSelection.title,
    dialogMessagePrefix: messages.bulkMove.dialogs.detachSelection.messagePrefix,
    failedMessage: messages.bulkMove.feedback.detachFailed,

    async prepare(baseIds) {
      if (!supabase) return []

      const { data, error } = await supabase
        .from('attachment')
        .select('microphone:microphone(id, identifier)')
        .in('base', baseIds)
        .eq('is_active', true)

      if (error) throw error

      const microphones = ((data ?? []) as AttachedMic[]).flatMap((row) => row.microphone ?? [])
      if (microphones.length === 0) {
        throw new Error(messages.bulkMove.feedback.noMicrophonesToDetach)
      }

      return microphones
        .map((row) => ({ id: row.id, identifier: row.identifier }))
        .filter((entity, index, arr) => arr.findIndex((candidate) => candidate.id === entity.id) === index)
        .sort((a, b) => a.identifier - b.identifier)
    },

    async execute(baseIds) {
      if (!supabase) return

      const { error } = await supabase
        .from('attachment')
        .update({ is_active: false })
        .in('base', baseIds)
        .eq('is_active', true)

      if (error) throw error
    },
  }
}
