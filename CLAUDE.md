# Analyst — developer notes

## Database access

Two modes, controlled by `USE_NEON` (read in `vite.config.ts`).

### Default — local Postgres via Docker Compose
```bash
docker compose up -d         # postgres:16 on localhost:5434, seeded from db/init.sql
npm run dev
```
Credentials: `analyst` / `analyst` / db `analyst`. Data persists in the `analyst-pgdata` volume (`docker compose down -v` wipes it). `.env.local` `DATABASE_URL` points at `postgresql://analyst:analyst@localhost:5434/analyst`.

### Opt-in — Neon branch
```bash
USE_NEON=1 npm run dev
```
`vite-plugin-neon-new` provisions a Neon branch, seeds it from `db/init.sql`, and **rewrites `DATABASE_URL` in `.env.local`** — restore the local URL when switching back.
