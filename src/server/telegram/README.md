# Telegram bot

Alert delivery runs over a grammy bot reached via webhook.

In this module:

- `bot.ts` — singleton, lazy-init
- `commands.ts` — `/start`, `/help`, `/mute`, `/unmute`, `/performance`
- `callbacks.ts` — `rate:*` dispatcher (T14 swaps in persistence via `setRateHandler`)
- `format-alert.ts` + `send-alert.ts` — message rendering + fanout

HTTP entry points (in `src/routes/`):

- `api.telegram.webhook.tsx` — inbound webhook (Telegram → bot)
- `api.telegram.register.tsx` — admin op to register/inspect the webhook

## Setup (one-time per environment)

1. **Create the bot.** Talk to [@BotFather](https://t.me/BotFather), run
   `/newbot`, copy the token into `TELEGRAM_BOT_TOKEN`.
2. **Pick a webhook secret.** Generate a random string and set it as
   `TELEGRAM_WEBHOOK_SECRET`. The register route echoes it back to Telegram
   so inbound requests can be verified via the
   `X-Telegram-Bot-Api-Secret-Token` header.
3. **Register the webhook.** After deploying so `PUBLIC_APP_URL` is
   reachable, POST to `/api/telegram/register` (protected by `CRON_SECRET`,
   same as the ingest crons):

   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     "$PUBLIC_APP_URL/api/telegram/register"
   ```

   `GET` returns the current webhook info.
4. **Subscribe.** From Telegram, `/start` the bot — it inserts a
   `subscribers` row and `sendAlert` fans out to every `active: true` row.

## Local testing (no deploy, no tunnel)

With just `TELEGRAM_BOT_TOKEN` in `.env.local`:

```bash
npm run dev:bot         # long-polls — no public URL required
# /start, /help, /mute etc. now work against your local DB

# In another shell, once a subscriber exists:
npm run dev:test-alert  # sends a canned alert to every active subscriber
```

`dev:bot` drops any registered webhook first — Telegram lets exactly one
consumer hold updates, so if a deployed bot is live on the same token it
will stop receiving updates until you re-run `/api/telegram/register`.
Don't run `dev:bot` against a prod-shared token unless that trade-off is
acceptable.

## Commands

- `/start` — subscribe, or re-activate a muted subscription
- `/help` — list commands
- `/mute` / `/unmute` — toggle `Subscriber.active`
- `/performance` — weekly performance summary (stub; lands in T15)

## Ratings (current state)

`rate:{alertId}:{up|down}` callback payloads are parsed and logged, but
not yet persisted. T14 plugs the real handler in via
`setRateHandler(...)` in `src/server/telegram/callbacks.ts` — no
dispatcher rewiring needed. T14 also adds single-vote enforcement + the
message-keyboard edit after the first tap.
