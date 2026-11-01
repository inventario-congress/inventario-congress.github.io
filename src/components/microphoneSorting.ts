export type MicAttachment = {
  mic_id: number
  mic_identifier: number
  mic_model_name: string
  mic_type_name: string
  mic_attachment_date: string | null
  mic_attachment_user_name: string | null
}

export type MicSortColumn =
  | 'mic_identifier'
  | 'mic_type_name'
  | 'mic_attachment_date'
  | 'mic_attachment_user_name'

function compareNullableDates(a: string | null, b: string | null, dirMul: number): number {
  const at = a ? new Date(a).getTime() : Number.NaN
  const bt = b ? new Date(b).getTime() : Number.NaN
  const validAt = Number.isNaN(at) ? null : at
  const validBt = Number.isNaN(bt) ? null : bt

  if (validAt === null && validBt === null) return 0
  if (validAt === null) return 1 * dirMul
  if (validBt === null) return -1 * dirMul
  return (validAt - validBt) * dirMul
}

function compareNullableStrings(a: string | null, b: string | null, dirMul: number): number {
  return (a ?? '').localeCompare(b ?? '') * dirMul
}

export function sortMicrophones(
  mics: MicAttachment[],
  sortColumn: MicSortColumn,
  sortDirection: 'asc' | 'desc'
): MicAttachment[] {
  const copy = [...mics]
  const dirMul = sortDirection === 'asc' ? 1 : -1

  copy.sort((a, b) => {
    switch (sortColumn) {
      case 'mic_identifier':
        return (a.mic_identifier - b.mic_identifier) * dirMul
      case 'mic_type_name':
        return compareNullableStrings(a.mic_type_name, b.mic_type_name, dirMul)
      case 'mic_attachment_date':
        return compareNullableDates(a.mic_attachment_date, b.mic_attachment_date, dirMul)
      case 'mic_attachment_user_name':
        return compareNullableStrings(a.mic_attachment_user_name, b.mic_attachment_user_name, dirMul)
    }
  })

  return copy
}
