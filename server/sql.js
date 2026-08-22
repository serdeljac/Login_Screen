// A one-off SQL runner for looking at the database from the terminal.
//
//   npm run sql --prefix server -- "SELECT email, created_at FROM users"
//
// A development convenience only: it runs whatever you type, so it is not
// wired into the server and nothing in the app imports it.

import { pool, query } from './db.js'

// process.argv is [node, script, ...arguments]. Everything after the script
// name is joined so quoting rules on Windows cannot split a statement in half.
const statement = process.argv.slice(2).join(' ').trim()

if (!statement) {
  console.error('Usage: npm run sql --prefix server -- "SELECT * FROM users"')
  process.exit(1)
}

try {
  const result = await query(statement)

  if (result.rows.length) {
    console.table(result.rows)
    console.log(`${result.rowCount} row(s)`)
  } else {
    // INSERT/UPDATE/DELETE return no rows unless asked with RETURNING.
    console.log(`${result.command} affected ${result.rowCount} row(s)`)
  }
} catch (error) {
  // Postgres errors carry a code and often a hint, both more useful than the
  // message alone — 42P01 is "table does not exist", 42703 "column does not".
  console.error(`SQL error ${error.code}: ${error.message}`)
  if (error.hint) console.error('hint:', error.hint)
  process.exitCode = 1
} finally {
  await pool.end()
}
