import { useEffect, useMemo, useState } from 'react'
import AuthPanel from './components/AuthPanel'
import { getPreferredLanguage, translations, type Language } from './i18n'
import './App.css'

function App() {
  const [language, setLanguage] = useState<Language>(() => getPreferredLanguage())
  const messages = useMemo(() => translations[language], [language])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = messages.meta.title
    window.localStorage.setItem('language', language)
  }, [language, messages.meta.title])

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 16px 0' }}>
        <label
          htmlFor="language"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span>{messages.languageSwitcher.label}</span>
          <select
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="en">{messages.languageSwitcher.options.en}</option>
            <option value="es">{messages.languageSwitcher.options.es}</option>
          </select>
        </label>
      </div>
      <AuthPanel messages={messages} />
    </main>
  )
}

export default App
