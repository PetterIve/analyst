import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/tickers')({
  component: TickersPage,
})

type TickerRow = {
  id: number
  symbol: string
  exchange: string
  segment: string
  name: string
  active: boolean
}

type CoverageStatus = 'ok' | 'stale' | 'thin' | 'missing'

interface TickerCoverage {
  rowCount: number
  lastDate: Date | null
  status: CoverageStatus
}

function TickersPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: tickers, isLoading } = useQuery(trpc.ticker.list.queryOptions())
  const { data: coverage } = useQuery(trpc.price.coverage.queryOptions())
  const coverageBySymbol = new Map(
    (coverage ?? []).map((c) => [c.symbol, c]),
  )
  const [backfillingSymbol, setBackfillingSymbol] = useState<string | null>(
    null,
  )

  const updateMutation = useMutation(
    trpc.ticker.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.ticker.list.queryKey() })
      },
      onError: (error) => toast.error(`Update failed: ${error.message}`),
    }),
  )

  const backfillMutation = useMutation(
    trpc.price.runBackfill.mutationOptions({
      onSuccess: (res) => {
        const inserted = res.results.reduce((n, r) => n + r.rowsInserted, 0)
        toast.success(
          `Backfilled ${res.results.length} ticker · ${inserted} rows`,
        )
        queryClient.invalidateQueries({
          queryKey: trpc.price.coverage.queryKey(),
        })
      },
      onError: (err) => toast.error(`Backfill failed: ${err.message}`),
      onSettled: () => setBackfillingSymbol(null),
    }),
  )

  const activeCount = tickers?.filter((t) => t.active).length ?? 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ANALYST / TICKERS
          </div>
          <h1 className="page-title">Ticker universe</h1>
          <div className="page-sub">
            Crude + product tankers tracked by the engine. Toggle active to
            include in ingestion and alerts.
          </div>
        </div>
        <div className="row-d">
          <span className="pill">{tickers?.length ?? 0} total</span>
          <span className="pill ok">
            <span className="dot" /> {activeCount} active
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Universe</span>
          <div className="spacer" />
          <span className="label-xs">editable</span>
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
                <th style={{ width: 110 }}>Exchange</th>
                <th style={{ width: 110 }}>Segment</th>
                <th>Name</th>
                <th style={{ width: 200 }}>Prices</th>
                <th style={{ width: 110 }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {tickers?.map((t) => (
                <Row
                  key={t.id}
                  ticker={t as TickerRow}
                  coverage={coverageBySymbol.get(t.symbol)}
                  backfilling={backfillingSymbol === t.symbol}
                  disableBackfill={backfillingSymbol !== null}
                  onUpdate={(patch) =>
                    updateMutation.mutate({ id: t.id, ...patch })
                  }
                  onBackfill={() => {
                    setBackfillingSymbol(t.symbol)
                    backfillMutation.mutate({ symbol: t.symbol })
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Row({
  ticker,
  coverage,
  backfilling,
  disableBackfill,
  onUpdate,
  onBackfill,
}: {
  ticker: TickerRow
  coverage: TickerCoverage | undefined
  backfilling: boolean
  disableBackfill: boolean
  onUpdate: (patch: { name?: string; active?: boolean }) => void
  onBackfill: () => void
}) {
  const [draft, setDraft] = useState(ticker.name)
  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== ticker.name) onUpdate({ name: trimmed })
    else setDraft(ticker.name)
  }
  return (
    <tr>
      <td>
        <b className="mono">{ticker.symbol}</b>
      </td>
      <td className="mono label-xs">{ticker.exchange}</td>
      <td>
        <span className="pill">{ticker.segment.toUpperCase()}</span>
      </td>
      <td>
        <input
          className="input-d"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setDraft(ticker.name)
          }}
        />
      </td>
      <td>
        <div className="row-d" style={{ gap: 8 }}>
          <CoverageCell coverage={coverage} symbol={ticker.symbol} />
          <button
            type="button"
            className="btn sm"
            disabled={disableBackfill}
            onClick={onBackfill}
          >
            {backfilling ? '…' : 'Backfill'}
          </button>
        </div>
      </td>
      <td>
        <button
          type="button"
          className={`btn sm${ticker.active ? ' primary' : ''}`}
          onClick={() => onUpdate({ active: !ticker.active })}
        >
          {ticker.active ? 'ON' : 'OFF'}
        </button>
      </td>
    </tr>
  )
}

function CoverageCell({
  coverage,
  symbol,
}: {
  coverage: TickerCoverage | undefined
  symbol: string
}) {
  if (!coverage) {
    return <span className="label-xs">—</span>
  }
  const tone =
    coverage.status === 'ok'
      ? 'ok'
      : coverage.status === 'missing'
        ? 'neg'
        : 'warn'
  const label = coverage.lastDate
    ? `${coverage.rowCount} · ${coverage.lastDate.toISOString().slice(0, 10)}`
    : `${coverage.rowCount} rows`
  return (
    <Link
      to="/admin/prices/$symbol"
      params={{ symbol }}
      style={{ textDecoration: 'none' }}
    >
      <span className={`pill ${tone}`}>
        <span className="dot" /> {label}
      </span>
    </Link>
  )
}
