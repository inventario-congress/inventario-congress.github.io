import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'



type LocationEditorProps = {
  messages: Messages
  canWrite: boolean
  isOpen: boolean
  locationId?: number | null
  onClose: () => void
  onSaved?: () => void
}

type RoomChoice = {
  // Rename id -> room_id to avoid confusion with locationId and to match the RPC result structure
  room_id: number
  // Rename name -> room_name to avoid confusion with location name and to match the RPC result structure
  room_name: string
}


export default function LocationEditor({
  messages,
  canWrite,
  isOpen,
  locationId,
  onClose,
  onSaved,
}: LocationEditorProps) {
  const isEditMode = typeof locationId === 'number' && locationId > 0
  const strings = messages.locations

  const editorStrings = useMemo(() => {
    const dialogsEditor = (strings as unknown as { dialogs?: { editor?: unknown } }).dialogs?.editor

    const e = dialogsEditor as
      | {
          titleCreate?: string
          titleEdit?: string
          description?: string
          fields?: Record<string, string>
          actions?: Record<string, string>
          feedback?: Record<string, string>
          rooms?: Record<string, string>
          addRoomDialog?: {
            title?: string
            description?: string
            fields?: Record<string, string>
            actions?: Record<string, string>
            feedback?: Record<string, string>
          }
        }
      | undefined

    return {
      title: isEditMode ? e?.titleEdit ?? '' : e?.titleCreate ?? '',
      description: e?.description ?? '',
      fields: {
        name: e?.fields?.name ?? '',
        address: e?.fields?.address ?? '',
      },
      actions: {
        cancel: e?.actions?.cancel ?? '',
        save: e?.actions?.save ?? '',
      },
      feedback: {
        loadFailed: e?.feedback?.loadFailed ?? '',
        loadRoomsFailed: e?.feedback?.loadRoomsFailed ?? '',
        createFailed: e?.feedback?.createFailed ?? '',
        updateFailed: e?.feedback?.updateFailed ?? '',
        createRoomFailed: e?.feedback?.createRoomFailed ?? '',
        roomsCreateRequiresSavedLocation: e?.feedback?.roomsCreateRequiresSavedLocation ?? '',
      },
      rooms: {
        title: e?.rooms?.title ?? '',
        description: e?.rooms?.description ?? '',
        addRequiresSavedLocation: e?.rooms?.addRequiresSavedLocation ?? '',
        addRoom: e?.rooms?.addRoom ?? '',
        loadingRooms: e?.rooms?.loadingRooms ?? '',
        noneAssociated: e?.rooms?.noneAssociated ?? '',
        tableDeleteLabel: e?.rooms?.tableDeleteLabel ?? '',
        addRoomDialogOpen: e?.rooms?.addRoomDialogOpen ?? '',
      },
      addRoomDialog: {
        title: e?.addRoomDialog?.title ?? '',
        description: e?.addRoomDialog?.description ?? '',
        fields: {
          roomName: e?.addRoomDialog?.fields?.roomName ?? '',
        },
        actions: {
          cancel: e?.addRoomDialog?.actions?.cancel ?? '',
          save: e?.addRoomDialog?.actions?.save ?? '',
        },
        feedback: {
          submitting: e?.addRoomDialog?.feedback?.submitting ?? '',
        },
      },
      submitting: e?.feedback?.submitting ?? '',
    }
  }, [isEditMode, strings])






  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  const [roomsLoading, setRoomsLoading] = useState(false)
  const [roomsChoices, setRoomsChoices] = useState<RoomChoice[]>([])
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<number>>(new Set())

  // Track room creations triggered from the nested modal so we can clean up if the editor is canceled.
  const [newRoomIds, setNewRoomIds] = useState<number[]>([])

  // Add-new-room nested modal
  const [addRoomOpen, setAddRoomOpen] = useState(false)

  const [addRoomName, setAddRoomName] = useState('')
  const [addRoomLoading, setAddRoomLoading] = useState(false)
  const [addRoomError, setAddRoomError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setLoading(false)
    setError(null)

    setName('')
    setAddress('')

    setRoomsLoading(false)
    setRoomsChoices([])

    setAddRoomOpen(false)
    setAddRoomName('')
    setAddRoomLoading(false)
    setAddRoomError(null)

    setNewRoomIds([])
  }, [])

  const close = useCallback(() => {
    if (loading || addRoomLoading) return
    resetForm()
    onClose()
  }, [addRoomLoading, loading, onClose, resetForm])

  const cleanupNewRooms = useCallback(async () => {
    if (!supabase) return
    if (newRoomIds.length === 0) return

    // Best-effort cleanup: delete rooms created from the nested modal.
    // If deletion is blocked by FK constraints or a room is referenced elsewhere, we ignore cleanup failures.
    try {
      const sb = supabase
      const deletePromises = newRoomIds.map((id) => sb!.from('room').delete().eq('id', id))
      const results = await Promise.all(deletePromises)
      const firstError = results.find((r) => r.error)?.error
      if (firstError) throw firstError
    } catch {
      // Intentionally ignore cleanup failures.
    }
  }, [newRoomIds])

  const closeAndCleanup = useCallback(async () => {
    if (loading || addRoomLoading) return
    await cleanupNewRooms()
    close()
  }, [addRoomLoading, close, cleanupNewRooms, loading])

const loadForEdit = useCallback(async () => {

    if (!supabase) return
    if (!isEditMode || !locationId) return

    setError(null)
    setLoading(true)

    try {
      const { data: locData, error: locError } = await supabase
        .from('location')
        .select('id, name, address')
        .eq('id', locationId)
        .single()

      if (locError) throw locError

      setName(String((locData?.name as string | null) ?? ''))
      setAddress(String((locData?.address as string | null) ?? ''))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(editorStrings.feedback.loadFailed))

    } finally {
      setLoading(false)
    }
  }, [editorStrings.feedback.loadFailed, isEditMode, locationId])

  // Only show rooms already associated with the selected location.
  // This also keeps semantics aligned with the “room is associated with a single location” caveat.
  const loadRoomsForLocation = useCallback(async () => {
    if (!supabase) return
    if (!isEditMode || !locationId) {
      setRoomsChoices([])
      setSelectedRoomIds(new Set())
      return
    }

    setRoomsLoading(true)
    setError(null)

    try {
      // Use RPC get_rooms_for_location(location_id) to fetch rooms associated with the location.
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_rooms_for_location', { p_location_id: locationId })
      if (rpcError) throw rpcError
      if (!rpcData) throw new Error('No data returned from get_rooms_for_location()')

      const mapped = rpcData as unknown as RoomChoice[]

      // Sort for stable UX
      mapped.sort((a, b) => a.room_name.localeCompare(b.room_name))

      setRoomsChoices(mapped)
      setSelectedRoomIds(new Set(mapped.map((r) => r.room_id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(editorStrings.feedback.loadRoomsFailed))
    } finally {
      setRoomsLoading(false)
    }
  }, [editorStrings.feedback.loadRoomsFailed, isEditMode, locationId])


  useEffect(() => {
    if (!isOpen) return
    if (!canWrite) return

    void (async () => {
      // For create mode we still clear rooms; for edit mode we load location + its rooms.
      resetForm()
      if (isEditMode) {
        await loadForEdit()
      }
      await loadRoomsForLocation()
    })()
  }, [canWrite, isEditMode, isOpen, locationId, loadForEdit, loadRoomsForLocation, resetForm])



  const createRoomModalClose = useCallback(() => {
    if (addRoomLoading) return
    setAddRoomOpen(false)
    setAddRoomName('')
    setAddRoomError(null)
  }, [addRoomLoading])

  // In create mode, we need a saved locationId before we can associate new rooms.
  // We enforce: add-new-room nested modal is only enabled after location has been created (i.e. after first Save).
  const handleAddRoom = useCallback(async () => {

    if (!supabase) return
    if (!canWrite) return
    if (!locationId || !isEditMode) {
      setAddRoomError(editorStrings.feedback.roomsCreateRequiresSavedLocation)
      return
    }


    const trimmed = addRoomName.trim()
    if (!trimmed) return

    // Disallow duplicate room names for the same location.
    // Use the existing RPC used for loading rooms for the location.
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_rooms_for_location', {
        p_location_id: locationId,
      })

      if (rpcError) throw rpcError

      const mapped = rpcData as unknown as RoomChoice[]
      const inputLower = trimmed.toLocaleLowerCase()

      const existsForLocation = mapped.some(
        (r) => r.room_name?.toLocaleLowerCase() === inputLower,
      )

      if (existsForLocation) {
        setAddRoomError(editorStrings.feedback.duplicateRoomForLocation)
        return
      }
    } catch {
      // Best-effort: if the duplicate check fails, allow the create attempt to proceed.
    }


    setAddRoomLoading(true)
    setAddRoomError(null)

    try {
      // Create/ensure room by unique name
      // Note: room must be associated with the selected location only.
      const { data: createdRooms, error: roomCreateError } = await supabase
        .from('room')
        .insert({ name: trimmed })
        .select('id, name')

      if (roomCreateError) throw roomCreateError

      const createdRoomId = (createdRooms?.[0]?.id as number | undefined) ?? null
      if (!createdRoomId) throw new Error(editorStrings.feedback.createRoomFailed)

      // Associate to current location
      // Use `insert(...).select()` so Supabase returns the inserted row and errors are surfaced reliably.
      const { data: assocData, error: assocError } = await supabase
        .from('location_rooms')
        .insert({ location: locationId, room: createdRoomId })
        .select('id, location, room')

      if (assocError) throw assocError
      if (!assocData || assocData.length === 0) throw new Error(editorStrings.feedback.createRoomFailed)

      setNewRoomIds((prev) => (prev.includes(createdRoomId) ? prev : [...prev, createdRoomId]))

      // Update UI selection and list: new room should be checked.
      const newChoice: RoomChoice = { room_id: createdRoomId, room_name: trimmed }

      // Ensure UI selection includes the new association before the user hits Save.
      setSelectedRoomIds((prev) => {
        const next = new Set(prev)
        next.add(createdRoomId)
        return next
      })

      setRoomsChoices((prev) => {
        const exists = prev.some((r) => r.room_id === createdRoomId)
        if (exists) return prev
        const next = [...prev, newChoice]
        next.sort((a, b) => a.room_name.localeCompare(b.room_name))
        return next
      })


      setAddRoomOpen(false)
      setAddRoomName('')
      setAddRoomError(null)
    } catch (e) {
      setAddRoomError(e instanceof Error ? e.message : editorStrings.feedback.createRoomFailed)
    } finally {
      setAddRoomLoading(false)
    }
  }, [addRoomName, canWrite, isEditMode, locationId, editorStrings])

  const submitDisabled = useMemo(() => {
    if (!canWrite) return true
    if (!supabase) return true
    if (loading) return true
    if (roomsLoading) return true

    const trimmedName = name.trim()
    if (!trimmedName) return true

    // Rooms are optional.
    return false
  }, [canWrite, loading, name, roomsLoading])

  const handleSubmit = useCallback(async () => {
    if (!supabase) return
    if (!canWrite) return

    const trimmedName = name.trim()
    const trimmedAddress = address.trim()
    if (!trimmedName) return

    setError(null)
    setLoading(true)

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const userId = session?.user?.id
      if (!userId) {
        throw new Error(messages.auth.feedback.error)
      }


      // Save location
      let targetLocationId: number | null = null

      if (isEditMode && locationId) {
        const { error: updateLocError } = await supabase
          .from('location')
          .update({ name: trimmedName, address: trimmedAddress || null })
          .eq('id', locationId)

        if (updateLocError) throw updateLocError
        targetLocationId = locationId
      } else {
        const { data: createdLocations, error: createLocError } = await supabase
          .from('location')
          .insert({ name: trimmedName, address: trimmedAddress || null })
          .select('id')

        if (createLocError) throw createLocError

        const createdLocationId = (createdLocations?.[0]?.id as number | undefined) ?? null
        if (!createdLocationId) throw new Error(editorStrings.feedback.createFailed)
        targetLocationId = createdLocationId
      }

      if (!targetLocationId) throw new Error(editorStrings.feedback.createFailed)

      // Replace associations for that location
      const { error: deleteAssocError } = await supabase
        .from('location_rooms')
        .delete()
        .eq('location', targetLocationId)

      if (deleteAssocError) throw deleteAssocError

      const assocRows = Array.from(selectedRoomIds).map((roomId) => ({
        location: targetLocationId,
        room: roomId,
      }))

      if (assocRows.length > 0) {
        const { error: assocError } = await supabase.from('location_rooms').insert(assocRows)
        if (assocError) throw assocError
      }

      setLoading(false)
      onSaved?.()
      resetForm()
      onClose()

      // Note: nested room creations are already created in DB during editor session.
      // If you cancel after creating rooms, cleanupNewRooms() will delete those rooms.
    } catch (e) {
      const msg = e instanceof Error ? e.message : editorStrings.feedback.createFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [address, canWrite, editorStrings.feedback.createFailed, isEditMode, locationId, name, onClose, onSaved, resetForm, selectedRoomIds, messages.auth.feedback.error])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editorStrings.title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) void closeAndCleanup()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: 'var(--shadow)',
          textAlign: 'left',
          padding: 16,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0' }}>{editorStrings.title}</h3>
            <p style={{ margin: 0, color: 'var(--text)' }}>{editorStrings.description}</p>
          </div>
          <button
            type="button"
            onClick={() => void closeAndCleanup()}
            aria-label={messages.menu.close}
            disabled={loading}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
          style={{ display: 'grid', gap: 10, marginTop: 14 }}
        >
          <label htmlFor="location-editor-name" style={{ textAlign: 'left' }}>
            {editorStrings.fields.name}
          </label>
          <input
            id="location-editor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            required
            placeholder={editorStrings.fields.name}
            disabled={loading}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />

          <label htmlFor="location-editor-address" style={{ textAlign: 'left' }}>
            {editorStrings.fields.address}
          </label>
          <input
            id="location-editor-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            type="text"
            required={false}
            placeholder={editorStrings.fields.address}
            disabled={loading}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          />

          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600 }}>{editorStrings.rooms.title}</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{editorStrings.rooms.description}</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 10 }}>

              <button
                type="button"
                onClick={() => {
                  if (!canWrite || loading) return
                  setAddRoomOpen(true)
                  setAddRoomName('')
                  setAddRoomError(null)
                }}
                disabled={loading || roomsLoading || !isEditMode || !locationId}
                style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}
                title={!isEditMode || !locationId ? editorStrings.rooms.addRequiresSavedLocation : undefined}
              >
                {editorStrings.rooms.addRoom}
              </button>
            </div>

            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 10,
                marginTop: 8,
                maxHeight: 260,
                overflow: 'auto',
              }}
            >
              {roomsLoading ? (
                <div style={{ opacity: 0.85 }}>{editorStrings.rooms.loadingRooms}</div>
              ) : roomsChoices.length === 0 ? (
                <div style={{ opacity: 0.85 }}>{editorStrings.rooms.noneAssociated}</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {roomsChoices.map((r) => (
                        <tr key={r.room_id}>
                          <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 6px' }}>{r.room_name}</td>
                          <td
                            style={{
                              borderBottom: '1px solid var(--border)',
                              padding: '8px 6px',
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (loading || roomsLoading) return
                                // Remove this room association from the current location.
                                // (Rooms themselves are owned only by the location association UI; deleting the association
                                // is the correct behavior. If DB schema uses ON DELETE CASCADE for related rows,
                                // you can still optionally delete the room entity separately in another flow.)
                                void (async () => {
                                  if (!supabase) return
                                  if (!locationId) return

                                  const { error: deleteError } = await supabase
                                    .from('location_rooms')
                                    .delete()
                                    .eq('location', locationId)
                                    .eq('room', r.room_id)

                                  if (deleteError) {
                                    setError(deleteError.message)
                                    return
                                  }

                                  // Remove this room from the UI list
                                  setRoomsChoices((prev) => prev.filter((room) => room.room_id !== r.room_id))
                                  setSelectedRoomIds((prev) => {
                                    const next = new Set(prev)
                                    next.delete(r.room_id)
                                    return next
                                  })
                                })()
                              }}
                              disabled={loading || roomsLoading}
                              style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                              aria-label={editorStrings.rooms.tableDeleteLabel}
                              title={editorStrings.rooms.tableDeleteLabel}
                            >
                              {editorStrings.rooms.tableDeleteLabel}
                            </button>

                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {error ? (
            <div style={{ color: 'crimson' }}>
              <strong>{messages.auth.feedback.error}</strong> {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <button
              type="button"
              onClick={() => void closeAndCleanup()}
              disabled={loading}
              style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              {editorStrings.actions.cancel}
            </button>
            <button type="submit" disabled={submitDisabled} style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}>
              {loading ? editorStrings.submitting : editorStrings.actions.save}

            </button>
          </div>
        </form>

        {addRoomOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              zIndex: 60,
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) createRoomModalClose()
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 520,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: 'var(--shadow)',
                textAlign: 'left',
                padding: 16,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0' }}>{editorStrings.addRoomDialog.title}</h3>
                  <p style={{ margin: 0, color: 'var(--text)' }}>{editorStrings.addRoomDialog.description}</p>
                </div>
                <button
                  type="button"
                  onClick={createRoomModalClose}
                  aria-label={messages.menu.close}
                  disabled={addRoomLoading}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text)',
                    cursor: addRoomLoading ? 'not-allowed' : 'pointer',
                    fontSize: 20,
                    lineHeight: 1,
                    padding: 4,
                  }}
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleAddRoom()
                }}
                style={{ display: 'grid', gap: 10, marginTop: 14 }}
              >
                <label htmlFor="location-editor-add-room-name" style={{ textAlign: 'left' }}>
                  {editorStrings.addRoomDialog.fields.roomName}
                </label>
                <input
                  id="location-editor-add-room-name"
                  value={addRoomName}
                  onChange={(e) => setAddRoomName(e.target.value)}
                  type="text"
                  required
                  placeholder={editorStrings.addRoomDialog.fields.roomName}
                  disabled={addRoomLoading}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                  }}
                />

                {addRoomError ? (
                  <div style={{ color: 'crimson' }}>
                    <strong>{messages.auth.feedback.error}</strong> {addRoomError}
                  </div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={createRoomModalClose}
                    disabled={addRoomLoading}
                    style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    {editorStrings.addRoomDialog.actions.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={addRoomLoading || !addRoomName.trim() || !isEditMode || !locationId}
                    style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    {addRoomLoading ? editorStrings.addRoomDialog.feedback.submitting : editorStrings.addRoomDialog.actions.save}
                  </button>
                </div>
              </form>

              {!isEditMode || !locationId ? (
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
                  {editorStrings.rooms.addRequiresSavedLocation}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

