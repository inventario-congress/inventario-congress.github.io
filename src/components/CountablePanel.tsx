import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import CountableEditor from './CountableEditor'

type CategoryRow = {
  id: number
  name: string
}

type CountableRow = {
  id: number
  name: string
  quantity: number
  category: number
}

type CountablePanelProps = {
  messages: Messages
  canWrite: boolean
}

function TriangleIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 16,
        textAlign: 'center',
        marginRight: 8,
        color: 'var(--muted)',
        transition: 'transform 120ms ease',
        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        userSelect: 'none',
      }}
    >
      ▶
    </span>
  )
}

const headerCellStyle = {
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--table-header-bg)',
  padding: '8px 6px',
  whiteSpace: 'nowrap',
} as const

const cellStyle = { borderBottom: '1px solid var(--border)', padding: '8px 6px' } as const

export default function CountablePanel({ messages, canWrite }: CountablePanelProps) {
  const panelStrings = messages.countables.panel

  const [editorOpen, setEditorOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [countables, setCountables] = useState<CountableRow[]>([])
  // Categories are expanded by default, so only the ones the user collapsed are tracked.
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<number>>(() => new Set())

  const load = useCallback(async () => {
    if (!supabase) return

    setLoading(true)
    setError(null)

    try {
      const [categoriesResult, countablesResult] = await Promise.all([
        supabase.from('countable_category').select('id, name').order('name', { ascending: true }),
        supabase.from('countable').select('id, name, quantity, category').order('name', { ascending: true }),
      ])

      if (categoriesResult.error) throw categoriesResult.error
      if (countablesResult.error) throw countablesResult.error

      setCategories((categoriesResult.data ?? []).map((c) => ({ id: c.id as number, name: c.name as string })))
      setCountables(
        (countablesResult.data ?? []).map((c) => ({
          id: c.id as number,
          name: c.name as string,
          quantity: c.quantity as number,
          category: c.category as number,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : panelStrings.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [panelStrings.feedback.loadFailed])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  const countablesByCategory = useMemo(() => {
    const map = new Map<number, CountableRow[]>()
    for (const c of countables) {
      const list = map.get(c.category)
      if (list) list.push(c)
      else map.set(c.category, [c])
    }
    return map
  }, [countables])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
      <CountableEditor
        messages={messages}
        canWrite={canWrite}
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          void load()
        }}
        onSaved={() => {
          setError(null)
          void load()
        }}
        onCategoriesChanged={() => void load()}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0, marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>{panelStrings.title}</h2>

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
        {categories.length === 0 ? (
          <div>{loading ? messages.menu.loading : panelStrings.table.empty}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>{panelStrings.table.category}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const isExpanded = !collapsedCategoryIds.has(category.id)
                  const items = countablesByCategory.get(category.id) ?? []

                  return (
                    <Fragment key={category.id}>
                      <tr
                        style={{
                          cursor: 'pointer',
                          background: isExpanded ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : undefined,
                          fontWeight: isExpanded ? 'bold' : undefined,
                        }}
                        onClick={() =>
                          setCollapsedCategoryIds((prev) => {
                            const next = new Set(prev)
                            if (isExpanded) next.add(category.id)
                            else next.delete(category.id)
                            return next
                          })
                        }
                      >
                        <td style={cellStyle}>
                          <TriangleIcon isOpen={isExpanded} />
                          {category.name}
                        </td>
                      </tr>

                      <tr>
                        <td style={{ padding: 0, borderBottom: '1px solid var(--border)' }}>
                          <div
                            style={{
                              overflow: 'hidden',
                              border: isExpanded ? '2px solid var(--accent-border)' : '0px solid transparent',
                              borderRadius: 12,
                              transition: 'max-height 120ms ease, opacity 120ms ease, transform 120ms ease, border 120ms ease',
                              maxHeight: isExpanded ? 1000 : 0,
                              opacity: isExpanded ? 1 : 0,
                              transform: isExpanded ? 'translateY(0px)' : 'translateY(-4px)',
                              pointerEvents: isExpanded ? 'auto' : 'none',
                              overflowY: isExpanded ? 'auto' : 'hidden',
                            }}
                          >
                            <div style={{ padding: '10px 6px 14px 6px' }}>
                              {items.length === 0 ? (
                                <div>{panelStrings.table.emptyCountables}</div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ ...headerCellStyle, padding: '6px 4px' }}>{panelStrings.table.name}</th>
                                      <th style={{ ...headerCellStyle, padding: '6px 4px' }}>{panelStrings.table.quantity}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((item) => (
                                      <tr key={item.id}>
                                        <td style={{ ...cellStyle, padding: '6px 4px' }}>{item.name}</td>
                                        <td style={{ ...cellStyle, padding: '6px 4px' }}>{item.quantity}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
