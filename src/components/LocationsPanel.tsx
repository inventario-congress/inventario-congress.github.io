import { useEffect, useState, useCallback } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type LocationRow = {
  id: number
  name: string
  address: string | null
}

type LocationsPanelProps = {
  messages: Messages
  canWrite: boolean
}

export default function LocationsPanel({ messages, canWrite }: LocationsPanelProps) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [rows, setRows] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const loadLocations = useCallback(async () => {
    if (!supabase) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: loadError } = await supabase
        .from('location')
        .select('id, name, address')
        .order('id', { ascending: false })

      if (loadError) throw loadError

      setRows(
        (data ?? []).map((entry) => ({
          id: entry.id as number,
          name: entry.name as string,
          address: (entry.address as string | null) ?? null,
        })),
      )
      setStatus(messages.locations.feedback.loaded)
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.locations.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [messages.locations.feedback.loaded, messages.locations.feedback.loadFailed])

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

      await loadLocations()
    })()

    return () => {
      active = false
    }
  }, [loadLocations])

  async function saveLocation() {
    if (!supabase || !canWrite) {
      return
    }

    const trimmedName = name.trim()
    const trimmedAddress = address.trim()

    if (!trimmedName) {
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      if (editingId === null) {
        const { error: createError } = await supabase.from('location').insert({
          name: trimmedName,
          address: trimmedAddress || null,
        })

        if (createError) throw createError
        setStatus(messages.locations.feedback.created)
      } else {
        const { error: updateError } = await supabase
          .from('location')
          .update({ name: trimmedName, address: trimmedAddress || null })
          .eq('id', editingId)

        if (updateError) throw updateError
        setStatus(messages.locations.feedback.updated)
      }

      setEditingId(null)
      setName('')
      setAddress('')
      await loadLocations()
    } catch (e) {
      const fallback = editingId === null ? messages.locations.feedback.createFailed : messages.locations.feedback.updateFailed
      setError(e instanceof Error ? e.message : fallback)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(row: LocationRow) {
    if (!canWrite) {
      return
    }

    setEditingId(row.id)
    setName(row.name)
    setAddress(row.address ?? '')
    setError(null)
    setStatus(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setName('')
    setAddress('')
  }

  async function deleteLocation(id: number) {
    if (!supabase || !canWrite) {
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      const { error: deleteError } = await supabase.from('location').delete().eq('id', id)
      if (deleteError) throw deleteError

      if (editingId === id) {
        cancelEdit()
      }

      setStatus(messages.locations.feedback.deleted)
      await loadLocations()
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.locations.feedback.deleteFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <h2 style={{ marginTop: 0 }}>{messages.locations.title}</h2>

      {!canWrite ? <p>{messages.locations.readOnly}</p> : null}

      {canWrite ? (
        <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
          <label htmlFor="location-name">{messages.locations.fields.name}</label>
          <input
            id="location-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            placeholder={messages.locations.fields.name}
            style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
          />

          <label htmlFor="location-address">{messages.locations.fields.address}</label>
          <input
            id="location-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            type="text"
            placeholder={messages.locations.fields.address}
            style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={saveLocation}
              disabled={loading || !name.trim()}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {editingId === null ? messages.locations.actions.create : messages.locations.actions.update}
            </button>
            {editingId !== null ? (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={loading}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {messages.locations.actions.cancelEdit}
              </button>
            ) : null}
            <button
              type="button"
              onClick={loadLocations}
              disabled={loading}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {messages.locations.actions.refresh}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={loadLocations}
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            {messages.locations.actions.refresh}
          </button>
        </div>
      )}

      {error ? (
        <div style={{ color: 'crimson', marginBottom: 10 }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      {status ? (
        <div style={{ color: 'green', marginBottom: 10 }}>
          <strong>{messages.auth.feedback.status}</strong> {status}
        </div>
      ) : null}

      <h3 style={{ marginBottom: 8 }}>{messages.locations.table.title}</h3>
      {rows.length === 0 ? (
        <div>{messages.locations.table.empty}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                  {messages.locations.table.name}
                </th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                  {messages.locations.table.address}
                </th>
                {canWrite ? (
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.locations.table.actions}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.name}</td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.address ?? '-'}</td>
                  {canWrite ? (
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={loading}
                          style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          {messages.locations.actions.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLocation(row.id)}
                          disabled={loading}
                          style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          {messages.locations.actions.delete}
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
  )
}
