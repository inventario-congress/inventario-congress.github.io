import { useCallback, useEffect, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import CountableEditor from './CountableEditor'

type CountableRow = {
  id: number
  name: string
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countables, setCountables] = useState<CountableRow[]>([])

  const load = useCallback(async () => {
    if (!supabase) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: countablesError } = await supabase
        .from('countable')
        .select('id, name, quantity')
        .eq('category', categoryId)
        .order('name', { ascending: true })

      if (countablesError) throw countablesError

      setCountables(
        (data as CountableRow[]).map((c) => ({
          id: c.id as number,
          name: c.name as string,
          quantity: c.quantity as number,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : panelStrings.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [categoryId, panelStrings.feedback.loadFailed])

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
                  <tr key={item.id}>
                    <td style={cellStyle}>{item.name}</td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
