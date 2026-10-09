# Bookie

A front for the Alces logical core: a public book of accounts. Anyone can
open an account, follow their own side of the ledger, and read everyone
else's lines too.

## Running it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Pointing it at the core

The core's base URL lives in `.env` and is read server-side only — the
browser never talks to the core directly:

```
API_URL=http://localhost:8000/api/v1
```

Change it to wherever the core is currently running. `.env.example` is kept
as a copyable template.

## What's here

- `/` — latest entries and the accounts currently on the book
- `/ledger` — every transaction in the core, paginated
- `/me` — your own entries and standing balance (sign in required)
- `/signup`, `/login` — accounts, backed by POST/GET on the core's `/users`

All reads are server-rendered straight from the core; sign-in and sign-up go
through an internal route (`app/api/session`) which sets an httpOnly cookie
holding the account name.

## One honest caveat

The core's API has no session or password-verification endpoint — POST
`/users` creates an account, DELETE `/users` is the only place a password is
checked, and GET `/users/{username}` merely answers 204 or 404. So sign-in
here verifies that a name is on the book, not that the password matches.
If the core grows a proper auth endpoint, `app/api/session/route.ts` and
`userExists()` in `lib/api.ts` are the two places to change.