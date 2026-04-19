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

## Telegram bot

Alert delivery runs over a grammy bot reached via webhook. Setup is
one-time per environment:

1. **Create the bot.** Talk to [@BotFather](https://t.me/BotFather), run
   `/newbot`, copy the token into `TELEGRAM_BOT_TOKEN`.
2. **Pick a webhook secret.** Generate a random string and set both
   `TELEGRAM_WEBHOOK_SECRET` here and (step 3) with Telegram.
3. **Register the webhook.** After deploying so `PUBLIC_APP_URL` is
   reachable, POST to `/api/telegram/register` (protected by `CRON_SECRET`
   like the other admin endpoints):
   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     "$PUBLIC_APP_URL/api/telegram/register"
   ```
   The route reads `PUBLIC_APP_URL` + `TELEGRAM_WEBHOOK_SECRET` and wires
   both with Telegram. `GET` returns the current webhook info.
4. **Subscribe.** From Telegram, `/start` the bot — it inserts a
   `subscribers` row and alerts fan out to every `active: true` row.

### Local testing (no deploy, no tunnel)

With just `TELEGRAM_BOT_TOKEN` in `.env.local`:

```bash
npm run dev:bot         # long-polls — no public URL required
# /start, /help, /mute etc. now work against your local DB

# In another shell, once a subscriber exists:
npm run dev:test-alert  # sends a canned alert to every active subscriber
```

`dev:bot` drops any registered webhook first (Telegram lets exactly one
consumer hold updates), so if a deployed bot is already live on the same
token it'll stop receiving updates until you re-run `/api/telegram/register`.
Don't run `dev:bot` with a prod-shared token unless that's ok.

`/mute` pauses a chat without losing the subscription; `/unmute` resumes.
`/help` lists commands.

Rating handling (`rate:{alertId}:{up|down}` callback payloads) logs today
and will persist to the `ratings` table once T14 lands — see
`src/server/telegram/callbacks.ts` for the swap-in point.

## Cron routes

Every `src/routes/api.cron.*.tsx` handler must log generously via
`#/lib/logger.server` — crons run unattended and the logs are the only
retrospective signal when something misbehaves. At a minimum, emit:

- `info` on start with `{ job, runId }`
- `info` (or `warn` on failure) per unit of work (per source, per ticker, …)
  with counts (`fetched`, `inserted`, etc.)
- `info` on finish with `{ durationMs, errors, rowsInserted, … }`
- `error` with the caught exception message if the whole run blows up

Also write a `CronRun` row (`startedAt`, `finishedAt`, `status`, `metrics`,
`errorMsg`) so the admin UI can surface recent runs without grepping logs.
See `src/routes/api.cron.ingest-news.tsx` / `ingest-prices.tsx` for the
shape. Inner ingest libraries should accept callback hooks
(`onSourceStart` / `onSourceEnd` / …) so the cron handler — not the lib —
owns the log messages, keeping the lib reusable for tRPC "Run now"
buttons that want their own logging context.
