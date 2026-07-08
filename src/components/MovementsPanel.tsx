import { useEffect, useState } from 'react'
import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type ItemChoice = {
  id: number
  label: string
}

type LocationChoice = {
  id: number
  name: string
}

type MovementRow = {
  id: number
  createdAt: string
  itemId: number
  itemLabel: string
  locationId: number
  locationName: string
  userName: string
}

type AttachmentRow = {
  id: number
  createdAt: string
  parentId: number
  parentLabel: string
  childId: number
  childLabel: string
  userName: string
  isAttached: boolean
}

type MovementsPanelProps = {
  messages: Messages
  canWrite: boolean
}

export default function MovementsPanel({ messages, canWrite }: MovementsPanelProps) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [sessionUserName, setSessionUserName] = useState<string | null>(null)

  const [itemChoices, setItemChoices] = useState<ItemChoice[]>([])
  const [locationChoices, setLocationChoices] = useState<LocationChoice[]>([])

  const [movementItemId, setMovementItemId] = useState('')
  const [movementLocationId, setMovementLocationId] = useState('')
  const [editingMovementId, setEditingMovementId] = useState<number | null>(null)

  const [attachmentParentId, setAttachmentParentId] = useState('')
  const [attachmentChildId, setAttachmentChildId] = useState('')
  const [attachmentMode, setAttachmentMode] = useState<'attach' | 'detach'>('attach')
  const [editingAttachmentId, setEditingAttachmentId] = useState<number | null>(null)

  const [movementRows, setMovementRows] = useState<MovementRow[]>([])
  const [attachmentRows, setAttachmentRows] = useState<AttachmentRow[]>([])

  const [loading, setLoading] = useState(false)
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

      setSessionUserId(session?.user?.id ?? null)
      const currentName = [
        (session?.user?.user_metadata?.name as string | undefined)?.trim() ?? '',
        (session?.user?.user_metadata?.last_name as string | undefined)?.trim() ?? '',
      ]
        .filter(Boolean)
        .join(' ')
      setSessionUserName(currentName || null)
      await loadEverything()
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null)
      const currentName = [
        (session?.user?.user_metadata?.name as string | undefined)?.trim() ?? '',
        (session?.user?.user_metadata?.last_name as string | undefined)?.trim() ?? '',
      ]
        .filter(Boolean)
        .join(' ')
      setSessionUserName(currentName || null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadEverything() {
    if (!supabase) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: itemData, error: itemError } = await supabase
        .from('item')
        .select('id, identifier, model')
        .order('id', { ascending: true })
      if (itemError) throw itemError

      const modelIds = Array.from(new Set((itemData ?? []).map((row) => row.model as number)))

      let modelMap = new Map<number, string>()
      if (modelIds.length > 0) {
        const { data: models, error: modelError } = await supabase.from('model').select('id, name').in('id', modelIds)
        if (modelError) throw modelError
        modelMap = new Map((models ?? []).map((model) => [model.id as number, model.name as string]))
      }

      const itemLabelMap = new Map<number, string>()
      const mappedItemChoices: ItemChoice[] = (itemData ?? []).map((row) => {
        const modelName = modelMap.get(row.model as number) ?? ''
        const label = `#${row.identifier} - ${modelName}`
        const id = row.id as number
        itemLabelMap.set(id, label)
        return { id, label }
      })
      setItemChoices(mappedItemChoices)

      const { data: locationData, error: locationError } = await supabase
        .from('location')
        .select('id, name')
        .order('name', { ascending: true })
      if (locationError) throw locationError

      const locationNameMap = new Map<number, string>()
      const mappedLocationChoices: LocationChoice[] = (locationData ?? []).map((location) => {
        const id = location.id as number
        const name = location.name as string
        locationNameMap.set(id, name)
        return { id, name }
      })
      setLocationChoices(mappedLocationChoices)

      const { data: movementData, error: movementError } = await supabase
        .from('movement')
        .select('id, created_at, item, location, user')
        .order('created_at', { ascending: false })
      if (movementError) throw movementError

      const { data: attachmentData, error: attachmentError } = await supabase
        .from('attachment')
        .select('id, created_at, parent, child, user, is_attached')
        .order('created_at', { ascending: false })
      if (attachmentError) throw attachmentError

      const userIds = Array.from(
        new Set([
          ...(movementData ?? []).map((entry) => entry.user as string),
          ...(attachmentData ?? []).map((entry) => entry.user as string),
        ]),
      )

      const userLabelMap = await loadUserLabelMap(userIds)

      const mappedMovements: MovementRow[] = (movementData ?? []).map((entry) => ({
        id: entry.id as number,
        createdAt: entry.created_at as string,
        itemId: entry.item as number,
        itemLabel: itemLabelMap.get(entry.item as number) ?? String(entry.item),
        locationId: entry.location as number,
        locationName: locationNameMap.get(entry.location as number) ?? String(entry.location),
        userName: userLabelMap.get(entry.user as string) ?? messages.movements.userUnknown,
      }))
      setMovementRows(mappedMovements)

      const mappedAttachments: AttachmentRow[] = (attachmentData ?? []).map((entry) => ({
        id: entry.id as number,
        createdAt: entry.created_at as string,
        parentId: entry.parent as number,
        parentLabel: itemLabelMap.get(entry.parent as number) ?? String(entry.parent),
        childId: entry.child as number,
        childLabel: itemLabelMap.get(entry.child as number) ?? String(entry.child),
        userName: userLabelMap.get(entry.user as string) ?? messages.movements.userUnknown,
        isAttached: Boolean(entry.is_attached),
      }))
      setAttachmentRows(mappedAttachments)
      setStatus(messages.movements.feedback.loaded)
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.movements.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  async function loadUserLabelMap(userIds: string[]) {
    const labelMap = new Map<string, string>()

    if (!supabase || userIds.length === 0) {
      return labelMap
    }

    if (sessionUserId && sessionUserName) {
      labelMap.set(sessionUserId, sessionUserName)
    }

    const selectors = ['id, first_name, last_name', 'id, name, last_name']

    for (const selector of selectors) {
      const { data, error } = await supabase.from('profiles').select(selector).in('id', userIds)

      if (error) {
        continue
      }

      for (const row of ((data ?? []) as unknown as Array<Record<string, unknown>>)) {
        const id = String(row.id ?? '')
        if (!id) {
          continue
        }

        const firstName = typeof row.first_name === 'string'
          ? row.first_name
          : typeof row.name === 'string'
            ? row.name
            : ''
        const lastName = typeof row.last_name === 'string' ? row.last_name : ''
        const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')

        if (fullName) {
          labelMap.set(id, fullName)
        }
      }

      break
    }

    return labelMap
  }

  async function saveMovement() {
    if (!supabase || !canWrite || !sessionUserId) {
      return
    }

    const itemId = Number.parseInt(movementItemId, 10)
    const locationId = Number.parseInt(movementLocationId, 10)

    if (Number.isNaN(itemId) || Number.isNaN(locationId)) {
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      if (editingMovementId === null) {
        const { error: createError } = await supabase.from('movement').insert({
          item: itemId,
          location: locationId,
          user: sessionUserId,
        })
        if (createError) throw createError
        setStatus(messages.movements.feedback.created)
      } else {
        const { error: updateError } = await supabase
          .from('movement')
          .update({ item: itemId, location: locationId, user: sessionUserId })
          .eq('id', editingMovementId)
        if (updateError) throw updateError
        setStatus(messages.movements.feedback.updated)
      }

      setEditingMovementId(null)
      setMovementItemId('')
      setMovementLocationId('')
      await loadEverything()
    } catch (e) {
      const fallback = editingMovementId === null ? messages.movements.feedback.createFailed : messages.movements.feedback.updateFailed
      setError(e instanceof Error ? e.message : fallback)
    } finally {
      setLoading(false)
    }
  }

  function startEditMovement(row: MovementRow) {
    if (!canWrite) {
      return
    }

    setEditingMovementId(row.id)
    setMovementItemId(String(row.itemId))
    setMovementLocationId(String(row.locationId))
    setError(null)
    setStatus(null)
  }

  function cancelMovementEdit() {
    setEditingMovementId(null)
    setMovementItemId('')
    setMovementLocationId('')
  }

  async function deleteMovement(id: number) {
    if (!supabase || !canWrite) {
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      const { error: deleteError } = await supabase.from('movement').delete().eq('id', id)
      if (deleteError) throw deleteError

      if (editingMovementId === id) {
        cancelMovementEdit()
      }

      setStatus(messages.movements.feedback.deleted)
      await loadEverything()
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.movements.feedback.deleteFailed)
    } finally {
      setLoading(false)
    }
  }

  async function saveAttachment() {
    if (!supabase || !canWrite || !sessionUserId) {
      return
    }

    const parentId = Number.parseInt(attachmentParentId, 10)
    const childId = Number.parseInt(attachmentChildId, 10)

    if (Number.isNaN(parentId) || Number.isNaN(childId)) {
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      const payload = {
        parent: parentId,
        child: childId,
        user: sessionUserId,
        is_attached: attachmentMode === 'attach',
      }

      if (editingAttachmentId === null) {
        const { error: createError } = await supabase.from('attachment').insert(payload)
        if (createError) throw createError
        setStatus(messages.attachments.feedback.created)
      } else {
        const { error: updateError } = await supabase
          .from('attachment')
          .update(payload)
          .eq('id', editingAttachmentId)
        if (updateError) throw updateError
        setStatus(messages.attachments.feedback.updated)
      }

      setEditingAttachmentId(null)
      setAttachmentParentId('')
      setAttachmentChildId('')
      setAttachmentMode('attach')
      await loadEverything()
    } catch (e) {
      const fallback = editingAttachmentId === null
        ? messages.attachments.feedback.createFailed
        : messages.attachments.feedback.updateFailed
      setError(e instanceof Error ? e.message : fallback)
    } finally {
      setLoading(false)
    }
  }

  function startEditAttachment(row: AttachmentRow) {
    if (!canWrite) {
      return
    }

    setEditingAttachmentId(row.id)
    setAttachmentParentId(String(row.parentId))
    setAttachmentChildId(String(row.childId))
    setAttachmentMode(row.isAttached ? 'attach' : 'detach')
    setError(null)
    setStatus(null)
  }

  function cancelAttachmentEdit() {
    setEditingAttachmentId(null)
    setAttachmentParentId('')
    setAttachmentChildId('')
    setAttachmentMode('attach')
  }

  async function deleteAttachment(id: number) {
    if (!supabase || !canWrite) {
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      const { error: deleteError } = await supabase.from('attachment').delete().eq('id', id)
      if (deleteError) throw deleteError

      if (editingAttachmentId === id) {
        cancelAttachmentEdit()
      }

      setStatus(messages.attachments.feedback.deleted)
      await loadEverything()
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.attachments.feedback.deleteFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <h2 style={{ marginTop: 0 }}>{messages.movements.title}</h2>

      {!canWrite ? <p>{messages.movements.readOnly}</p> : null}

      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          onClick={loadEverything}
          disabled={loading}
          style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
        >
          {messages.movements.actions.refresh}
        </button>
      </div>

      {canWrite ? (
        <section style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>{messages.movements.forms.movementTitle}</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <label htmlFor="movement-item">{messages.movements.fields.item}</label>
            <select
              id="movement-item"
              value={movementItemId}
              onChange={(event) => setMovementItemId(event.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
            >
              <option value="">{messages.movements.fields.selectItem}</option>
              {itemChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>

            <label htmlFor="movement-location">{messages.movements.fields.location}</label>
            <select
              id="movement-location"
              value={movementLocationId}
              onChange={(event) => setMovementLocationId(event.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
            >
              <option value="">{messages.movements.fields.selectLocation}</option>
              {locationChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={saveMovement}
                disabled={loading || !movementItemId || !movementLocationId}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {editingMovementId === null ? messages.movements.actions.create : messages.movements.actions.update}
              </button>
              {editingMovementId !== null ? (
                <button
                  type="button"
                  onClick={cancelMovementEdit}
                  disabled={loading}
                  style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
                >
                  {messages.movements.actions.cancelEdit}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ marginBottom: 22 }}>
        <h3 style={{ marginBottom: 8 }}>{messages.movements.table.title}</h3>
        {movementRows.length === 0 ? (
          <div>{messages.movements.table.empty}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.movements.table.createdAt}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.movements.table.item}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.movements.table.location}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.movements.table.user}
                  </th>
                  {canWrite ? (
                    <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {messages.movements.table.actions}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {movementRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.itemLabel}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.locationName}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.userName}</td>
                    {canWrite ? (
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => startEditMovement(row)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.movements.actions.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMovement(row.id)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.movements.actions.delete}
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
      </section>

      {canWrite ? (
        <section style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>{messages.attachments.forms.title}</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <label htmlFor="attachment-parent">{messages.attachments.fields.parent}</label>
            <select
              id="attachment-parent"
              value={attachmentParentId}
              onChange={(event) => setAttachmentParentId(event.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
            >
              <option value="">{messages.attachments.fields.selectParent}</option>
              {itemChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>

            <label htmlFor="attachment-child">{messages.attachments.fields.child}</label>
            <select
              id="attachment-child"
              value={attachmentChildId}
              onChange={(event) => setAttachmentChildId(event.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
            >
              <option value="">{messages.attachments.fields.selectChild}</option>
              {itemChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>

            <label htmlFor="attachment-mode">{messages.attachments.fields.state}</label>
            <select
              id="attachment-mode"
              value={attachmentMode}
              onChange={(event) => setAttachmentMode(event.target.value === 'detach' ? 'detach' : 'attach')}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
            >
              <option value="attach">{messages.attachments.states.attach}</option>
              <option value="detach">{messages.attachments.states.detach}</option>
            </select>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={saveAttachment}
                disabled={loading || !attachmentParentId || !attachmentChildId}
                style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              >
                {editingAttachmentId === null ? messages.attachments.actions.create : messages.attachments.actions.update}
              </button>
              {editingAttachmentId !== null ? (
                <button
                  type="button"
                  onClick={cancelAttachmentEdit}
                  disabled={loading}
                  style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
                >
                  {messages.attachments.actions.cancelEdit}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h3 style={{ marginBottom: 8 }}>{messages.attachments.table.title}</h3>
        {attachmentRows.length === 0 ? (
          <div>{messages.attachments.table.empty}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.attachments.table.createdAt}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.attachments.table.parent}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.attachments.table.child}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.attachments.table.state}
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                    {messages.attachments.table.user}
                  </th>
                  {canWrite ? (
                    <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {messages.attachments.table.actions}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {attachmentRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.parentLabel}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.childLabel}</td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                      {row.isAttached ? messages.attachments.states.attach : messages.attachments.states.detach}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{row.userName}</td>
                    {canWrite ? (
                      <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => startEditAttachment(row)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.attachments.actions.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAttachment(row.id)}
                            disabled={loading}
                            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                          >
                            {messages.attachments.actions.delete}
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
      </section>

      {error ? (
        <div style={{ color: 'crimson', marginTop: 12 }}>
          <strong>{messages.auth.feedback.error}</strong> {error}
        </div>
      ) : null}

      {status ? (
        <div style={{ color: 'green', marginTop: 12 }}>
          <strong>{messages.auth.feedback.status}</strong> {status}
        </div>
      ) : null}
    </div>
  )
}
