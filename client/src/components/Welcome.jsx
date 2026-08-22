import './Welcome.css'

/**
 * Where you land after signing up or logging in.
 *
 * Still blank on purpose — it is the placeholder for whatever the real app
 * becomes. The line of text and the button are the only things here.
 */
const PROVIDER_LABELS = { password: 'Password', google: 'Google' }

export default function Welcome({ user, onLogout }) {
  return (
    <div className="welcome">
      <p className="welcome__note">Signed in as {user.email}</p>

      {/* Two entries here means one account reachable two ways — the same
          address signed up with a password and later used the Google button. */}
      <p className="welcome__providers">
        Sign-in {user.providers.length > 1 ? 'methods' : 'method'}:{' '}
        {user.providers.map((provider) => PROVIDER_LABELS[provider]).join(' + ')}
      </p>

      <button type="button" className="welcome__logout" onClick={onLogout}>
        LOG OUT
      </button>
    </div>
  )
}
