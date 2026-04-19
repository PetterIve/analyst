# Analyst — developer notes

## Worktree setup

Each worktree gets its own Vite port, Postgres port, compose project, and volume so they don't collide. After `worktree.ts switch analyst <N>`, configure this checkout:

```bash
scripts/setup-worktree.sh <N>   # N=0 main, N≥1 for .claude/worktrees/wtN
```

That writes `.env` (compose) and upserts keys in `.env.local` (Vite / dotenv-cli):
- `VITE_PORT = 3000 + N`, `POSTGRES_HOST_PORT = 5434 + N`
- `COMPOSE_PROJECT_NAME = analyst[-wtN]`, `POSTGRES_VOLUME_NAME = analyst-pgdata[-wtN]`
- `VITE_WT_LABEL = WT<N>` (empty for N=0) — shown in HTML `<title>` and sidebar brand

## Database access

Two modes, controlled by `USE_NEON` (read in `vite.config.ts`).

### Default — local Postgres via Docker Compose
```bash
docker compose up -d         # postgres:16, port from POSTGRES_HOST_PORT (default 5434)
npm run dev                  # port from VITE_PORT (default 3000)
```
Credentials: `analyst` / `analyst` / db `analyst`. Data persists in the `${POSTGRES_VOLUME_NAME}` volume (`docker compose down -v` wipes it). `.env.local` `DATABASE_URL` points at the matching local port.

### Opt-in — Neon branch
```bash
USE_NEON=1 npm run dev
```
`vite-plugin-neon-new` provisions a Neon branch, seeds it from `db/init.sql`, and **rewrites `DATABASE_URL` in `.env.local`** — restore the local URL when switching back.
