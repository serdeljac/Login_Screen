import './Welcome.css'

/**
 * Where you land after signing up.
 *
 * Blank on purpose — it is the placeholder for whatever the real app becomes.
 * The one line of text is only there so it is obvious the swap happened;
 * delete it and this is a genuinely empty page.
 */
export default function Welcome({ user }) {
  return (
    <div className="welcome">
      <p className="welcome__note">Signed in as {user.email}</p>
    </div>
  )
}
