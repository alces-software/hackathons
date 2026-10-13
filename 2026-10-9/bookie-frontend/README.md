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

### Or by compose, as the core does

```bash
docker compose up -d
```

runs this frontend as a single service — the site on <http://localhost:3001>.
There's no Dockerfile: the container is plain `node` with this checkout bound
in and a `run.sh` that installs, builds and serves, exactly how the core's
own compose runs it. Source edits take effect on the next
`docker compose restart frontend`.

The core is a separate service, running from its own compose in
`../alces-bookie` (API published on :3000) — the frontend reaches it over the
host's port. If the core lives somewhere other than this VM's :3000, that's
the `API_URL` line in `docker-compose.yml`.

The websocket the **browser** should find the core on is baked into the
client bundle while the container builds; set it in `.env` when opening the
site from another machine:

```
NEXT_PUBLIC_WS_URL=ws://<vm-address>:3000/api/v1/ws
```

## Pointing it at the core

The core's base URL lives in `.env` and is read server-side only — the
browser never talks to the core directly:

```
API_URL=http://localhost:8000/api/v1
```

Change it to wherever the core is currently running. `.env.example` is kept
as a copyable template.

## What's here

- `/` — latest entries and the accounts currently on the book (debts shown
  against names that carry them)
- `/ledger` — every transaction in the core, paginated, newest first
- `/me` — your own entries, balance, winnings, losses and bank debt, plus a
  password change via the core's `PATCH /users` (sign in required)
- `/bank` — take a loan and repay it, via the core's `POST /bank/loan` and
  `POST /bank/repay` (sign in required)
- `/transfer` — hand money to another name on the book, via the core's
  `POST /users/transaction/{username}`, with the house's
  `GET /bank/fees` cut shown up front — editable "you send" and
  "they receive" fields that fill each other in (sign in required)
- `/signup`, `/login` — accounts, backed by POST `/users` and POST
  `/users/login`

All reads are server-rendered straight from the core; sign-in, sign-up, bank
and password actions go through internal routes (`app/api/session`,
`app/api/bank`, `app/api/password`) so the password is checked server-side
and never stored. Sign-in sets an httpOnly cookie holding the account name.

## One honest caveat

The core's transaction-writing endpoints for service operators
(`POST /services/transaction`, `POST /transactions/service/{username}`) are
for services paying out, not for a public front, and need a service token —
nothing here calls them.

For `POST /users/transaction/{username}` the doc names the recipient in the
path and carries the sender's credentials in the body (mirroring the service
endpoint's shape), so that's what `/transfer` assumes — and the current spec
templates it just so. If the core ends up doing it the other way round,
`app/api/transfer/route.ts` is the place to flip it.