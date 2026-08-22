# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A **teaching project**, not a production app. The owner is learning how a login/registration
system works end to end and has limited React and Node experience. Two consequences that
should shape every change:

- **Explain in the code.** Comments here carry more weight than usual — they exist to teach
  the mechanism, not to restate the syntax. Keep them.
- **Build in stages, and do not run ahead.** See the roadmap below. Adding server calls,
  validation, or auth to a stage that has not been reached yet defeats the point of the
  exercise. Confirm before jumping stages.

## Commands

**Two processes have to be running.** Vite serves the page on 5173 and proxies anything
starting with `/api` to Express on 4000. Start the API first or the first `/api/me` on page
load returns a proxy error.

Frontend:

```bash
npm run dev --prefix client
```

```bash
npm run build --prefix client
```

API (loads `server/.env`, restarts on save):

```bash
npm run dev --prefix server
```

Applies `schema.sql`; safe to re-run:

```bash
npm run migrate --prefix server
```

One-off, already done once — copies `users.json` into Postgres:

```bash
npm run import-users --prefix server
```

Dev server: http://localhost:5173, API: http://localhost:4000. There is no test runner and no
linter configured yet — do not claim tests pass; there are none. `GET /api/health` is the
fastest check that both halves and the database are alive; it returns 503 if the DB is
unreachable.

## Roadmap and current stage

| Stage | Scope | Status |
|---|---|---|
| 1 | Static UI: card, tabs, fields, social strip. No behaviour. | **done** |
| 2 | Node + Express server in `server/`, health route, Vite proxy | **done** |
| 3 | Email registration: POST `/api/register`, bcrypt hashing, persistence | **done** |
| 4 | Login + session (httpOnly cookie or JWT), protected route | **done** |
| 5 | Google OAuth wired to the existing Google button | **done** |
| 6 | User storage moved from `users.json` to PostgreSQL on AWS RDS | **done** |

The roadmap is finished. Two things were deliberately left undone, and both are reasonable
next steps rather than oversights:

- **Sessions are still an in-memory `Map`**, so every restart signs everyone out — and with
  `node --watch` that is every save. Moving them to a `sessions` table is the obvious
  follow-on now that a database exists.
- **No rate limiting on `/api/login`.** Nothing stops thousands of password attempts.

## Architecture

```
client/            Vite + React 19, plain CSS (no Tailwind, no UI library — intentional)
server/            Node 22 + Express 5
  server.js        all routes: health, register, login, logout, me, google oauth
  db.js            the pg Pool, the TLS decision, and query()
  users.js         every SQL statement about users, and nothing else
  schema.sql       the users table
  migrate.js       applies schema.sql
  import-users.js  one-off users.json -> Postgres
  .env             secrets, gitignored — never commit a filled-in env file
```

**The backend is split by "what changes together".** Routes know about HTTP; `users.js` knows
about SQL; `db.js` knows about connections. A route never writes SQL, which is why moving from
JSON to Postgres touched `server.js` in only four places.

**Storage is PostgreSQL on AWS RDS (`ca-central-1`), reached over the public internet.**
Consequences that will bite otherwise:

- **The security group allows exactly one IP.** When queries that worked yesterday start
  timing out, it is almost always that the ISP moved the laptop to a new address. Update the
  inbound rule. The symptom is a *timeout*, never a refusal — security groups drop packets
  silently. `ECONNREFUSED` would mean something else entirely.
- **TLS is on but unverified** unless `server/rds-global-bundle.pem` exists; `db.js` picks it
  up automatically and stops warning at startup. Download it from
  `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`.
- **The instance bills while it exists**, idle or not. Delete it when the project is done.

**The `UNIQUE` constraint on `email` is the duplicate check.** Registration does *not* query
first and insert second — that is a race two simultaneous signups can both win. It inserts and
catches error code `23505` (`UNIQUE_VIOLATION`). Do not "improve" this by adding a lookup
first. The same applies to `google_id`, which is `UNIQUE` *and* nullable: PostgreSQL permits
any number of NULLs in a unique column, which is what lets every password-only account have
none.

**`password_hash` is nullable on purpose** — a Google account has no password — and a `CHECK`
constraint (`users_need_a_way_in`) enforces that every row has at least one of a password or a
Google id. Anything reading `passwordHash` must handle null; `/api/login` does, and passing
undefined to `bcrypt.compare` throws.

**Column names are translated in `users.js`, not everywhere.** SQL is snake_case, JS is
camelCase, so every query aliases (`full_name AS "fullName"`). The double quotes are required
or PostgreSQL folds the alias to lowercase. Columns are always listed explicitly — no
`SELECT *` — so a sensitive column added later cannot silently reach the client.

**`publicUser()` is the only shape of a user allowed out of the server.** It derives
`providers` from which credentials exist rather than storing them, and it is what keeps
`passwordHash` from leaking through a route that forgot to strip it.

**Transactions need `pool.connect()`, not `query()`.** The pool hands each `query()` call
whichever connection is free, so a `BEGIN`/`INSERT`/`ROLLBACK` written with `query()` runs on
three different connections and silently commits. Check out one client, run everything on it,
`release()` in a `finally`. Also: one failed statement aborts the whole transaction until
rollback — use `SAVEPOINT` if later statements must still run.

**Auth deliberately gives vague failures.** Wrong password and unknown email return the same
`401` and the same message, and a Google-only account asked for a password login returns it
too. A clearer message would tell a stranger which addresses have accounts here (user
enumeration). This is a decision, not an oversight — do not "helpfully" make these specific.

**Secrets live only in `server/.env`.** There is no `.env.example`; it was deleted after real
credentials were pasted into it, since it is the one env file `.gitignore` allows through
(`!.env.example`). If you reintroduce a template, keep it empty. The env file is read once at
startup via Node's `--env-file-if-exists`, so changes need a restart — no `dotenv` dependency.

**State lives in exactly one place on the client.** `App` owns `user` (null until `/api/me`
answers) and swaps whole screens with it — there is still no router, and swapping components
*is* the navigation. `AuthCard` owns `mode` (`'login' | 'signup'`). It passes
`mode` down to both children and hands `setMode` to `SidePanel` as `onModeChange`. `AuthForm`
owns its own field values in a single `values` object keyed by each input's `name` attribute,
so adding a field requires no new `useState`. There is no context, no router, no state library
— and the project is far too small to need any.

**The panel artwork is CSS, not an image.** The chevrons in
[SidePanel.css](client/src/components/SidePanel.css) are empty `<span>`s: squares given thick
borders on two adjacent sides, then rotated 45°, which turns the corner into an arrowhead.
Do not replace them with a raster image. Positioning them is geometry — for a square of side
`W` rotated 45° about its centre, the arrowhead lands at `left - 0.207 * W` and the arms span
`0.707 * W`. That is why the widths exceed 100% and `left` is positive.

**`overflow: clip`, never `overflow: hidden`, on `.side-panel` and `.auth-card`.** This has
bitten once already. The shapes are wider than the panel, so `hidden` turns the panel into a
scroll container; clicking a tab focuses the button, the browser scrolls it into view, and the
entire panel slides sideways by ~137px. `clip` clips without making the element scrollable.
Symptom if it regresses: computed `left` on `.side-panel__tabs` is correct but
`getBoundingClientRect()` disagrees, and `panel.scrollLeft` is non-zero.

**CSS conventions.** Design tokens (all colours, the font stack) are CSS custom properties on
`:root` in [index.css](client/src/index.css) — no hard-coded hex values in component CSS. Each
component has a sibling `.css` file imported from its `.jsx`. Class names follow BEM-ish
`block__element--modifier`.

**The theme is dark neon-cyan on near-black, and it depends on more than the hue tokens.**
Retheming to something light means more than swapping `--neon`: `color-scheme: dark` on
`:root`, the `-webkit-autofill` override in `AuthForm.css` (Chrome forces a pale yellow
autofill background that cannot be set directly — the workaround is a 100px inset box-shadow),
and `--on-neon` (dark text used *on top of* bright fills, the inverse of everything else)
all assume a dark surface. Glow is expressed through the `--glow-*` tokens, which are rgba
rather than hex because `box-shadow` and `text-shadow` cannot apply alpha to a colour token.

Contrast was measured, not eyeballed: everything is ≥5:1 except the submit button and badge
icon, whose dark-on-gradient text bottoms out at 4.85:1 at the blue end of the sweep. Pushing
`--blue` any darker breaks AA — check the *darkest* gradient stop, not the average.

**The layout is full-bleed, and nothing is pinned to a fixed height.** The split fills the
viewport (`100dvh`, with `100vh` as the fallback): decorative panel at a flat 39%, form at 61%.
Two rules keep that from falling apart on a large monitor:

- `.auth-form__inner` and `.social__inner` both cap at `max-width: 420px` and centre, so the
  fields stay a sane width and the social strip stays aligned with them while the hairline
  above it still spans the full half.
- The form block is centred with flexbox rather than positioned against a known card height.
  Vertical gaps use `clamp()` against `vh` so they tighten on short viewports instead of
  overflowing.

Verified at 1920×1080, 1440×900, 990×594, 768×700 and 375×812. Below 720px the split stacks:
the panel becomes a 168px banner with the tabs along its bottom edge, and the shapes are
re-pinned in pixels because the percentage sizes would be almost entirely clipped by a short
banner.

## Design source

`Sign Up Webpage Design.jpg` in the repo root is the reference for **layout and composition
only** — the split, the chevron artwork, the badge/title/field stack, the bottom strip. Its
colours no longer apply: the owner asked for a blue neon cyberpunk theme, so the original
magenta-on-white was replaced wholesale. Do not "fix" the palette back towards the JPG.

Other deliberate departures:

- Its tabs read `LOGIN` / `SIGN IN`, which are the same thing. They are `LOGIN` / `SIGN UP` here.
- The mockup only shows the login view. The sign-up view (Full Name + Confirm Password) extends
  the same visual language.
- The mockup's Google/Facebook items are bare text. They are raised chips here — bordered,
  shadowed, and lifting 3px on hover — because the owner asked for them to stand out more.

## Accessibility

The design has no visible labels. Every input still gets a real `<label>` hidden with the
`.sr-only` class — placeholders alone are not accessible names. Preserve this when adding fields.
