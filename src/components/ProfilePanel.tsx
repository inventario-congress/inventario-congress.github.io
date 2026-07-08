import type { Messages } from '../i18n'

type ProfilePanelProps = {
  messages: Messages
  email: string | null
  name: string | null
  lastName: string | null
}

export default function ProfilePanel({ messages, email, name, lastName }: ProfilePanelProps) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 16, textAlign: 'left' }}>
      <h2 style={{ marginTop: 0 }}>{messages.profile.title}</h2>
      <p style={{ marginTop: 0 }}>{messages.profile.readOnly}</p>

      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <strong>{messages.profile.fields.name}</strong> {name ?? '-'}
        </div>
        <div>
          <strong>{messages.profile.fields.lastName}</strong> {lastName ?? '-'}
        </div>
        <div>
          <strong>{messages.profile.fields.email}</strong> {email ?? messages.auth.session.signedOut}
        </div>
      </div>
    </div>
  )
}
