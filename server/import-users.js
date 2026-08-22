// Moves the accounts in users.json into the users table. Run once:
//
//   npm run import-users --prefix server
//
// Safe to run twice: ON CONFLICT DO NOTHING means an email already in the table
// is skipped rather than raising an error. The JSON file is left untouched, so
// it stays as a backup until you delete it yourself.

import { readFile } from 'node:fs/promises'
import { pool, query } from './db.js'

const FILE = new URL('./users.json', import.meta.url)

let users = []
try {
  users = JSON.parse(await readFile(FILE, 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  console.log('no users.json found — nothing to import')
}

let imported = 0
let skipped = 0

try {
  for (const user of users) {
    // The ids and timestamps are carried across rather than regenerated, so any
    // session still holding an old user id keeps working.
    const result = await query(
      `INSERT INTO users (id, full_name, email, password_hash, google_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING
       RETURNING email`,
      [
        user.id,
        user.fullName,
        user.email,
        user.passwordHash ?? null,
        user.googleId ?? null,
        user.createdAt,
      ],
    )

    if (result.rowCount) {
      imported += 1
    } else {
      skipped += 1
      console.log('  already present, skipped:', user.email)
    }
  }

  console.log(`imported ${imported}, skipped ${skipped}`)

  const total = await query('SELECT count(*)::int AS n FROM users')
  console.log('rows in users now:', total.rows[0].n)
} finally {
  await pool.end()
}
