/**
 * Local-dev Telegram bot runner. Uses long polling (bot.start()) instead of
 * webhooks so you can test /start, /mute, /help, and callback buttons
 * without a public URL / tunnel / deploy.
 *
 *   npm run dev:bot
 *
 * Requires TELEGRAM_BOT_TOKEN in .env.local. Don't run this at the same
 * time as a deployed webhook-mode bot with the same token — Telegram lets
 * exactly one consumer hold updates.
 */
import { getBot } from '../src/features/telegram/bot.ts'

async function main() {
  const bot = getBot()
  console.log('Dropping any stale webhook so long polling can start…')
  await bot.api.deleteWebhook({ drop_pending_updates: false })

  const me = await bot.api.getMe()
  console.log(`Polling as @${me.username} (id=${me.id}). Ctrl+C to stop.`)

  const stop = async () => {
    console.log('\nStopping bot…')
    await bot.stop()
    process.exit(0)
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  await bot.start({
    allowed_updates: ['message', 'callback_query'],
    onStart: () => console.log('Ready — send /start to the bot.'),
  })
}

main().catch((err) => {
  console.error('dev-bot crashed:', err)
  process.exit(1)
})
