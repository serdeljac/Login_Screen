import { GoogleIcon, FacebookIcon } from './icons.jsx'

/**
 * The strip along the bottom of the form half.
 *
 * The hairline border runs the full width of the half, but the contents sit in
 * a centred wrapper capped to the same max-width as the form above, so the
 * three items stay lined up with the fields instead of drifting apart on a
 * wide monitor.
 *
 * These buttons are inert for now. Wiring the Google one up is the "or Gmail"
 * half of the project and happens after the email flow works — see step 5 in
 * CLAUDE.md. Real OAuth means redirecting the browser to Google, so there is
 * nothing useful to do here until the Node server exists to redirect back to.
 */
export default function SocialLogin({ mode }) {
  const verb = mode === 'signup' ? 'Sign Up' : 'Login'

  return (
    <div className="social">
      <div className="social__inner">
        <span className="social__label">Or {verb} With</span>

        <button type="button" className="social__button">
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
