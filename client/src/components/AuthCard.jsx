import { useState } from 'react'
import SidePanel from './SidePanel.jsx'
import AuthForm from './AuthForm.jsx'
import './AuthCard.css'

// onAuthenticated is not used here — it is handed straight down to the form,
// which is the only thing that knows when a signup succeeded. Passing a prop
// through a middle component like this is called prop drilling; at two levels
// it is far simpler than any alternative.
export default function AuthCard({ onAuthenticated }) {
  const [mode, setMode] = useState('login')

  return (
    <section className="auth-card">
      <SidePanel mode={mode} onModeChange={setMode} />
      <AuthForm mode={mode} onAuthenticated={onAuthenticated} />
    </section>
  )
}
