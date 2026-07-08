import type { Messages } from '../i18n'

export type AppPanel = 'items' | 'locations' | 'movements' | 'profile'

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
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: selected ? '2px solid var(--text-h)' : '1px solid var(--border)',
        background: selected ? 'var(--bg-soft)' : 'transparent',
        color: 'var(--text-h)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export default function Menu({ messages, activePanel, onSelectPanel, onSignOut }: MenuProps) {
  return (
    <nav
      aria-label={messages.menu.ariaLabel}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 12,
        display: 'grid',
        gap: 12,
        background: 'var(--bg-soft)',
      }}
    >
      <section style={{ display: 'grid', gap: 8, textAlign: 'left' }}>
        <h3 style={{ margin: 0 }}>{messages.menu.system.title}</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MenuButton
            label={messages.menu.system.items}
            selected={activePanel === 'items'}
            onClick={() => onSelectPanel('items')}
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

      <section style={{ display: 'grid', gap: 8, textAlign: 'left' }}>
        <h3 style={{ margin: 0 }}>{messages.menu.user.title}</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MenuButton
            label={messages.menu.user.profile}
            selected={activePanel === 'profile'}
            onClick={() => onSelectPanel('profile')}
          />
          <button
            type="button"
            onClick={onSignOut}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {messages.menu.user.signOut}
          </button>
        </div>
      </section>
    </nav>
  )
}
