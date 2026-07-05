import { useEffect, useState } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type ItemRow = {
  id: number
  identifier: number
  modelId: number
  modelName: string
}

type ItemsPanelProps = {
  messages: Messages
}

export default function ItemsPanel({ messages }: ItemsPanelProps) {
  const [modelName, setModelName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ItemRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let active = true

    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) {
        return
      }

      setSessionEmail(session?.user?.email ?? null)
      await loadItems()
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadItems() {
    if (!supabase) {
      return
    }

    setError(null)
    setLoading(true)

    try {
      const { data: items, error: itemsError } = await supabase
        .from('item')
        .select('id, identifier, model')
        .order('id', { ascending: false })

      if (itemsError) throw itemsError

      const modelIds = Array.from(
        new Set((items ?? []).map((item) => item.model as number)),
      )

      let modelMap = new Map<number, string>()

      if (modelIds.length > 0) {
        const { data: models, error: modelsError } = await supabase
          .from('model')
          .select('id, name')
          .in('id', modelIds)

        if (modelsError) throw modelsError

        modelMap = new Map(
          (models ?? []).map((model) => [model.id as number, model.name as string]),
        )
      }

      const mappedRows: ItemRow[] = (items ?? []).map((item) => ({
        id: item.id as number,
        identifier: item.identifier as number,
        modelId: item.model as number,
        modelName: modelMap.get(item.model as number) ?? '',
      }))

      setRows(mappedRows)
      setStatus(messages.items.feedback.loaded)
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.items.feedback.loadFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function ensureModelId(name: string): Promise<number> {
    if (!supabase) {
      throw new Error(messages.items.feedback.authRequired)
    }

    const trimmed = name.trim()

    const { data, error } = await supabase
      .from('model')
      .upsert({ name: trimmed }, { onConflict: 'name' })
      .select('id')
      .single()

    if (error || !data?.id) {
      throw error ?? new Error(messages.items.feedback.createFailed)
    }

    return data.id as number
  }

  async function handleSubmit() {
    if (!supabase) {
      return
    }

    const trimmedName = modelName.trim()
    const parsedIdentifier = Number.parseInt(identifier, 10)

    if (!trimmedName || Number.isNaN(parsedIdentifier)) {
      return
    }

    setError(null)
    setStatus(null)
    setLoading(true)

    try {
      const resolvedModelId = await ensureModelId(trimmedName)

      const itemPayload = {
        identifier: parsedIdentifier,
        model: resolvedModelId,
      }

      if (editingId === null) {
        const { error } = await supabase.from('item').insert(itemPayload)

        if (error) throw error

        setStatus(messages.items.feedback.created)
      } else {
        const { error } = await supabase
          .from('item')
          .update(itemPayload)
          .eq('id', editingId)

        if (error) throw error

        setStatus(messages.items.feedback.updated)
      }

      setModelName('')
      setIdentifier('')
      setEditingId(null)
      await loadItems()
    } catch (e) {
      const fallback = editingId === null ? messages.items.feedback.createFailed : messages.items.feedback.updateFailed
      const msg = e instanceof Error ? e.message : fallback
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(row: ItemRow) {
    setEditingId(row.id)
    setModelName(row.modelName)
    setIdentifier(String(row.identifier))
    setError(null)
    setStatus(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setModelName('')
    setIdentifier('')
  }

  async function deleteItem(id: number) {
    if (!supabase) {
      return
    }

    setError(null)
    setStatus(null)
    setLoading(true)

    try {
      const { error } = await supabase.from('item').delete().eq('id', id)
      if (error) throw error

      if (editingId === id) {
        cancelEdit()
      }

      setStatus(messages.items.feedback.deleted)
      await loadItems()
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.items.feedback.deleteFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    if (!supabase) {
      return
    }

    setError(null)
    setStatus(null)

    const { error } = await supabase.auth.signOut()
    if (error) {
      setError(error.message || messages.items.feedback.signOutFailed)
      return
    }

    setStatus(messages.items.feedback.signedOut)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <h2 style={{ marginTop: 24 }}>{messages.items.title}</h2>

      <div style={{ marginBottom: 12, textAlign: 'left' }}>
        <strong>{messages.auth.session.label}</strong> {sessionEmail ?? messages.auth.session.signedOut}
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <label htmlFor="item-model-name" style={{ textAlign: 'left' }}>
          {messages.items.fields.modelName}
        </label>
        <input
          id="item-model-name"
          value={modelName}
          onChange={(event) => setModelName(event.target.value)}
          type="text"
          required
          placeholder={messages.items.fields.modelName}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}
        />

        <label htmlFor="item-identifier" style={{ textAlign: 'left' }}>
          {messages.items.fields.identifier}
        </label>
        <input
          id="item-identifier"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          type="number"
          required
          placeholder={messages.items.fields.identifier}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !modelName.trim() || !identifier.trim()}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {editingId === null ? messages.items.actions.create : messages.items.actions.update}
          </button>

          {editingId !== null ? (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={loading}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.items.actions.cancelEdit}
            </button>
          ) : null}

          <button
            type="button"
            onClick={loadItems}
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.items.actions.refresh}
          </button>

          <button
            type="button"
            onClick={signOut}
            disabled={loading || !sessionEmail}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.items.actions.signOut}
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      {status ? (
        <div style={{ marginTop: 12, color: 'green', textAlign: 'left' }}>
          <strong>{messages.auth.feedback.status}</strong> {status}
        </div>
      ) : null}

      <div style={{ marginTop: 24, textAlign: 'left' }}>
        <h3 style={{ margin: '0 0 10px' }}>{messages.items.table.title}</h3>

        {rows.length === 0 ? (
          <div>{messages.items.table.empty}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.items.table.modelName}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.items.table.identifier}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.items.table.actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.modelName}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.identifier}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={loading}
                          style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          {messages.items.actions.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteItem(row.id)}
                          disabled={loading}
                          style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          {messages.items.actions.delete}
                        </button>
                      </div>
                    </td>
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
