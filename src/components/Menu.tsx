import type { Messages } from '../i18n'

export type AppPanel = 'microphones' | 'bases' | 'locations' | 'combos' | 'consoles' | 'profile' | 'bulkmoves' | 'history' | 'returns'


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
            label={messages.menu.inventory.consoles}
            selected={activePanel === 'consoles'}
            onClick={() => onSelectPanel('consoles')}
          />
          <MenuButton
            label={messages.menu.inventory.microphones}
            selected={activePanel === 'microphones'}
            onClick={() => onSelectPanel('microphones')}
          />
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
    </nav>
  )
}
