import { useState } from 'react'
import AuthCard from './components/AuthCard.jsx'
import Welcome from './components/Welcome.jsx'
import './App.css'

export default function App() {
  // Who is signed in, or null. This one value decides which screen the whole
  // app shows, which is why it lives up here rather than inside the card:
  // state belongs at the lowest component that contains everyone who needs it.
  const [user, setUser] = useState(null)

  // "Navigation" without a router. Swapping which component is rendered looks
  // exactly like a page change to the person using it. Two consequences worth
  // knowing: the URL never changes, and a refresh drops you back at the login
  // screen, because `user` only lives in memory. Staying signed in across a
  // refresh is what stage 4 (sessions) adds.
  return (
    <main className="page">
      {user ? <Welcome user={user} /> : <AuthCard onAuthenticated={setUser} />}
    </main>
  )
}
