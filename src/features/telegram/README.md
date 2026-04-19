# Telegram bot

Alert delivery runs over a grammy bot reached via webhook.

In this module:

- `bot.ts` — singleton, lazy-init
- `commands.ts` — `/start`, `/help`, `/mute`, `/unmute`, `/performance`
- `callbacks.ts` — `rate:*` dispatcher (T14 swaps in persistence via `setRateHandler`)
- `format-alert.ts` + `send-alert.ts` — message rendering + fanout
- `send-error.ts` — posts cron failures to the dedicated error channel (T16)

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

## Error channel (T16)

Cron failures (and partial failures, e.g. "2/10 sources errored") post to
a dedicated chat so they don't get buried in logs. Goes through the same
grammy bot — no second token, no second webhook.

**Wiring**

- `src/features/telegram/send-error.ts` exposes `sendCronError({ jobName,
  runId, message })`. HTML-escapes the error text and truncates >3500
  chars to stay under Telegram's 4096-char message cap.
- `src/lib/obs/cron.server.ts` (`withCronRun`) calls it on any throw and
  on partial-failure outcomes. Cron handlers don't call it directly.

**Setup (one-time per environment)**

1. Create the destination chat. Two common shapes:
   - **Private chat with yourself.** `/start` the bot from your own
     Telegram account; the chat ID is the same as your user ID. Easy
     for solo dev.
   - **Group / channel.** Create a Telegram group, add the bot as a
     member (must be done before it can post), then promote it if it's
     a channel. Group chat IDs are negative integers prefixed with
     `-100…`.
2. Find the chat ID. Easiest path: send any message in the chat, then
   `curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates"`
   and read `result[].message.chat.id`. Or use a bot like
   `@RawDataBot`.
3. Set `TELEGRAM_ERROR_CHAT_ID` in `.env.local` and Vercel.

**Behavior when unset**

`sendCronError` is a no-op if `TELEGRAM_ERROR_CHAT_ID` is unset OR if
`TELEGRAM_BOT_TOKEN` is unset (`telegramConfigured()` returns false).
Local dev and preview deploys stay quiet by default — opt in by setting
the env var. The `/admin/health` page header shows an "error channel
on/off" pill so the current state is obvious.

**Smoke test**

After setup, force a failure to confirm the channel is wired:

```bash
# Hit a cron with a deliberately-broken DB URL or kill the upstream
# source mid-fetch — the resulting throw should fire a message to the
# configured chat. Or call `sendCronError` directly from a one-off
# script.
```

The message format is `<b>Cron failure</b>` + job name + run ID +
ISO timestamp + a `<pre>` block with the error.

## Ratings (current state)

`rate:{alertId}:{up|down}` callback payloads are parsed and logged, but
not yet persisted. T14 plugs the real handler in via
`setRateHandler(...)` in `src/features/telegram/callbacks.ts` — no
dispatcher rewiring needed. T14 also adds single-vote enforcement + the
message-keyboard edit after the first tap.
