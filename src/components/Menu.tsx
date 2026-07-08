import type { Messages } from '../i18n'

export type AppPanel = 'items' | 'bases' | 'locations' | 'movements' | 'profile'


type MenuProps = {
  messages: Messages
  activePanel: AppPanel
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

export default function Menu({ messages, activePanel, onSelectPanel, onSignOut }: MenuProps) {
  return (
    <nav aria-label={messages.menu.ariaLabel} className="menu-panel">
      <section className="menu-section">
        <h3 className="menu-title">{messages.menu.system.title}</h3>
        <div className="menu-list">
          <MenuButton
            label={messages.menu.system.items}
            selected={activePanel === 'items'}
            onClick={() => onSelectPanel('items')}
          />
          <MenuButton
            label={'Bases'}
            selected={activePanel === 'bases'}
            onClick={() => onSelectPanel('bases')}
          />
          <MenuButton
            label={messages.menu.system.locations}
            selected={activePanel === 'locations'}
            onClick={() => onSelectPanel('locations')}
          />

          <MenuButton
            label={messages.menu.system.movements}
            selected={activePanel === 'movements'}
            onClick={() => onSelectPanel('movements')}
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
    </nav>
  )
}
