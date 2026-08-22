// Applies schema.sql to whatever DATABASE_URL points at.
//
//   npm run migrate --prefix server
//
// Kept separate from server.js deliberately: changing the shape of a database
// is a decision someone makes, not something that should quietly happen every
// time a server restarts.

import { readFile } from 'node:fs/promises'
import { pool, query } from './db.js'

const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')

try {
  await query(sql)
  console.log('schema applied')

  // Read the shape back out of the database rather than trusting that the file
  // did what it says. information_schema is a set of views every SQL database
  // exposes, describing its own structure.
  const columns = await query(
    `SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position`,
  )
  console.table(columns.rows)
} finally {
  // Without this the pool keeps its connections open and the script never exits.
  await pool.end()
}
