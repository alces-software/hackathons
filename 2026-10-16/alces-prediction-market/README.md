# Alces

Alces is a moose-themed prediction market. Users trade on real-world outcomes and earn **moose bucks** for being right.

## Launch categories

Alces uses five focused categories. Free plans and rate limits can change, so API
access should be checked before creating a market.

| Category | Good first markets | Free API or data source |
| --- | --- | --- |
| **Consensus** | Office events, team competitions, internal awards | Settled by an Alces community vote; no external API required |
| **Tech** | GitHub releases, repository activity, npm downloads | GitHub's public API and the [npm registry API](https://github.com/npm/registry) |
| **Entertainment** | Film releases, ratings, books, music charts | [TMDB](https://developer.themoviedb.org/docs), [Open Library](https://openlibrary.org/developers/api), and public chart data |
| **Markets** | Bitcoin price, exchange rates, market close | [CoinGecko](https://www.coingecko.com/en/api) and [Frankfurter](https://www.frankfurter.app/) |
| **Sports** | Fixtures, scores, winners, league tables | [TheSportsDB](https://www.thesportsdb.com/) and [balldontlie](https://www.balldontlie.io/) for supported sports |

### Consensus resolution

Consensus markets are explicitly marked as **community resolved** and settled by a
public vote:

- Define the question, outcomes, voting eligibility, close time, and resolution rule before trading starts.
- Collect evidence after the event, then open a private vote for eligible participants.
- Resolve when one outcome reaches a threshold such as 66%; exclude a user's own position from their voting weight.
- Include a short dispute period and void the market with refunds if the result cannot be fairly established.

Examples include “Which team wins the office quiz?”, “Will the next team lunch start
before 1pm?”, and “Who receives the most votes in the office awards poll?”

### Recommended first release

The initial release should use all five categories: **Consensus**, **Tech**,
**Entertainment**, **Markets**, and **Sports**. This provides a clear product
identity while keeping API-backed markets separate from community-settled events.

## MariaDB setup

Prediction placement is persisted in MariaDB. Start the database and copy the
environment file with:

```bash
docker compose up -d
cp .env.example .env.local
```

The included Docker Compose service starts MariaDB on port `3306` and runs
`database/schema.sql` automatically on its first startup. The schema is the
complete current database (migrations 001–008 consolidated) and contains no
demo data — the first person to sign up becomes the first account. The
`.env.example` connection string matches the local development credentials.
Then start the app with `npm run dev`.

Accounts are created in the app: pick a display name and password (hashed with
scrypt), then link your existing Alces Bookie account so predictions move real
moose bucks. The bookie link is stored in the database and survives sign-outs.

The current product slice focuses on **Consensus** markets. Trading stakes set
the live odds, and a separate post-close community vote resolves what actually
happened. Each market has its own detail page with a closing time, total bet,
outcome odds, prediction form, and resolution vote. Resolution requires three
votes with a 66% majority.

Markets support between two and eight named outcomes.

### Existing databases

Databases created before the schema was consolidated should apply the
migrations in order:

```bash
for f in database/migrations/0*.sql; do
  docker exec -i alces-mariadb mariadb -ualces_user -palces_dev_password alces < "$f"
done
```

If the database volume has already been created before the schema changed, reset
the local development database with `docker compose down -v` followed by
`docker compose up -d`. This removes only the local Docker volume.

## Running on a VM with Docker Compose

The hackathons repository hosts a date-level `docker-compose.yml` that runs the
whole stack on a VM: MariaDB plus the Next.js app in a Node container. From the
repo root (e.g. `2026-10-16/`):

```bash
docker compose up -d
```

The app is then available on port `3000`. The compose file injects the
database URL, bookie API settings, and session secret as environment
variables, so no `.env.local` is needed on the VM. The app container runs
`run.sh`, which installs dependencies, builds, and starts the production
server.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.