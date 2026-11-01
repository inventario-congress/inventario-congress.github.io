import SortIcon from './SortIcon'
import type { MicAttachment, MicSortColumn } from './microphoneSorting'

export default function MicrophoneTable({
  mics,
  availableSlots,
  canWrite,
  sortColumn,
  sortDirection,
  labels,
  onSort,
  onDetach,
  onAttach,
  formatDateTime,
}: {
  mics: MicAttachment[]
  availableSlots: number
  canWrite: boolean
  sortColumn: MicSortColumn
  sortDirection: 'asc' | 'desc'
  labels: { identifier: string; type: string; date: string; user: string; available: string }
  onSort: (column: MicSortColumn) => void
  onDetach: (mic: MicAttachment) => void
  onAttach: () => void
  formatDateTime: (value: string | null) => [string, string]
}) {
  function renderHeader(label: string, column: MicSortColumn, nowrap = false) {
    return (
      <th
        onClick={() => onSort(column)}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          textAlign: 'left',
          borderBottom: '1px solid var(--border)',
          padding: '6px 4px',
          whiteSpace: nowrap ? 'nowrap' : undefined,
          background: 'var(--table-header-bg)',
        }}
      >
        {label}
        <SortIcon active={sortColumn === column} sortDirection={sortDirection} />
      </th>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
      <thead>
        <tr>
          {renderHeader(labels.identifier, 'mic_identifier', true)}
          {renderHeader(labels.type, 'mic_type_name')}
          {renderHeader(labels.date, 'mic_attachment_date', true)}
          {renderHeader(labels.user, 'mic_attachment_user_name')}
        </tr>
      </thead>
      <tbody>
        {mics.map((mic) => (
          <tr
            key={mic.mic_id}
            onClick={() => {
              if (canWrite) onDetach(mic)
            }}
            style={{ cursor: canWrite ? 'pointer' : undefined }}
          >
            <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px', whiteSpace: 'nowrap' }}>
              {mic.mic_identifier}
            </td>
            <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
              {mic.mic_type_name}
            </td>
            <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px', whiteSpace: 'nowrap' }}>
              {(() => {
                const [datePart, timePart] = formatDateTime(mic.mic_attachment_date)
                return (
                  <>
                    <div>{datePart}</div>
                    <div>{timePart}</div>
                  </>
                )
              })()}
            </td>
            <td style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
              {mic.mic_attachment_user_name ?? ''}
            </td>
          </tr>
        ))}

        {Array.from({ length: availableSlots }).map((_, index) => (
          <tr
            key={`available-${index}`}
            onClick={() => {
              if (canWrite) onAttach()
            }}
            style={{ cursor: canWrite ? 'pointer' : undefined }}
          >
            <td
              colSpan={4}
              style={{
                fontSize: 14,
                borderBottom: '1px solid var(--border)',
                padding: '6px 4px',
                fontStyle: 'italic',
                color: 'var(--muted)',
              }}
            >
              {'<' + labels.available + '>'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
