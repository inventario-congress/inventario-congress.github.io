import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'

type NamedRow = {
  id: number
  name: string
}

type CountableEditorProps = {
  messages: Messages
  canWrite: boolean
  isOpen: boolean
  countableId?: number | null
  onClose: () => void
  onSaved?: () => void
  onCategoriesChanged?: () => void
  initialCategoryId?: number | null
}

// Ugly hard-coding of the specific room id in which countables are spawned when created
const CENTRAL_WAREHOUSE_ROOM_ID = 110

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 10,
  borderRadius: 6,
  border: '1px solid var(--border)',
} as const

export default function CountableEditor({ messages, canWrite, isOpen, onClose, onSaved, onCategoriesChanged, countableId, initialCategoryId }: CountableEditorProps) {
  const isEditMode = typeof countableId === 'number' && countableId > 0

  const editorStrings = messages.countables.dialogs.editor
  const addCategoryStrings = editorStrings.addNewCategoryDialog

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [originalQuantity, setOriginalQuantity] = useState<number | null>(null)

  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categories, setCategories] = useState<NamedRow[]>([])
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<number | ''>('')

  const [roomsLoading, setRoomsLoading] = useState(false)
  const [rooms, setRooms] = useState<NamedRow[]>([])
  const [roomsError, setRoomsError] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<number | ''>('')

  // Add-new-category nested modal
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [addCategoryName, setAddCategoryName] = useState('')
  const [addCategoryLoading, setAddCategoryLoading] = useState(false)
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null)

  // Categories created from the nested modal, so they can be removed if the editor is canceled.
  const [newCategoryIds, setNewCategoryIds] = useState<number[]>([])

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setName('')
    setQuantity('')
    setOriginalQuantity(null)

    setCategoriesLoading(false)
    setCategories([])
    setCategoriesError(null)
    setCategoryId('')

    setRoomsLoading(false)
    setRooms([])
    setRoomsError(null)
    setRoomId('')

    setAddCategoryOpen(false)
    setAddCategoryName('')
    setAddCategoryLoading(false)
    setAddCategoryError(null)

    setNewCategoryIds([])
  }, [])

  const close = useCallback(() => {
    if (loading || addCategoryLoading) return
    reset()
    onClose()
  }, [addCategoryLoading, loading, onClose, reset])

  const cleanupNewCategories = useCallback(async () => {
    if (!supabase) return
    if (newCategoryIds.length === 0) return

    try {
      const sb = supabase
      const results = await Promise.all(newCategoryIds.map((id) => sb.from('countable_category').delete().eq('id', id)))
      const firstError = results.find((r) => r.error)?.error
      if (firstError) throw firstError
    } catch {
      // Best-effort cleanup: FK constraints may block the deletion, which must not block canceling.
    }
  }, [newCategoryIds])

  const closeAndCleanup = useCallback(async () => {
    if (loading || addCategoryLoading) return
    await cleanupNewCategories()
    close()
  }, [addCategoryLoading, cleanupNewCategories, close, loading])

  const loadCategories = useCallback(async () => {
    if (!supabase) return

    setCategoriesLoading(true)
    setCategoriesError(null)

    try {
      const { data, error: loadError } = await supabase
        .from('countable_category')
        .select('id, name')
        .order('name', { ascending: true })

      if (loadError) throw loadError

      setCategories((data ?? []).map((c) => ({ id: c.id as number, name: c.name as string })))
    } catch (e) {
      setCategoriesError(e instanceof Error ? e.message : editorStrings.feedback.loadFailed)
    } finally {
      setCategoriesLoading(false)
    }
  }, [editorStrings.feedback.loadFailed])

  const loadRooms = useCallback(async () => {
    if (!supabase) return

    setRoomsLoading(true)
    setRoomsError(null)

    try {
      const { data, error: loadError } = await supabase
        .from('room')
        .select('id, name')
        .order('name', { ascending: true })

      if (loadError) throw loadError

      setRooms((data ?? []).map((r) => ({ id: r.id as number, name: r.name as string })))
    } catch (e) {
      setRoomsError(e instanceof Error ? e.message : editorStrings.feedback.loadFailed)
    } finally {
      setRoomsLoading(false)
    }
  }, [editorStrings.feedback.loadFailed])

  const loadForEdit = useCallback(async () => {
    if (!supabase) return
    if (!isEditMode || !countableId) return

    setError(null)
    setLoading(true)

    try {
      const { data, error: loadError } = await supabase
        .from('countable')
        .select('id, name, category, quantity')
        .eq('id', countableId)
        .single()

      if (loadError) throw loadError

      setName((data?.name as string) ?? '')
      setCategoryId((data?.category as number) ?? '')
      setQuantity(String((data?.quantity as number | null) ?? ''))
      setOriginalQuantity((data?.quantity as number | null) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : editorStrings.feedback.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [countableId, editorStrings.feedback.loadFailed, isEditMode])

  useEffect(() => {
    if (!isOpen || !canWrite) return

    void (async () => {
      // Rooms are only needed to choose where to add/deduct stock when editing an existing countable.
      await Promise.all([loadCategories(), isEditMode ? loadRooms() : Promise.resolve()])
      if (!isEditMode && initialCategoryId) setCategoryId(initialCategoryId)
      await loadForEdit()
    })()
  }, [canWrite, initialCategoryId, isEditMode, isOpen, loadCategories, loadForEdit, loadRooms])

  useEffect(() => {
    if (!isOpen) return
    if (categoryId === '' || categories.length === 0) return
    if (!categories.some((c) => c.id === categoryId)) {
      queueMicrotask(() => setCategoryId(''))
    }
  }, [categories, categoryId, isOpen])

  const parsedQuantity = Number.parseInt(quantity, 10)
  const quantityChanged = !isEditMode || parsedQuantity !== originalQuantity
  // When editing, a room is needed whenever stock is added (grow) or deducted (shrink).
  const roomRequired = isEditMode && quantityChanged

  const submitDisabled = useMemo(() => {
    if (!canWrite) return true
    if (!supabase) return true
    if (loading) return true
    if (categoriesLoading || roomsLoading) return true

    if (!name.trim()) return true
    if (categoryId === '') return true
    if (Number.isNaN(parsedQuantity) || parsedQuantity < 0) return true
    if (roomRequired && roomId === '') return true

    return false
  }, [canWrite, categoriesLoading, categoryId, loading, name, parsedQuantity, roomId, roomRequired, roomsLoading])

  const closeAddCategoryModal = useCallback(() => {
    if (addCategoryLoading) return
    setAddCategoryOpen(false)
    setAddCategoryName('')
    setAddCategoryError(null)
  }, [addCategoryLoading])

  const handleAddCategory = useCallback(async () => {
    if (!supabase) return
    if (!canWrite) return

    const trimmed = addCategoryName.trim()
    if (!trimmed) return

    setAddCategoryLoading(true)
    setAddCategoryError(null)

    try {
      const existing = categories.find((c) => c.name === trimmed)
      if (existing) {
        setCategoryId(existing.id)
      } else {
        const { data, error: createError } = await supabase
          .from('countable_category')
          .insert({ name: trimmed })
          .select('id')
          .single()

        if (createError) throw createError

        await loadCategories()

        const createdId = data?.id as number | undefined
        if (typeof createdId === 'number' && !Number.isNaN(createdId)) {
          setCategoryId(createdId)
          setNewCategoryIds((prev) => (prev.includes(createdId) ? prev : [...prev, createdId]))
          onCategoriesChanged?.()
        }
      }

      setAddCategoryOpen(false)
      setAddCategoryName('')
      setAddCategoryError(null)
    } catch (e) {
      setAddCategoryError(e instanceof Error ? e.message : editorStrings.feedback.addNewCategoryCreateFailed)
    } finally {
      setAddCategoryLoading(false)
    }
  }, [addCategoryName, canWrite, categories, editorStrings.feedback.addNewCategoryCreateFailed, loadCategories, onCategoriesChanged])

  const handleSubmit = useCallback(async () => {
    if (!supabase) return
    if (!canWrite) return
    if (categoryId === '' || Number.isNaN(parsedQuantity)) return

    const trimmedName = name.trim()
    if (!trimmedName) return

    setError(null)
    setLoading(true)

    try {
      if (isEditMode && countableId) {
        const { error: updateError } = await supabase
          .from('countable')
          .update({ name: trimmedName, category: categoryId })
          .eq('id', countableId)

        if (updateError) throw updateError

        if (quantityChanged) {
          if (roomId === '') return
          const { error: rpcError } = await supabase.rpc('change_countable_quantity', {
            p_countable: countableId,
            p_new_quantity: parsedQuantity,
            p_room: roomId,
          })

          if (rpcError) throw rpcError
        }
      } else {
        const { error: rpcError } = await supabase.rpc('create_countable', {
          p_name: trimmedName,
          p_category: categoryId,
          p_quantity: parsedQuantity,
          // Hard-coded room id 110: the central warehouse, where new countables are initially stored.
          p_room: CENTRAL_WAREHOUSE_ROOM_ID,
        })

        if (rpcError) throw rpcError
      }

      // The categories are now referenced by a saved countable (or were reused), so keep them.
      setNewCategoryIds([])
      onSaved?.()
      close()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : isEditMode
            ? editorStrings.feedback.updateFailed
            : editorStrings.feedback.createFailed,
      )
    } finally {
      setLoading(false)
    }
  }, [
    canWrite,
    categoryId,
    close,
    countableId,
    editorStrings.feedback.createFailed,
    editorStrings.feedback.updateFailed,
    isEditMode,
    name,
    onSaved,
    parsedQuantity,
    quantityChanged,
    roomId,
  ])

  if (!isOpen) return null

  const title = isEditMode ? editorStrings.titleEdit : editorStrings.titleCreate

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
          maxWidth: 680,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: 'var(--shadow)',
          textAlign: 'left',
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0' }}>{title}</h3>
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
          <label htmlFor="countable-editor-name">{editorStrings.fields.name}</label>
          <input
            id="countable-editor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            required
            placeholder={editorStrings.fields.name}
            style={fieldStyle}
          />

          <label htmlFor="countable-editor-category">{editorStrings.fields.category}</label>
          <div>
            <select
              id="countable-editor-category"
              value={categoryId}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'add-new-category') {
                  setAddCategoryOpen(true)
                  setAddCategoryName('')
                  setAddCategoryError(null)
                  return
                }

                const parsed = Number.parseInt(v, 10)
                setCategoryId(Number.isNaN(parsed) ? '' : parsed)
              }}
              disabled={loading || categoriesLoading}
              style={fieldStyle}
            >
              <option value="">{editorStrings.fields.category}</option>

              {categoriesLoading ? (
                <option value="" disabled>
                  {editorStrings.feedback.loadingCategories}
                </option>
              ) : categories.length === 0 ? (
                <option value="" disabled>
                  {editorStrings.feedback.noCategories}
                </option>
              ) : (
                categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}

              <option value="add-new-category">{editorStrings.feedback.addNewCategory}</option>
            </select>

            {categoriesError ? (
              <div style={{ color: 'crimson', marginTop: 6, fontSize: 13 }}>
                <strong>{messages.auth.feedback.error}</strong> {categoriesError}
              </div>
            ) : null}
          </div>

          <label htmlFor="countable-editor-quantity">{editorStrings.fields.quantity}</label>
          <input
            id="countable-editor-quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            min={0}
            max={32767}
            step={1}
            required
            placeholder={editorStrings.fields.quantity}
            style={fieldStyle}
          />

          {roomRequired ? (
            <>
              <label htmlFor="countable-editor-room">
                {editorStrings.fields.roomForChange}
              </label>
              <div>
                <select
                  id="countable-editor-room"
                  value={roomId}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10)
                    setRoomId(Number.isNaN(parsed) ? '' : parsed)
                  }}
                  disabled={loading || roomsLoading}
                  required
                  style={fieldStyle}
                >
                  <option value="">{editorStrings.fields.room}</option>

                  {roomsLoading ? (
                    <option value="" disabled>
                      {editorStrings.feedback.loadingRooms}
                    </option>
                  ) : rooms.length === 0 ? (
                    <option value="" disabled>
                      {editorStrings.feedback.noRooms}
                    </option>
                  ) : (
                    rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))
                  )}
                </select>

                {roomsError ? (
                  <div style={{ color: 'crimson', marginTop: 6, fontSize: 13 }}>
                    <strong>{messages.auth.feedback.error}</strong> {roomsError}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

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
              {loading ? editorStrings.feedback.submitting : editorStrings.actions.save}
            </button>
          </div>
        </form>

        {addCategoryOpen ? (
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
              if (e.target === e.currentTarget) closeAddCategoryModal()
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
                  <h3 style={{ margin: '0 0 6px 0' }}>{addCategoryStrings.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={closeAddCategoryModal}
                  aria-label={messages.menu.close}
                  disabled={addCategoryLoading}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text)',
                    cursor: addCategoryLoading ? 'not-allowed' : 'pointer',
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
                  void handleAddCategory()
                }}
                style={{ display: 'grid', gap: 10, marginTop: 14 }}
              >
                <label htmlFor="countable-editor-add-category-name">{addCategoryStrings.fields.categoryName}</label>
                <input
                  id="countable-editor-add-category-name"
                  value={addCategoryName}
                  onChange={(e) => setAddCategoryName(e.target.value)}
                  type="text"
                  required
                  placeholder={addCategoryStrings.fields.categoryName}
                  disabled={addCategoryLoading}
                  style={fieldStyle}
                />

                {addCategoryError ? (
                  <div style={{ color: 'crimson' }}>
                    <strong>{messages.auth.feedback.error}</strong> {addCategoryError}
                  </div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={closeAddCategoryModal}
                    disabled={addCategoryLoading}
                    style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    {addCategoryStrings.actions.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={addCategoryLoading || !addCategoryName.trim()}
                    style={{ padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    {addCategoryLoading ? addCategoryStrings.feedback.submitting : addCategoryStrings.actions.save}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
