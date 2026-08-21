import express from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
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

// Middleware: runs on every request before the routes below. This one reads the
// raw bytes of the request body, parses them as JSON, and puts the result on
// req.body. Without it, req.body is undefined — Express does not parse bodies
// by default.
app.use(express.json())

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

  // 201 = "created". And note what goes back: no password, no hash. Send the
  // client only what it needs to show the next screen.
  res.status(201).json({
    ok: true,
    user: { id: user.id, fullName: user.fullName, email: user.email },
  })
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

  // STEP 2 — this is where the session cookie will be issued. Right now the
  // reply is just an answer to "are these credentials valid?", and the server
  // forgets you the instant it finishes sending it.
  res.json({
    ok: true,
    user: { id: user.id, fullName: user.fullName, email: user.email },
  })
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
