import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { Messages } from '../i18n'
import { supabase } from '../supabaseClient'
import CountableEditor from './CountableEditor'

export type AppPanel = 'microphones' | 'bases' | 'locations' | 'combos' | 'handhelds' | 'consoles' | 'cases' | 'profile' | 'bulkmoves' | 'history' | 'returns'


type MenuProps = {
  messages: Messages
  activePanel: AppPanel
  canWrite: boolean
  onSelectPanel: (panel: AppPanel) => void
  onSignOut: () => void
}

function MenuButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`menu-button ${selected ? 'selected' : ''}`}
    >
      {label}
    </button>
  )
}

export default function Menu({ messages, activePanel, canWrite, onSelectPanel, onSignOut }: MenuProps) {
  const [countablesExpanded, setCountablesExpanded] = useState(false)
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [editorOpen, setEditorOpen] = useState(false)

  const loadCategories = useCallback(async () => {
    if (!supabase) return

    const { data, error } = await supabase
      .from('countable_category')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) return
    setCategories((data ?? []).map((c) => ({ id: c.id as number, name: c.name as string })))
  }, [])

  useEffect(() => {
    void (async () => {
      await loadCategories()
    })()
  }, [loadCategories])

  const countablesStrings = messages.menu.inventory.countables

  return (
    <nav aria-label={messages.menu.ariaLabel} className="menu-panel">
      <section className="menu-section">
        <h3 className="menu-title">{messages.menu.system.title}</h3>
        <div className="menu-list">
          <MenuButton
            label={messages.returns.systemMenuLabel}
            selected={activePanel === 'returns'}
            onClick={() => onSelectPanel('returns')}
          />
          <MenuButton
            label={messages.history.systemMenuLabel}
            selected={activePanel === 'history'}
            onClick={() => onSelectPanel('history')}
          />
          {canWrite ? (
            <MenuButton
              label={messages.bulkMove.systemMenuLabel}
              selected={activePanel === 'bulkmoves'}
              onClick={() => onSelectPanel('bulkmoves')}
            />
          ) : null}
        </div>
      </section>

      <section className="menu-section">
        <h3 className="menu-title">{messages.menu.inventory.title}</h3>
        <div className="menu-list">
          <MenuButton
            label={messages.menu.inventory.bases}
            selected={activePanel === 'bases'}
            onClick={() => onSelectPanel('bases')}
          />
          <MenuButton
            label={messages.menu.inventory.combos}
            selected={activePanel === 'combos'}
            onClick={() => onSelectPanel('combos')}
          />
          <MenuButton
            label={messages.menu.inventory.handhelds}
            selected={activePanel === 'handhelds'}
            onClick={() => onSelectPanel('handhelds')}
          />
          <MenuButton
            label={messages.menu.inventory.consoles}
            selected={activePanel === 'consoles'}
            onClick={() => onSelectPanel('consoles')}
          />
          <MenuButton
            label={messages.menu.inventory.cases}
            selected={activePanel === 'cases'}
            onClick={() => onSelectPanel('cases')}
          />
          <MenuButton
            label={messages.menu.inventory.microphones}
            selected={activePanel === 'microphones'}
            onClick={() => onSelectPanel('microphones')}
          />
          <button
            type="button"
            className="menu-button"
            aria-expanded={countablesExpanded}
            aria-controls="menu-countables-list"
            onClick={() => setCountablesExpanded((v) => !v)}
          >
            {countablesExpanded ? '▾' : '▸'} {countablesStrings.title}
          </button>
          {countablesExpanded ? (
            <div id="menu-countables-list" className="menu-list" style={{ paddingLeft: 12 }}>
              {canWrite ? (
                <button type="button" className="menu-button" onClick={() => setEditorOpen(true)}>
                  {countablesStrings.add}
                </button>
              ) : null}
              {categories.map((c) => (
                // Category selection is not wired to a panel yet.
                <button key={c.id} type="button" className="menu-button">
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
          <MenuButton
            label={messages.menu.inventory.locations}
            selected={activePanel === 'locations'}
            onClick={() => onSelectPanel('locations')}
          />
        </div>
      </section>

      <section className="menu-section">
        <h3 className="menu-title">{messages.menu.user.title}</h3>
        <div className="menu-list">
          <MenuButton
            label={messages.menu.user.profile}
            selected={activePanel === 'profile'}
            onClick={() => onSelectPanel('profile')}
          />
          <button
            type="button"
            onClick={onSignOut}
            className="menu-button"
          >
            {messages.menu.user.signOut}
          </button>
        </div>
      </section>
      {/* Portaled because the mobile sidebar's transform would otherwise contain fixed positioning. */}
      {editorOpen
        ? createPortal(
            <CountableEditor
              messages={messages}
              canWrite={canWrite}
              isOpen={editorOpen}
              onClose={() => {
                setEditorOpen(false)
                void loadCategories()
              }}
              onCategoriesChanged={() => void loadCategories()}
            />,
            document.body,
          )
        : null}
    </nav>
  )
}
