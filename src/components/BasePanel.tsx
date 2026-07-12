import { useEffect, useState } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type BaseRow = {
  id: number
  identifier: number
  maxMicCount: number
}

type BasePanelProps = {
  messages: Messages
  canWrite: boolean
}

export default function BasePanel({ messages, canWrite }: BasePanelProps) {
  const [identifier, setIdentifier] = useState('')
  const [maxMicCount, setMaxMicCount] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BaseRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let active = true

    ;(async () => {
      await supabase.auth.getSession()

      if (!active) {
        return
      }

      await loadBases()
    })()

    return () => {
      active = false
    }
  }, [])

  async function loadBases() {
    if (!supabase) {
      return
    }

    setError(null)
    setLoading(true)

    try {
      const { data, error: loadError } = await supabase
        .from('base')
        .select('id, identifier, max_mic_count')
        .order('id', { ascending: false })

      if (loadError) throw loadError

      setRows(
        (data ?? []).map((entry) => ({
          id: entry.id as number,
          identifier: entry.identifier as number,
          maxMicCount: entry.max_mic_count as number,
        })),
      )

      setStatus(messages.bases.feedback.loaded)
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bases.feedback.loadFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setIdentifier('')
    setMaxMicCount('')
    setEditingId(null)
  }

  async function handleSubmit() {
    if (!supabase) {
      return
    }

    if (!canWrite) {
      return
    }

    const parsedIdentifier = Number.parseInt(identifier, 10)
    const parsedMaxMicCount = Number.parseInt(maxMicCount, 10)

    if (Number.isNaN(parsedIdentifier) || Number.isNaN(parsedMaxMicCount)) {
      return
    }

    setError(null)
    setStatus(null)
    setLoading(true)

    try {
      const payload = {
        identifier: parsedIdentifier,
        max_mic_count: parsedMaxMicCount,
      }

      if (editingId === null) {
        const { error: createError } = await supabase.from('base').insert(payload)
        if (createError) throw createError
        setStatus(messages.bases.feedback.created)
      } else {
        const { error: updateError } = await supabase.from('base').update(payload).eq('id', editingId)
        if (updateError) throw updateError
        setStatus(messages.bases.feedback.updated)
      }

      resetForm()
      await loadBases()
    } catch (e) {
      const fallback = editingId === null ? messages.bases.feedback.createFailed : messages.bases.feedback.updateFailed
      const msg = e instanceof Error ? e.message : fallback
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(row: BaseRow) {
    if (!canWrite) {
      return
    }

    setEditingId(row.id)
    setIdentifier(String(row.identifier))
    setMaxMicCount(String(row.maxMicCount))
    setError(null)
    setStatus(null)
  }

  function cancelEdit() {
    resetForm()
  }

  async function deleteBase(id: number) {
    if (!supabase) {
      return
    }

    if (!canWrite) {
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      const { error: deleteError } = await supabase.from('base').delete().eq('id', id)
      if (deleteError) throw deleteError

      if (editingId === id) {
        cancelEdit()
      }

      setStatus(messages.bases.feedback.deleted)
      await loadBases()
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.bases.feedback.deleteFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <h2 style={{ marginTop: 24 }}>{messages.bases.title}</h2>


      {canWrite ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label htmlFor="base-identifier" style={{ textAlign: 'left' }}>
            {messages.bases.fields.identifier}
          </label>

          <input
            id="base-identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            type="number"
            required
            placeholder={messages.bases.fields.identifier}

            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />

          <label htmlFor="base-max-mic-count" style={{ textAlign: 'left' }}>
            {messages.bases.fields.maxMicCount}
          </label>

          <input
            id="base-max-mic-count"
            value={maxMicCount}
            onChange={(event) => setMaxMicCount(event.target.value)}
            type="number"
            required
            placeholder={messages.bases.fields.maxMicCount}

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
              disabled={loading || !identifier.trim() || !maxMicCount.trim()}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
            {editingId === null ? messages.bases.actions.create : messages.bases.actions.update}
            </button>



            {editingId !== null ? (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={loading}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {messages.bases.actions.cancelEdit}

              </button>
            ) : null}

            <button
              type="button"
              onClick={loadBases}
              disabled={loading}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.bases.actions.refresh}
            </button>

          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, textAlign: 'left' }}>
          {messages.bases.readOnly}

        </div>
      )}

      {!canWrite ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <button
            type="button"
            onClick={loadBases}
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.bases.actions.refresh}

          </button>
        </div>
      ) : null}

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
          <h3 style={{ margin: '0 0 10px' }}>{messages.bases.table.title}</h3>

        {rows.length === 0 ? (
          <div>{messages.bases.table.empty}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.bases.table.identifier}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.bases.table.maxMicCount}
                  </th>
                  {canWrite ? (
                    <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {messages.bases.table.actions}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.identifier}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.maxMicCount}</td>
                    {canWrite ? (
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.bases.actions.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBase(row.id)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.bases.actions.delete}
                          </button>
                        </div>
                      </td>
                    ) : null}
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

