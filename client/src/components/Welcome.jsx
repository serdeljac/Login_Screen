import './Welcome.css'

/**
 * Where you land after signing up or logging in.
 *
 * Still blank on purpose — it is the placeholder for whatever the real app
 * becomes. The line of text and the button are the only things here.
 */
export default function Welcome({ user, onLogout }) {
  return (
    <div className="welcome">
      <p className="welcome__note">Signed in as {user.email}</p>

      <button type="button" className="welcome__logout" onClick={onLogout}>
        LOG OUT
      </button>
    </div>
  )
}
