import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/prices/')({
  component: PricesIndexPage,
})

type CoverageStatus = 'ok' | 'stale' | 'thin' | 'missing'

function PricesIndexPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: coverage, isLoading } = useQuery(
    trpc.price.coverage.queryOptions(),
  )
  const [runningFor, setRunningFor] = useState<string | null>(null)

  const backfillMutation = useMutation(
    trpc.price.runBackfill.mutationOptions({
      onSuccess: (res) => {
        const inserted = res.results.reduce((n, r) => n + r.rowsInserted, 0)
        toast.success(
          `Backfilled ${res.results.length} ticker(s), ${inserted} rows inserted`,
        )
        queryClient.invalidateQueries({
          queryKey: trpc.price.coverage.queryKey(),
        })
      },
      onError: (err) => toast.error(`Backfill failed: ${err.message}`),
      onSettled: () => setRunningFor(null),
    }),
  )

  const stats = useMemo(() => {
    const rows = coverage ?? []
    return {
      total: rows.length,
      ok: rows.filter((r) => r.status === 'ok').length,
      warn: rows.filter((r) => r.status === 'stale' || r.status === 'thin').length,
      missing: rows.filter((r) => r.status === 'missing').length,
    }
  }, [coverage])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ANALYST / PRICES
          </div>
          <h1 className="page-title">Price coverage</h1>
          <div className="page-sub">
            Daily OHLCV via Yahoo Finance. Backfill pulls ≥5y per ticker; cron
            appends the prior session's close at 22:00 UTC on weekdays.
          </div>
        </div>
        <div className="row-d">
          <span className="pill">{stats.total} total</span>
          <span className="pill ok">
            <span className="dot" /> {stats.ok} ok
          </span>
          {stats.warn > 0 && (
            <span className="pill warn">
              <span className="dot" /> {stats.warn} warn
            </span>
          )}
          {stats.missing > 0 && (
            <span className="pill neg">
              <span className="dot" /> {stats.missing} missing
            </span>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={runningFor !== null}
            onClick={() => {
              setRunningFor('__all__')
              backfillMutation.mutate({})
            }}
          >
            {runningFor === '__all__' ? 'Running…' : 'Backfill all'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Universe</span>
          <div className="spacer" />
          <span className="label-xs">yahoo-finance2 · daily</span>
        </div>
        {isLoading ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            Loading…
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Symbol</th>
                <th style={{ width: 110 }}>Segment</th>
                <th className="num" style={{ width: 90 }}>Rows</th>
                <th className="num" style={{ width: 120 }}>First</th>
                <th className="num" style={{ width: 120 }}>Last</th>
                <th className="num" style={{ width: 90 }}>Age (d)</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coverage?.map((row) => (
                <tr
                  key={row.tickerId}
                  style={{ opacity: row.active ? 1 : 0.55 }}
                >
                  <td>
                    <Link
                      to="/admin/prices/$symbol"
                      params={{ symbol: row.symbol }}
                      style={{ textDecoration: 'none' }}
                    >
                      <b className="mono">{row.symbol}</b>
                    </Link>
                  </td>
                  <td>
                    <span className="pill">{row.segment.toUpperCase()}</span>
                  </td>
                  <td className="num mono">
                    {row.rowCount.toLocaleString()}
                  </td>
                  <td className="num mono label-xs">
                    {formatDate(row.firstDate)}
                  </td>
                  <td className="num mono label-xs">
                    {formatDate(row.lastDate)}
                  </td>
                  <td className="num mono">{row.lastCloseAgeDays ?? '—'}</td>
                  <td>
                    <StatusPill status={row.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={runningFor !== null}
                      onClick={() => {
                        setRunningFor(row.symbol)
                        backfillMutation.mutate({ symbol: row.symbol })
                      }}
                    >
                      {runningFor === row.symbol ? '…' : 'Backfill'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: CoverageStatus }) {
  const map: Record<CoverageStatus, { label: string; tone: string }> = {
    ok: { label: 'OK', tone: 'ok' },
    stale: { label: 'STALE', tone: 'warn' },
    thin: { label: 'THIN', tone: 'warn' },
    missing: { label: 'MISSING', tone: 'neg' },
  }
  const { label, tone } = map[status]
  return (
    <span className={`pill ${tone}`}>
      <span className="dot" /> {label}
    </span>
  )
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toISOString().slice(0, 10)
}
