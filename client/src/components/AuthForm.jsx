import { useState } from 'react'
import Field from './Field.jsx'
import SocialLogin from './SocialLogin.jsx'
import { UserBadgeIcon, UserIcon, LockIcon } from './icons.jsx'
import './AuthForm.css'

/**
 * The white right-hand half of the screen.
 *
 * NOTE (step 1 of the project): this form deliberately does not do anything on
 * submit. It renders, it tracks what you type, and it stops the browser's
 * default page reload — that is all. Talking to a server is step 3.
 *
 * Props:
 *   mode  'login' | 'signup' — decides the heading, the fields and the button
 */
export default function AuthForm({ mode }) {
  const isSignUp = mode === 'signup'

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

  function handleSubmit(event) {
    // Without this the browser reloads the page and the React state is lost.
    event.preventDefault()

    // STEP 3 — this is where the request to the Node server will go:
    //   await fetch('/api/register', { method: 'POST', ... })
    // Left empty on purpose so the UI can be finished first.
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
              <span className="auth-form__hint">Already have an account?</span>
            ) : (
              <a className="auth-form__link" href="#forgot-password">
                Forgot Password?
              </a>
            )}

            <button type="submit" className="auth-form__submit">
              {isSignUp ? 'SIGN UP' : 'LOGIN'}
            </button>
          </div>
        </div>
      </form>

      <SocialLogin mode={mode} />
    </div>
  )
}
