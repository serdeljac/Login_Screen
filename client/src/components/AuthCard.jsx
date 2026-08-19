import { useState } from 'react'
import SidePanel from './SidePanel.jsx'
import AuthForm from './AuthForm.jsx'
import './AuthCard.css'

export default function AuthCard() {
  const [mode, setMode] = useState('login')

  return (
    <section className="auth-card">
      <SidePanel mode={mode} onModeChange={setMode} />
      <AuthForm mode={mode} />
    </section>
  )
}
