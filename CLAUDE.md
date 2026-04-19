# Analyst — developer notes

## Worktree setup

All worktrees share the one Postgres container started from the main
checkout. Isolation is by database name, not container — worktree N
uses db `analyst_wtN` (N=0 uses plain `analyst`). Each worktree gets
its own Vite port (3000 + N) so the dev servers don't collide.

After `worktree.ts switch analyst <N>`, from the new checkout run:

```bash
scripts/setup-worktree.sh <N>   # N=0 main, N≥1 for .claude/worktrees/wtN
npm run db:migrate              # creates analyst_wtN and applies migrations
npm run dev                     # → http://localhost:300<N>/
```

`setup-worktree.sh` upserts keys in `.env.local` (read by Vite /
dotenv-cli):
- `VITE_PORT = 3000 + N`
- `DATABASE_URL = postgresql://…:5434/analyst[_wtN]`
- `VITE_WT_LABEL = WT<N>` (empty for N=0) — shown in HTML `<title>` and sidebar brand

For N≥1 it also inherits non-infrastructure keys (Clerk / Sentry / etc.)
from the main worktree's `.env.local` so secrets don't need re-pasting.

## Database access

Two modes, controlled by `USE_NEON` (read in `vite.config.ts`).

### Default — local Postgres via Docker Compose
```bash
docker compose up -d         # postgres:16 on localhost:5434, seeded from db/init.sql
npm run dev
```
Credentials: `analyst` / `analyst` / db `analyst`. Data persists in the `analyst-pgdata` volume (`docker compose down -v` wipes it). `.env.local` `DATABASE_URL` points at `postgresql://analyst:analyst@localhost:5434/analyst`.

`docker compose up -d` is a one-time-per-machine step, run from the main
checkout. Worktrees reuse that container via per-db isolation (see
above) — don't `docker compose up` from a worktree directory.

### Opt-in — Neon branch
```bash
USE_NEON=1 npm run dev
```
`vite-plugin-neon-new` provisions a Neon branch, seeds it from `db/init.sql`, and **rewrites `DATABASE_URL` in `.env.local`** — restore the local URL when switching back.
