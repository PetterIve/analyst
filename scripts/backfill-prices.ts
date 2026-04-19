import { backfillAll } from '#/lib/ingest/prices/backfill'
import { prisma } from '#/server/db'

async function main() {
  const started = Date.now()
  const results = await backfillAll()
  const elapsed = ((Date.now() - started) / 1000).toFixed(1)

  const totalRows = results.reduce((n, r) => n + r.rowsInserted, 0)
  const errors = results.filter((r) => r.error)

  console.log(`\nBackfill done in ${elapsed}s`)
  console.log(`  tickers:   ${results.length}`)
  console.log(`  rows new:  ${totalRows}`)
  console.log(`  skipped:   ${results.filter((r) => r.skipped).length}`)
  console.log(`  errors:    ${errors.length}`)

  for (const r of results) {
    const tag = r.error ? '✗' : r.skipped ? '·' : '✓'
    const note = r.error
      ? ` (${r.error})`
      : r.skipped
        ? ' up-to-date'
        : ` +${r.rowsInserted}`
    console.log(`  ${tag} ${r.symbol.padEnd(8)}${note}`)
  }

  if (errors.length > 0) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
