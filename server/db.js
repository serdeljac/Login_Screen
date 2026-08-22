// Everything about talking to PostgreSQL lives here, so the routes in
// server.js only ever see query() and never think about connections.

import pg from 'pg'
import { existsSync, readFileSync } from 'node:fs'

const { Pool } = pg

const CA_BUNDLE = new URL('./rds-global-bundle.pem', import.meta.url)

// Is the database on this machine, or across the internet?
const connectionString = process.env.DATABASE_URL ?? ''
const isLocal = /@(localhost|127\.0\.0\.1)/.test(connectionString)

/**
 * How to handle TLS. Three cases, and the difference between the last two
 * matters more than it looks.
 */
function sslSetting() {
  // A local database talks over a loopback socket that never leaves the
  // machine. There is nothing to encrypt against.
  if (isLocal) return false

  // The right answer: verify that the server presenting itself as your
  // database really is your database, by checking its certificate against
  // Amazon's certificate authority.
  if (existsSync(CA_BUNDLE)) {
    return { ca: readFileSync(CA_BUNDLE, 'utf8') }
  }

  // The fallback, and the reason for the warning below. This still *encrypts*
  // the connection, so nobody can read your password off the wire — but it
  // accepts any certificate at all, so it cannot tell your database apart from
  // an impostor sitting in the middle. Fine while learning on your own laptop;
  // never in production. Download the bundle to turn this off (see README note).
  console.warn(
    '[db] No RDS CA bundle found — connecting without verifying the server certificate.',
  )
  return { rejectUnauthorized: false }
}

// A POOL, not a connection.
//
// Opening a Postgres connection is expensive: a TCP handshake, TLS, then
// authentication, which across the internet to another continent adds up to
// real milliseconds. Doing that per request would be painful. A pool opens a
// few connections, hands one to whoever needs it, and takes it back afterwards.
export const pool = new Pool({
  connectionString,
  ssl: sslSetting(),

  // RDS db.t4g.micro allows about 80 connections in total. Ten is plenty for
  // one dev server and leaves room for pgAdmin or psql alongside it.
  max: 10,

  // Hand back connections that have been sitting unused, so the database is not
  // holding slots open for nothing.
  idleTimeoutMillis: 30_000,

  // Fail fast instead of hanging forever when the host is unreachable — which
  // is exactly what a wrong security group rule looks like.
  connectionTimeoutMillis: 10_000,
})

// Idle connections can die without anyone asking them to: RDS reboots, network
// blips, a laptop waking from sleep. Without this listener that surfaces as an
// unhandled error event and takes the whole Node process down.
pool.on('error', (error) => {
  console.error('[db] idle client error:', error.message)
})

/**
 * Run one SQL statement.
 *
 * ALWAYS pass values as the second argument, never by building a string:
 *
 *   query('SELECT * FROM users WHERE email = $1', [email])   // safe
 *   query(`SELECT * FROM users WHERE email = '${email}'`)    // SQL injection
 *
 * With $1 placeholders the driver sends the statement and the values to
 * PostgreSQL separately, so a value can never be read as SQL. It is not about
 * escaping quotes carefully — the value is simply never part of the command.
 */
export function query(text, params) {
  return pool.query(text, params)
}

/** Used by the health route: proves the credentials, network and TLS all work. */
export async function checkConnection() {
  const result = await query('SELECT version() AS version, now() AS server_time')
  return result.rows[0]
}
