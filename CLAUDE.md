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

All frontend commands run from `client/`:

```bash
npm run dev --prefix client
```

```bash
npm run build --prefix client
```

```bash
npm run preview --prefix client
```

Dev server: http://localhost:5173. There is no test runner and no linter configured yet —
do not claim tests pass; there are none.

## Roadmap and current stage

| Stage | Scope | Status |
|---|---|---|
| 1 | Static UI: card, tabs, fields, social strip. No behaviour. | **done** |
| 2 | Node + Express server in `server/`, health route, Vite proxy | **done** |
| 3 | Email registration: POST `/api/register`, bcrypt hashing, persistence | **done** |
| 4 | Login + session (httpOnly cookie or JWT), protected route | **done** |
| 5 | Google OAuth wired to the existing Google button | not started |

The frontend was deliberately built so stage 3 touches almost nothing: `handleSubmit` in
[AuthForm.jsx](client/src/components/AuthForm.jsx) is an empty stub, and the proxy config in
[vite.config.js](client/vite.config.js) is written out and commented for stage 2.

## Architecture

```
client/          Vite + React 19, plain CSS (no Tailwind, no UI library — intentional)
server/          does not exist yet (stage 2)
```

**State lives in exactly one place.** `AuthCard` owns `mode` (`'login' | 'signup'`). It passes
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
