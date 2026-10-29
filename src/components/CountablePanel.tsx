import { useCallback, useEffect, useState, Fragment } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import CountableEditor from './CountableEditor'
import CountableMover from './CountableMover'
import CountableRemover from './CountableRemover'
import CountableAdder from './CountableAdder'

// Hard-coded id of the central warehouse room, where new and added countable quantities are stored.
const CENTRAL_WAREHOUSE_ROOM_ID = 110

type CountableRow = {
  id: number
  name: string
  quantity: number
}

type AllocationRow = {
  location: string
  room: string
  quantity: number
}

type CountablePanelProps = {
  messages: Messages
  canWrite: boolean
  categoryId: number
  categoryName: string
  onCategoriesChanged?: () => void
}

const headerCellStyle = {
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--table-header-bg)',
  padding: '8px 6px',
  whiteSpace: 'nowrap',
} as const

const cellStyle = { borderBottom: '1px solid var(--border)', padding: '8px 6px' } as const

export default function CountablePanel({ messages, canWrite, categoryId, categoryName, onCategoriesChanged }: CountablePanelProps) {
  const panelStrings = messages.countables.panel

  const [editorOpen, setEditorOpen] = useState(false)
  const [movingCountableId, setMovingCountableId] = useState<number | null>(null)
  const [removingCountableId, setRemovingCountableId] = useState<number | null>(null)
  const [addingCountableId, setAddingCountableId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countables, setCountables] = useState<CountableRow[]>([])
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [allocations, setAllocations] = useState<Record<number, AllocationRow[]>>({})

  const load = useCallback(async () => {
    if (!supabase) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: countablesError } = await supabase
        .rpc('get_category_countables', { p_category: categoryId })

      if (countablesError) throw countablesError

      setCountables(data as CountableRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : panelStrings.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [categoryId, panelStrings.feedback.loadFailed])

  const loadAllocations = useCallback(async (countableId: number) => {
    if (!supabase) return

    try {
      const { data, error: allocationsError } = await supabase
        .rpc('get_countable_allocations', { countable_id: countableId })

      if (allocationsError) throw allocationsError

      setAllocations(prev => {
        const newAllocations = {
          ...prev,
          [countableId]: data as AllocationRow[]
        }
        return newAllocations
      })
    } catch (e) {
      console.error('Failed to load allocations:', e)
    }
  }, [])

  const toggleRowExpansion = useCallback((id: number) => {
    const isExpanded = expandedRows.has(id)
    if (!isExpanded) {
      void loadAllocations(id)
    }

    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [expandedRows, loadAllocations])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
      <CountableEditor
        messages={messages}
        canWrite={canWrite}
        isOpen={editorOpen}
        initialCategoryId={categoryId}
        centralWarehouseRoomId={CENTRAL_WAREHOUSE_ROOM_ID}
        onClose={() => {
          setEditorOpen(false)
          void load()
        }}
        onSaved={() => {
          setError(null)
          void load()
        }}
        onCategoriesChanged={onCategoriesChanged}
      />

      {movingCountableId !== null ? (
        <CountableMover
          key={movingCountableId}
          messages={messages}
          canWrite={canWrite}
          countableId={movingCountableId}
          countableName={countables.find(c => c.id === movingCountableId)?.name ?? ''}
          onClose={() => setMovingCountableId(null)}
          onMoved={async () => {
            await loadAllocations(movingCountableId)
            await load()
          }}
        />
      ) : null}

      {removingCountableId !== null ? (
        <CountableRemover
          key={`remove-${removingCountableId}`}
          messages={messages}
          canWrite={canWrite}
          countableId={removingCountableId}
          countableName={countables.find(c => c.id === removingCountableId)?.name ?? ''}
          onClose={() => setRemovingCountableId(null)}
          onRemoved={async (countableDeleted) => {
            const id = removingCountableId
            await load()
            if (countableDeleted) {
              // The category may have been deleted along with its last countable.
              onCategoriesChanged?.()
            } else {
              await loadAllocations(id)
            }
          }}
        />
      ) : null}

      {addingCountableId !== null ? (
        <CountableAdder
          key={`add-${addingCountableId}`}
          messages={messages}
          canWrite={canWrite}
          countableId={addingCountableId}
          countableName={countables.find(c => c.id === addingCountableId)?.name ?? ''}
          targetRoomId={CENTRAL_WAREHOUSE_ROOM_ID}
          onClose={() => setAddingCountableId(null)}
          onAdded={async () => {
            await loadAllocations(addingCountableId)
            await load()
          }}
        />
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0, marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>{categoryName || panelStrings.title}</h2>

        {canWrite ? (
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            aria-label={panelStrings.actions.create}
            title={panelStrings.actions.create}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              lineHeight: 1,
              padding: 0,
            }}
            disabled={loading}
          >
            +
          </button>
        ) : null}
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 2, textAlign: 'left' }}>
        {countables.length === 0 ? (
          <div>{loading ? messages.menu.loading : panelStrings.table.empty}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>{panelStrings.table.name}</th>
                  <th style={{ ...headerCellStyle, textAlign: 'right' }}>{panelStrings.table.quantity}</th>
                </tr>
              </thead>
              <tbody>
                {countables.map((item) => (
                  <Fragment key={item.id}>
                    <tr
                      style={{
                        cursor: 'pointer',
                        background: expandedRows.has(item.id) ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : undefined,
                        fontWeight: expandedRows.has(item.id) ? 'bold' : undefined,
                      }}
                      onClick={() => toggleRowExpansion(item.id)}
                    >
                      <td style={cellStyle}>
                        <span style={{ marginRight: 8 }}>
                          {expandedRows.has(item.id) ? '▼' : '▶'}
                        </span>
                        {item.name}
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>{item.quantity}</td>
                    </tr>
                    {expandedRows.has(item.id) && (
                      <tr>
                        <td colSpan={2} style={{ padding: 0, border: 'none' }}>
                          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                            {canWrite ? (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setMovingCountableId(item.id)
                                    }}
                                    style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                                >
                                    {messages.countables.panel.actions.move}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setRemovingCountableId(item.id)
                                    }}
                                    style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                                >
                                    {messages.countables.panel.actions.remove}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setAddingCountableId(item.id)
                                    }}
                                    style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                                >
                                    {messages.countables.panel.actions.add}
                                </button>
                                </div>
                            ) : null}

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={headerCellStyle}>{panelStrings.table.locationRoom}</th>
                                  <th style={{ ...headerCellStyle, textAlign: 'right' }}>{panelStrings.table.quantity}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allocations[item.id] && allocations[item.id].length > 0 ? (
                                  allocations[item.id].map((allocation, index) => (
                                    <tr key={index}>
                                      <td style={cellStyle}>
                                        {allocation.location}, {allocation.room}
                                      </td>
                                      <td style={{ ...cellStyle, textAlign: 'right' }}>{allocation.quantity}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td style={cellStyle} colSpan={2}>
                                      {panelStrings.table.subTablePlaceholder}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
