# Login Screen

A learning project: building a registration + login system from scratch with React on the
front and Node on the back, one stage at a time.

**Stage 1 (done):** the sign-up/login page. The layout comes from
`Sign Up Webpage Design.jpg` — a full-bleed split with a decorative panel on the left and the
form on the right, stacking into a banner plus form below 720px wide — restyled in a dark
neon-cyan cyberpunk palette. Pure UI; nothing is sent anywhere yet.

All colours live as tokens at the top of `src/index.css`. Retheming is a matter of changing
those values; no component stylesheet contains a raw hex code.

## Running it

```bash
npm install --prefix client
```

```bash
npm run dev --prefix client
```

Then open http://localhost:5173.

## Where things are

```
client/
  index.html                     page shell, loads the Poppins font
  vite.config.js                 dev server (the /api proxy for stage 2 is here, commented out)
  src/
    main.jsx                     mounts React into the page
    App.jsx                      centres the card on the plum backdrop
    index.css                    colour tokens + reset — change colours here, not in components
    components/
      AuthCard.jsx               the full-page split; holds the login/signup toggle
      SidePanel.jsx              pink artwork + the two tabs
      AuthForm.jsx               badge, title, fields, submit button
      Field.jsx                  one underlined input with its icon
      SocialLogin.jsx            the Google / Facebook strip
      icons.jsx                  inline SVGs
```

## What happens next

| Stage | What you'll learn |
|---|---|
| 2 | Standing up an Express server and letting the React dev server talk to it |
| 3 | Registration: POSTing a form, hashing a password with bcrypt, storing a user |
| 4 | Logging in: sessions vs. JWTs, cookies, keeping a route private |
| 5 | "Sign up with Google" — what OAuth actually does |

Stage 1 was built so stage 3 barely touches the UI: `handleSubmit` in `AuthForm.jsx` is an
empty stub waiting for a `fetch` call.
