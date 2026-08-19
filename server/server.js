import express from 'express'

const app = express()
const PORT = 4000

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
app.post('/api/register', (req, res) => {
  const { fullName, email, password } = req.body

  console.log('POST /api/register received:', { fullName, email, password })

  // 400 = "your request was wrong". The status code is how the browser knows
  // this failed; the JSON body is for the human.
  if (!fullName || !email || !password) {
    return res.status(400).json({ ok: false, error: 'All fields are required.' })
  }

  // STEP 5 — hash the password and save the user. For now, just acknowledge.
  res.json({ ok: true, user: { fullName, email } })
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
