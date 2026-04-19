/**
 * Smoke-test the sendAlert fanout with a canned payload. Requires at least
 * one `/start`-ed subscriber in the DB (run `npm run dev:bot` first, /start
 * the bot from Telegram, then Ctrl+C dev:bot and run this).
 *
 *   npm run dev:test-alert
 */
import { sendAlert } from '../src/server/telegram/send-alert.ts'

async function main() {
  const result = await sendAlert(
    {
      alertId: 1,
      symbol: 'FRO',
      direction: 'long',
      entryPrice: 21.34,
      thesis: 'VLCC rates surged on Red Sea disruption; tonne-miles extending.',
      topCatalyst: 'Tanker hit off Yemen coast — reroutes add 10+ days to voyages.',
      expectedReturn5d: 0.042,
      hitRate: 0.67,
      nComparables: 18,
      invalidation: 'Ceasefire announced or spot rates revert >5% within 2 days.',
    },
    'https://analyst.example.com/alerts/1',
  )
  console.log(JSON.stringify(result, null, 2))
  if (result.sent === 0) {
    console.error('No active subscribers — /start the bot first.')
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('send-test-alert failed:', err)
  process.exit(1)
})
