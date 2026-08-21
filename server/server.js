import express from 'express'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const app = express()
const PORT = 4000

// Where the "database" lives. A JSON file is the smallest thing that survives a
// server restart. It is fine for learning and wrong for production: every save
// rewrites the whole file, and two requests arriving at once can overwrite each
// other. A real app uses a database.
//
// import.meta.url is this file's own location, so the path works no matter
// which directory the server was started from.
const USERS_FILE = new URL('./users.json', import.meta.url)

async function readUsers() {
  try {
    return JSON.parse(await readFile(USERS_FILE, 'utf8'))
  } catch (error) {
    // ENOENT = "no such file", which is simply the state before the first
    // signup. Any other error is a real problem and should not be swallowed.
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function writeUsers(users) {
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2))
}

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
  return { id: user.id, fullName: user.fullName, email: user.email }
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

  const users = await readUsers()
  const user = users.find((candidate) => candidate.id === session.userId)

  // A live session pointing at an account that no longer exists — deleted
  // since, or wiped along with users.json. Throw the session away too.
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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'server is alive' })
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

  const users = await readUsers()

  // 409 = "conflict": the request was valid, but it clashes with what already
  // exists. Distinct from 400, which means the request itself was malformed.
  if (users.some((user) => user.email === normalisedEmail)) {
    return res.status(409).json({ ok: false, error: 'That email is already registered.' })
  }

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

  const user = {
    id: randomUUID(),
    fullName: fullName.trim(),
    email: normalisedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  }

  users.push(user)
  await writeUsers(users)

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

  const users = await readUsers()
  const user = users.find((candidate) => candidate.email === email.trim().toLowerCase())

  // How checking a password works when the password was never stored: hash
  // what was just typed, using the salt baked into the stored hash, and see
  // whether the result matches. compare() does all of that. Nothing is ever
  // decrypted, because a hash cannot be reversed in the first place.
  const passwordMatches = user
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

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
