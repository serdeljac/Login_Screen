import { useEffect, useState } from 'react'
import AuthCard from './components/AuthCard.jsx'
import Welcome from './components/Welcome.jsx'
import './App.css'

export default function App() {
  // Who is signed in, or null. This one value decides which screen the whole
  // app shows, which is why it lives up here rather than inside the card:
  // state belongs at the lowest component that contains everyone who needs it.
  const [user, setUser] = useState(null)

  // Until /api/me answers, the app genuinely does not know whether anyone is
  // signed in. Without this flag it would assume "nobody", flash the login
  // screen, and then replace it — an ugly blink on every refresh.
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    // Runs once, after the first render. Note there is nothing to send: the
    // browser attaches the session cookie by itself, so this is simply the app
    // asking the server "is anyone already signed in here?"
    fetch('/api/me')
      // 401 is the normal answer for a visitor who is not signed in, so it is
      // not treated as an error.
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setUser(data.user)
      })
      .catch(() => {
        // Server down. Nothing to do but show the login screen.
      })
      .finally(() => setCheckingSession(false))
  }, []) // The empty array means "run once", not after every render.

  async function handleLogout() {
    // Tell the server first — that is what actually ends the session. Clearing
    // `user` only changes what this browser tab is showing.
    await fetch('/api/logout', { method: 'POST' })
    setUser(null)
  }

  // Deliberately blank for the fraction of a second the check takes.
  if (checkingSession) return <main className="page" />

  // "Navigation" without a router. Swapping which component is rendered looks
  // exactly like a page change to the person using it — the URL never changes.
  return (
    <main className="page">
      {user ? (
        <Welcome user={user} onLogout={handleLogout} />
      ) : (
        <AuthCard onAuthenticated={setUser} />
      )}
    </main>
  )
}
