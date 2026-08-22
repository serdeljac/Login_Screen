import express from 'express'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
// randomUUID is gone from here: the database generates user ids now.
import { randomBytes } from 'node:crypto'
import { checkConnection } from './db.js'
import {
  UNIQUE_VIOLATION,
  attachGoogleId,
  createUser,
  findUserByEmail,
  findUserById,
} from './users.js'

const app = express()
const PORT = 4000

// --- Google OAuth configuration ---------------------------------------------

// Read once at startup from server/.env, which npm run dev loads via Node's
// --env-file-if-exists flag. Secrets live in the environment rather than in the
// source so that the code can be committed and shared without them.
const GOOGLE = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
}

// Fail loudly and early rather than with a confusing error from Google later.
const googleConfigured = Boolean(
  GOOGLE.clientId && GOOGLE.clientSecret && GOOGLE.redirectUri,
)

// User storage now lives in PostgreSQL — see users.js for every statement, and
// schema.sql for the table. What used to be readUsers()/writeUsers() here was
// the whole file being rewritten on every signup.

// --- Sessions ---------------------------------------------------------------

// sessionId -> { userId, createdAt }
//
// Just a Map in memory, so every session vanishes when the server restarts —
// including every time `node --watch` reloads this file after a save. Real apps
// keep sessions in Redis or a database table, because a restart (or a second
// server behind a load balancer) must not sign everybody out.
const sessions = new Map()

const SESSION_COOKIE = 'sid'
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7 // 7 days, in milliseconds

function startSession(res, userId) {
  // 32 random bytes = 256 bits from a cryptographic random source, so the id
  // cannot be guessed or brute-forced. It carries no information at all: it is
  // a meaningless ticket stub, and only the server's Map knows which user it
  // points at. That is exactly why it is safe to hand to a browser — and why
  // deleting the entry instantly makes a stolen one worthless.
  const sessionId = randomBytes(32).toString('base64url')
  sessions.set(sessionId, { userId, createdAt: Date.now() })

  // res.cookie() just sets a Set-Cookie response header. From then on the
  // browser attaches it to every request to this origin automatically — there
  // is no client-side code for this at all.
  res.cookie(SESSION_COOKIE, sessionId, {
    // JavaScript on the page cannot read this cookie: no document.cookie, no
    // fetch, nothing. So a script injected into your page (XSS) cannot steal
    // the session. This is the one big advantage over keeping a token in
    // localStorage, which any script can read.
    httpOnly: true,

    // The browser will not attach this cookie to requests started by *other*
    // sites, which is what blocks the basic CSRF attack: evil.com submitting a
    // form to your API and having the browser helpfully sign it as you.
    sameSite: 'lax',

    // HTTPS-only. Must stay false here or the cookie is dropped on
    // http://localhost; must be true in production.
    secure: false,

    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

// The only shape of a user that is ever allowed out of this server. Writing it
// once means the password hash cannot leak by someone forgetting to strip it.
function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,

    // Which ways in this account has. Derived rather than stored, so it cannot
    // drift out of step with reality, and it deliberately says *whether* a
    // password exists without exposing anything about it.
    providers: [user.passwordHash && 'password', user.googleId && 'google'].filter(
      Boolean,
    ),
  }
}

// Middleware again — but this one guards. Put it in front of any route that
// requires a signed-in user:
//
//   app.get('/api/something', requireSession, handler)
//
// Express runs it first and it has two choices: answer the request itself
// (401, and the handler never runs), or call next() to pass control along. It
// leaves the user on `req` so the handler does not have to look them up again.
async function requireSession(req, res, next) {
  const sessionId = req.cookies[SESSION_COOKIE]
  const session = sessionId ? sessions.get(sessionId) : undefined

  if (!session) {
    return res.status(401).json({ ok: false, error: 'Not signed in.' })
  }

  const user = await findUserById(session.userId)

  // A live session pointing at an account that no longer exists — deleted
  // since, or wiped when the table was rebuilt. Throw the session away too.
  if (!user) {
    sessions.delete(sessionId)
    return res.status(401).json({ ok: false, error: 'Not signed in.' })
  }

  req.user = user
  req.sessionId = sessionId
  next()
}

// Middleware: runs on every request before the routes below. This one reads the
// raw bytes of the request body, parses them as JSON, and puts the result on
// req.body. Without it, req.body is undefined — Express does not parse bodies
// by default.
app.use(express.json())

// The mirror image of express.json(): it reads the Cookie request header and
// turns it into the object req.cookies. Without it, req.cookies is undefined.
app.use(cookieParser())

app.get('/api/health', async (req, res) => {
  // "Is the server up" and "can the server reach its database" are different
  // questions, and a health check that only answers the first one is the reason
  // dashboards go green while the app is completely broken.
  try {
    const info = await checkConnection()
    res.json({
      ok: true,
      message: 'server is alive',
      database: { ok: true, serverTime: info.server_time },
    })
  } catch (error) {
    // 503 = "I am running but a thing I depend on is not."
    res.status(503).json({
      ok: false,
      message: 'server is alive',
      database: { ok: false, error: error.message },
    })
  }
})

// POST, not GET: GET asks for something, POST sends something that changes
// state on the server. GET data also rides in the URL, where it lands in
// browser history and server logs — no place for a password.
app.post('/api/register', async (req, res) => {
  const { fullName, email, password } = req.body

  // Every one of these checks also exists in the browser, and every one of them
  // has to exist here too. The browser is not trustworthy: anyone can send this
  // route a request with curl and skip the form entirely.
  //
  // 400 = "your request was wrong". The status code is how the browser knows
  // this failed; the JSON body is for the human.
  if (!fullName || !email || !password) {
    return res.status(400).json({ ok: false, error: 'All fields are required.' })
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ ok: false, error: 'Password must be at least 8 characters.' })
  }

  // Stored lowercase so that Ada@x.com and ada@x.com cannot become two accounts.
  const normalisedEmail = email.trim().toLowerCase()

  // THE IMPORTANT LINE.
  //
  // A hash is one-way: 'hunter2' always produces the same hash, but nothing can
  // turn the hash back into 'hunter2'. So at login you hash what was typed and
  // compare hashes — the real password never has to be kept anywhere.
  //
  // bcrypt specifically, rather than a plain hash like SHA-256, because:
  //   - it is deliberately slow, which makes guessing billions of passwords
  //     expensive. 12 is the cost factor, and it is exponential: 13 is twice
  //     the work of 12. High enough to be slow for an attacker, low enough that
  //     a real login still feels instant.
  //   - it salts automatically. A random salt goes into every hash, so two
  //     people with the same password get different hashes, and an attacker
  //     cannot precompute a table of common passwords once and reuse it.
  //
  // The salt and the cost are stored inside the resulting string, which is why
  // it looks like $2b$12$<salt><hash> — nothing else needs saving.
  const passwordHash = await bcrypt.hash(password, 12)

  // No "is this email taken?" query before the insert. That check-then-write
  // pattern is what the JSON version did, and it is a race: two signups can
  // both pass the check before either writes. Instead we simply insert, and let
  // the UNIQUE constraint be the referee — it is checked as part of the write,
  // so there is no gap to lose.
  //
  // The trade-off is that a duplicate signup pays for a bcrypt hash it will not
  // use. Roughly 200ms wasted on a request that was going to fail anyway; the
  // correctness is worth more.
  let user
  try {
    user = await createUser({
      fullName: fullName.trim(),
      email: normalisedEmail,
      passwordHash,
    })
  } catch (error) {
    // 409 = "conflict": the request was valid, but it clashes with what already
    // exists. Distinct from 400, which means the request itself was malformed.
    if (error.code === UNIQUE_VIOLATION) {
      return res.status(409).json({ ok: false, error: 'That email is already registered.' })
    }
    throw error // anything else is a real fault — let the error handler log it
  }

  console.log('registered:', user.email)

  // Signing up signs you in — otherwise the very next thing anyone does is log
  // in with the password they just chose.
  startSession(res, user.id)

  // 201 = "created". And note what goes back: no password, no hash. Send the
  // client only what it needs to show the next screen.
  res.status(201).json({ ok: true, user: publicUser(user) })
})

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required.' })
  }

  const user = await findUserByEmail(email.trim().toLowerCase())

  // How checking a password works when the password was never stored: hash
  // what was just typed, using the salt baked into the stored hash, and see
  // whether the result matches. compare() does all of that. Nothing is ever
  // decrypted, because a hash cannot be reversed in the first place.
  // `user.passwordHash` is checked as well as `user`, because an account created
  // through Google has no password at all. Passing undefined to compare() would
  // throw; the right answer is simply "these credentials do not work".
  const passwordMatches = user?.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false

  // One reply for both failures, on purpose. If an unknown email said "no such
  // account" and a wrong password said "wrong password", anyone could feed this
  // route a list of addresses and learn which ones are registered here. That is
  // called user enumeration. (A thorough version also hashes a throwaway string
  // when the user does not exist, so that the *time* taken does not give the
  // same answer away.)
  //
  // 401 = "unauthenticated": I do not know who you are. Not 400 — the request
  // was perfectly well formed, the credentials were simply wrong.
  if (!user || !passwordMatches) {
    return res.status(401).json({ ok: false, error: 'Email or password is incorrect.' })
  }

  console.log('logged in:', user.email)

  // The password has now done its whole job. From here on the cookie is what
  // identifies this person, and the password is not sent again.
  startSession(res, user.id)

  res.json({ ok: true, user: publicUser(user) })
})

// The protected route, and the reason sessions exist: it answers "who am I?"
// with no email, no password and no argument of any kind. Everything it needs
// arrived in a cookie the browser attached by itself.
app.get('/api/me', requireSession, (req, res) => {
  res.json({ ok: true, user: publicUser(req.user) })
})

// No requireSession in front of this one on purpose: logging out when you were
// not signed in should quietly succeed rather than fail. Asking for a state
// that is already true is not an error.
// --- Google sign-in, part 1: send the browser to Google ----------------------

const OAUTH_STATE_COOKIE = 'oauth_state'

app.get('/api/auth/google', (req, res) => {
  if (!googleConfigured) {
    return res.status(500).send('Google sign-in is not configured on this server.')
  }

  // The state parameter. A random value that goes to Google and comes back
  // untouched, while a copy of it sits in a short-lived cookie. On the way back
  // the two must match.
  //
  // Without it, anyone could send your callback URL a code of their own — for
  // example a code tied to *their* Google account — and your server would
  // happily attach that identity to whoever's browser followed the link. The
  // cookie proves the callback belongs to the same browser that started this.
  const state = randomBytes(16).toString('base64url')

  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax', // must not be 'strict', or the cookie is missing on the
    secure: false, //   way back, since that request comes from Google's domain
    maxAge: 1000 * 60 * 10, // ten minutes is plenty to click one button
    path: '/',
  })

  // Everything Google needs, as ordinary query-string parameters.
  const params = new URLSearchParams({
    client_id: GOOGLE.clientId,
    redirect_uri: GOOGLE.redirectUri,

    // "Send me a code, which I will exchange server-side for tokens." The
    // alternative, response_type=token, hands tokens straight to the browser
    // and is deprecated precisely because the browser cannot keep a secret.
    response_type: 'code',

    // What we are asking permission for. openid means "tell me who this is";
    // email and profile add the address and the display name. Nothing else —
    // asking for more than you need is both rude and a bigger consent screen.
    scope: 'openid email profile',

    state,
  })

  // 302 by default: "go here instead". The browser leaves your site entirely
  // and the next thing the user sees is Google's own page.
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

// --- Google sign-in, part 2: the browser comes back ---------------------------

// An id_token is a JWT: three base64url chunks joined by dots — header, payload
// and signature. The payload is only encoded, not encrypted, so reading it
// takes no key whatsoever. Anyone can decode one; that is by design.
//
// Which raises the obvious question: if anyone can write a JWT saying
// "email: someone@gmail.com", why is this safe? Because of where this one came
// from. It arrived in the reply to a request we made directly to Google's own
// HTTPS endpoint, authenticated with our client secret. Nobody could have put
// themselves in the middle of that.
//
// If an id_token ever reaches you any other way — posted by a browser, say —
// you MUST verify its signature against Google's public keys before believing
// a word of it. Google's own docs make exactly this distinction.
function decodeIdToken(idToken) {
  const payload = idToken.split('.')[1]
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query

  // The user pressed Cancel on Google's consent screen. Not a failure.
  if (error) return res.redirect('/?auth=cancelled')

  // Read the state cookie and immediately throw it away: it is good for exactly
  // one round trip.
  const expectedState = req.cookies[OAUTH_STATE_COOKIE]
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' })

  if (!code || !state || !expectedState || state !== expectedState) {
    return res.redirect('/?auth=failed')
  }

  try {
    // The one request in the whole flow that carries the client secret, and it
    // goes server-to-server — the browser is not involved and never sees it.
    // Note the body is form-encoded, not JSON: this endpoint predates the
    // convention and Google's spec requires it.
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE.clientId,
        client_secret: GOOGLE.clientSecret,
        redirect_uri: GOOGLE.redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      console.error('google token exchange failed:', await tokenResponse.text())
      return res.redirect('/?auth=failed')
    }

    const tokens = await tokenResponse.json()
    const profile = decodeIdToken(tokens.id_token)

    // email_verified matters. A Google account can carry an unverified address,
    // and trusting one would let somebody claim an email they do not own — and
    // with it, any existing account here that uses that address.
    if (!profile.email || !profile.email_verified) {
      return res.redirect('/?auth=failed')
    }

    const email = profile.email.toLowerCase()
    let user = await findUserByEmail(email)

    if (user) {
      // Same address as an account that already exists, so this is the same
      // person: sign them in and remember the link. Safe only because Google
      // just told us the address is verified.
      if (!user.googleId) {
        user = await attachGoogleId(user.id, profile.sub)
      }
    } else {
      user = await createUser({
        fullName: profile.name || email,
        email,
        // Deliberately no passwordHash. This account has no password at all,
        // and there is nothing to hash — Google does the authenticating.
        googleId: profile.sub, // Google's own stable id for this account
      })
    }

    console.log('google sign-in:', user.email)

    // The same session cookie as every other way in. Past this line nothing in
    // the app knows or cares that Google was involved.
    startSession(res, user.id)

    // Back to the app. A redirect, not JSON, because this request is a page
    // navigation — the browser followed Google's redirect to get here.
    res.redirect('/')
  } catch (caught) {
    console.error('google callback failed:', caught)
    res.redirect('/?auth=failed')
  }
})

app.post('/api/logout', (req, res) => {
  const sessionId = req.cookies[SESSION_COOKIE]

  // THIS is the line that ends the session. Deleting the server's entry makes
  // the id worthless everywhere, including in any copy of the cookie someone
  // had already captured. Clearing the browser's cookie below is only tidying
  // up — if the cookie itself carried the identity, rather than pointing at a
  // row the server controls, there would be no way to revoke it at all.
  sessions.delete(sessionId)

  // The options here have to match the ones used when setting it, or the
  // browser treats it as a different cookie and leaves the original in place.
  res.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax' })

  res.json({ ok: true })
})

// An error handler: four arguments instead of three is how Express recognises
// one, and it must come after every route. Express 5 forwards a rejected
// promise from an async handler here automatically — in Express 4 it did not,
// and an unhandled rejection in a route would silently hang the request.
app.use((error, req, res, next) => {
  console.error('unhandled error:', error)
  // Deliberately vague: internal messages can name tables, columns and file
  // paths, which is free reconnaissance for anyone poking at the API.
  res.status(500).json({ ok: false, error: 'Something went wrong.' })
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
