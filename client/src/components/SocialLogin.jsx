import { GoogleIcon, FacebookIcon } from './icons.jsx'

/**
 * The strip along the bottom of the form half.
 *
 * The hairline border runs the full width of the half, but the contents sit in
 * a centred wrapper capped to the same max-width as the form above, so the
 * three items stay lined up with the fields instead of drifting apart on a
 * wide monitor.
 *
 * The Facebook button is still inert — it is not on the roadmap.
 */
export default function SocialLogin({ mode }) {
  const verb = mode === 'signup' ? 'Sign Up' : 'Login'

  function handleGoogle() {
    // A whole-page navigation, deliberately not a fetch.
    //
    // fetch() would be wrong twice over: the response is a redirect to
    // accounts.google.com, which the browser's same-origin rules will not let
    // this page read — and more importantly the user has to *see* Google's
    // login and consent screen. Handing the address bar over is the point.
    //
    // The URL is relative, so this hits Vite on 5173 and the proxy passes it to
    // the Node server, exactly like every other /api call.
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="social">
      <div className="social__inner">
        <span className="social__label">Or {verb} With</span>

        <button type="button" className="social__button" onClick={handleGoogle}>
          <GoogleIcon className="social__icon" />
          Google
        </button>

        <button type="button" className="social__button">
          <FacebookIcon className="social__icon" />
          Facebook
        </button>
      </div>
    </div>
  )
}
