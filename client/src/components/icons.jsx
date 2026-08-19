/**
 * Inline SVG icons.
 *
 * These are plain React components rather than an icon library so that nothing
 * has to be downloaded at runtime and every path is editable in place.
 * `currentColor` means an icon inherits the CSS `color` of whatever contains it.
 */

export function UserBadgeIcon(props) {
  // The large person mark inside the circular badge at the top of the card.
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" {...props}>
      <circle cx="20" cy="20" r="15.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="20" cy="16.5" r="4.8" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M11.6 30.2c1.1-4.2 4.4-6.8 8.4-6.8s7.3 2.6 8.4 6.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function UserIcon(props) {
  // Prefix icon for the email / name fields.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4.6a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Zm0 13.8a7.3 7.3 0 0 1-5.5-2.5c.5-1.9 3-3.3 5.5-3.3s5 1.4 5.5 3.3a7.3 7.3 0 0 1-5.5 2.5Z" />
    </svg>
  )
}

export function LockIcon(props) {
  // Prefix icon for the password fields.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.2 9.3h-.9V7.4a4.3 4.3 0 0 0-8.6 0v1.9h-.9c-.9 0-1.6.7-1.6 1.6v8c0 .9.7 1.6 1.6 1.6h10.4c.9 0 1.6-.7 1.6-1.6v-8c0-.9-.7-1.6-1.6-1.6ZM12 16.6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Zm2.7-7.3H9.3V7.4a2.7 2.7 0 0 1 5.4 0v1.9Z" />
    </svg>
  )
}

export function GoogleIcon(props) {
  // Google's four-colour "G" mark. Fixed brand colours, so no currentColor here.
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
      />
    </svg>
  )
}

export function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect width="24" height="24" rx="5" fill="#1877F2" />
      <path
        fill="#fff"
        d="M15.9 12.9h-2.4V20h-3.1v-7.1H8.6v-2.6h1.8V8.7c0-2 1.2-3.3 3.4-3.3l2.3.02V7.9h-1.5c-.6 0-.9.3-.9.9v1.5h2.4l-.2 2.6Z"
      />
    </svg>
  )
}
