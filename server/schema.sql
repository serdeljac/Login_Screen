-- The whole database, in one table.
--
-- Run it with:  npm run migrate --prefix server
--
-- Everything here is written so that running it twice is harmless (IF NOT
-- EXISTS). A file like this is the beginning of what teams call migrations: the
-- shape of the database kept in version control next to the code, rather than
-- existing only as a series of things somebody once typed into a console.

CREATE TABLE IF NOT EXISTS users (
  -- gen_random_uuid() is built into PostgreSQL 13+, so the database can make
  -- its own ids and Node does not have to. Same UUIDs as randomUUID() produced.
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  full_name     text        NOT NULL,

  -- UNIQUE is the important word in this file.
  --
  -- The JSON version checked for a duplicate email by reading the file, looking
  -- through it, then writing — and two signups arriving together could both
  -- pass the check before either wrote. Nothing in JavaScript could fix that.
  -- Here the database refuses the second INSERT no matter how the requests are
  -- interleaved, because the constraint is checked as part of the write itself.
  --
  -- Addresses are lowercased in Node before they get here, so this is
  -- effectively case-insensitive. (The alternative is the citext extension,
  -- which makes the column itself case-insensitive.)
  email         text        NOT NULL UNIQUE,

  -- Nullable on purpose: an account created through Google has no password at
  -- all. The schema states that fact rather than leaving it to be discovered.
  password_hash text,

  -- Also nullable, and also UNIQUE — which sounds contradictory until you know
  -- that PostgreSQL allows any number of NULLs in a unique column. So every
  -- password-only account can have no google_id, while no two accounts can
  -- share the same one.
  google_id     text        UNIQUE,

  created_at    timestamptz NOT NULL DEFAULT now(),

  -- An invariant the application could enforce, expressed where it cannot be
  -- bypassed: every account must have at least one way to sign in. Delete the
  -- password from a Google-less account and the database rejects the update.
  CONSTRAINT users_need_a_way_in
    CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);
