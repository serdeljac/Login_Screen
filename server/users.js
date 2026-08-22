// Every SQL statement about users lives here. The routes in server.js call
// these functions and never write SQL themselves, so if the storage changes
// again, exactly one file changes.

import { query } from './db.js'

// PostgreSQL's error code for "you broke a UNIQUE constraint". Codes are worth
// using instead of matching on message text, which changes between versions.
export const UNIQUE_VIOLATION = '23505'

// The columns every query returns, renamed on the way out.
//
// SQL convention is snake_case, JavaScript's is camelCase, so the translation
// happens here and nothing else in the app has to think about it. The double
// quotes are required — without them PostgreSQL folds identifiers to lowercase
// and you would get `fullname`.
//
// Listing columns rather than SELECT * is also a small safety measure: adding a
// sensitive column later cannot silently start shipping it to the client.
const USER_COLUMNS = `
  id,
  full_name     AS "fullName",
  email,
  password_hash AS "passwordHash",
  google_id     AS "googleId",
  created_at    AS "createdAt"
`

export async function findUserByEmail(email) {
  // $1 is a placeholder, not string interpolation. The statement and the value
  // travel to PostgreSQL separately, so no value can ever be read as SQL —
  // which is what makes injection impossible rather than merely difficult.
  const result = await query(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email])
  return result.rows[0] ?? null
}

export async function findUserById(id) {
  const result = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id])
  return result.rows[0] ?? null
}

export async function createUser({ fullName, email, passwordHash = null, googleId = null }) {
  // RETURNING hands back the row that was just written, including the id and
  // created_at that the database generated. Without it this would take a second
  // query — and a round trip to Canada is not free.
  const result = await query(
    `INSERT INTO users (full_name, email, password_hash, google_id)
     VALUES ($1, $2, $3, $4)
     RETURNING ${USER_COLUMNS}`,
    [fullName, email, passwordHash, googleId],
  )
  return result.rows[0]
}

/** Links an existing password account to a Google identity. */
export async function attachGoogleId(userId, googleId) {
  const result = await query(
    `UPDATE users SET google_id = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [userId, googleId],
  )
  return result.rows[0] ?? null
}
