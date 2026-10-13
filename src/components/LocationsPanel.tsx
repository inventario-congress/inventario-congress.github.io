import { useEffect, useState, useCallback } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import DeleteConfirmation from './DeleteConfirmation'


type LocationRow = {
  id: number
  name: string
  address: string | null
  rooms: { id: number; name: string }[]
}

type LocationsPanelProps = {
  messages: Messages
  canWrite: boolean
}

import LocationEditor from './LocationEditor'

export default function LocationsPanel({ messages, canWrite }: LocationsPanelProps) {
  const [rows, setRows] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [locationEditorOpen, setLocationEditorOpen] = useState(false)
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null)


  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const [error, setError] = useState<string | null>(null)

  const loadLocations = useCallback(async () => {
    if (!supabase) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: loadError } = await supabase.rpc('get_locations_with_rooms')

      if (loadError) throw loadError

      if (!data) {
        throw new Error('No data returned from get_locations_with_rooms()')
      }

      setRows(data as LocationRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.locations.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [messages.locations.feedback.loadFailed])

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



  function startEdit(row: LocationRow) {
    if (!canWrite) return
    setEditingLocationId(row.id)
    setLocationEditorOpen(true)
  }


  async function deleteLocation(id: number) {
    if (!supabase || !canWrite) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase.from('location').delete().eq('id', id)
      if (deleteError) throw deleteError



      await loadLocations()
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.locations.feedback.deleteFailed)
    } finally {
      setLoading(false)
    }
  }

    return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 0, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0, marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>{messages.locations.title}</h2>

        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              setEditingLocationId(null)
              setLocationEditorOpen(true)
            }}
            aria-label={messages.locations.actions.create}
            title={messages.locations.actions.create}
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


      <DeleteConfirmation
        open={deleteDialogOpen}
        title={messages.deleteConfirmation.title}
        messagePrefix={messages.deleteConfirmation.messagePrefix}
        entities={
          deleteTarget
            ? [
                {
                  id: deleteTarget.id,
                  name: deleteTarget.name,
                },
              ]
            : []
        }
        confirmLabel={messages.deleteConfirmation.actions.confirm}
        cancelLabel={messages.deleteConfirmation.actions.cancel}
        loading={loading}
        onCancel={() => {
          setDeleteDialogOpen(false)
          setDeleteTarget(null)
        }}
        onConfirm={async () => {
          if (!deleteTarget) return
          const id = deleteTarget.id
          setDeleteDialogOpen(false)
          setDeleteTarget(null)
          await deleteLocation(id)
        }}
      />


      <LocationEditor
        messages={messages}
        canWrite={canWrite}
        isOpen={locationEditorOpen}
        locationId={editingLocationId}
        onClose={() => {
          setLocationEditorOpen(false)
          setEditingLocationId(null)
        }}
        onSaved={async () => {
          setError(null)
          setLocationEditorOpen(false)
          setEditingLocationId(null)
          await loadLocations()
        }}
      />

      {error ? (
        <div style={{ color: 'crimson', marginBottom: 10 }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 2, textAlign: 'left' }}>
      {rows.length === 0 ? (
        <div>{messages.locations.table.empty}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--table-header-bg)',
                    padding: '8px 6px',
                  }}
                >
                  {messages.locations.table.name}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--table-header-bg)',
                    padding: '8px 6px',
                  }}
                >
                  {messages.locations.table.rooms}
                </th>
                {canWrite ? (
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--table-header-bg)',
                      padding: '8px 6px',
                    }}
                  >
                    {messages.locations.table.actions}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.name}</td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {row.rooms.length > 0 ? row.rooms.map((room) => (
                      <div key={room.id}>{room.name}</div>
                    )) : '-'}
                  </td>
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
                          onClick={() => {
                            setDeleteTarget({ id: row.id, name: row.name })
                            setDeleteDialogOpen(true)
                          }}
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
    </div>
  )
}
