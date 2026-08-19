import express from 'express'
const app = express()
const PORT = 4000
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'server is alive' })
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
