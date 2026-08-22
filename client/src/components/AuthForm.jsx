import { useState } from 'react'
import Field from './Field.jsx'
import SocialLogin from './SocialLogin.jsx'
import { UserBadgeIcon, UserIcon, LockIcon } from './icons.jsx'
import './AuthForm.css'

/**
 * The right-hand half of the screen.
 *
 * Both modes submit to the Node server: sign-up creates the account, login
 * checks an existing one. Either way the server replies with a session cookie
 * and the user, and App swaps the screen.
 *
 * Props:
 *   mode             'login' | 'signup' — decides the heading, fields and button
 *   onAuthenticated  called with the user once the server has accepted them;
 *                    App reacts by swapping the whole screen
 */
export default function AuthForm({ mode, onAuthenticated }) {
  const isSignUp = mode === 'signup'

  // What the form is currently doing, and the one line of feedback shown to
  // the user. 'sending' exists so the button can be disabled while a request
  // is in flight — otherwise an impatient double-click sends two signups.
  const [status, setStatus] = useState('idle') // 'idle' | 'sending' | 'error'
  const [message, setMessage] = useState('')

  // One state object for the whole form. `handleChange` below writes into it
  // using each input's `name` attribute, so adding a field needs no new state.
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  function handleChange(event) {
    const { name, value } = event.target
    setValues((previous) => ({ ...previous, [name]: value }))
  }

  // `async` because sending a request takes time. The function pauses at each
  // `await` and lets the browser keep painting instead of freezing the page.
  async function handleSubmit(event) {
    // Without this the browser reloads the page and the React state is lost.
    event.preventDefault()

    // A check the server cannot do for us: only the browser knows what was
    // typed in the second password box. Client-side checks like this one are
    // for fast feedback only; the server must still validate everything,
    // because anything sent from a browser can be faked.
    if (isSignUp && values.password !== values.confirmPassword) {
      setStatus('error')
      setMessage('Passwords do not match.')
      return
    }

    setStatus('sending')
    setMessage('')

    // The two flows differ in exactly two ways: the route, and whether the name
    // travels with them. Everything after this point is identical, because both
    // routes answer the same shape — a session cookie plus the user.
    const endpoint = isSignUp ? '/api/register' : '/api/login'
    const payload = isSignUp
      ? { fullName: values.fullName, email: values.email, password: values.password }
      : { email: values.email, password: values.password }

    try {
      // The URL has no hostname, so it goes to whatever origin the page is on
      // (localhost:5173) and Vite's proxy forwards it to the Node server.
      const response = await fetch(endpoint, {
        method: 'POST',
        // Without this header Express does not know the body is JSON, and
        // express.json() will not parse it — req.body ends up empty.
        headers: { 'Content-Type': 'application/json' },
        // The body must be a string. JSON.stringify turns the object into one.
        body: JSON.stringify(payload),
      })

      // Reading the body is a second await: the headers arrive first, the body
      // streams in after.
      const data = await response.json()

      // Surprising but important: fetch only rejects when the request never
      // happened at all (server down, no network). A 400 or a 500 is still a
      // successful round trip, so failures have to be checked by hand.
      if (!response.ok) {
        setStatus('error')
        setMessage(data.error || 'Something went wrong.')
        return
      }

      // Hand the new user up to App, which swaps the screen. This component is
      // unmounted as a result, so there is no point setting any state here.
      onAuthenticated(data.user)
    } catch (error) {
      // Reached when the server is not running at all.
      setStatus('error')
      setMessage('Could not reach the server.')
    }
  }

  return (
    <div className="auth-form">
      <form className="auth-form__body" onSubmit={handleSubmit} noValidate>
        {/* The body fills the whole right-hand half of the screen, so this
            inner wrapper caps how wide the fields may grow and keeps the
            block centred within it. */}
        <div className="auth-form__inner">
          <span className="auth-form__badge">
            <UserBadgeIcon className="auth-form__badge-icon" />
          </span>

          <h1 className="auth-form__title">{isSignUp ? 'SIGN UP' : 'LOGIN'}</h1>

          <div className="auth-form__fields">
            {isSignUp && (
              <Field
                icon={<UserIcon />}
                name="fullName"
                type="text"
                placeholder="Full Name"
                autoComplete="name"
                value={values.fullName}
                onChange={handleChange}
              />
            )}

            <Field
              icon={<UserIcon />}
              name="email"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={values.email}
              onChange={handleChange}
            />

            <Field
              icon={<LockIcon />}
              name="password"
              type="password"
              placeholder="Password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={values.password}
              onChange={handleChange}
            />

            {isSignUp && (
              <Field
                icon={<LockIcon />}
                name="confirmPassword"
                type="password"
                placeholder="Confirm Password"
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={handleChange}
              />
            )}
          </div>

          <div className="auth-form__actions">
            {isSignUp ? (
              <span className="auth-form__hint">Don't have an account?</span>
            ) : (
              <a className="auth-form__link" href="#forgot-password">
                Forgot Password?
              </a>
            )}

            <button
              type="submit"
              className="auth-form__submit"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? '...' : isSignUp ? 'SIGN UP' : 'LOGIN'}
            </button>
          </div>

          {/* Always rendered, even when empty. A screen reader only announces
              changes inside a live region that already existed, so adding the
              element at the same moment as the text would say nothing. */}
          <p
            className={`auth-form__message auth-form__message--${status}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        </div>
      </form>

      <SocialLogin mode={mode} />
    </div>
  )
}
