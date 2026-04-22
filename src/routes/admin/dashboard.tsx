import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.dashboard.state.queryOptions())
  const { data: history } = useQuery(trpc.factorHistory.recent.queryOptions({ limit: 50 }))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ANALYST / DASHBOARD
          </div>
          <h1 className="page-title">Operator dashboard</h1>
          <div className="page-sub">
            Per-ticker factor state, composite bull/bear scores, and the
            pending / held alert queue. Refresh: reload the page.
          </div>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="card" style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
          Loading…
        </div>
      ) : (
        <>
          <FactorGrid data={data} />
          <AlertQueue queue={data.alertQueue} />
          <Simulation factors={data.factors} tickers={data.tickers.map((t) => t.symbol)} />
          <HistoryStream rows={history ?? []} />
        </>
      )}
    </div>
  )
}

type DashboardData = NonNullable<ReturnType<typeof useDashboardState>>

function useDashboardState() {
  const trpc = useTRPC()
  return useQuery(trpc.dashboard.state.queryOptions()).data
}

function FactorGrid({ data }: { data: NonNullable<ReturnType<typeof useDashboardState>> }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="title">Factor state</span>
        <div className="spacer" />
        <span className="label-xs">{data.tickers.length} tickers × {data.factors.length} factors</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Ticker</th>
              <th style={{ width: 80 }}>Long</th>
              <th style={{ width: 80 }}>Short</th>
              {data.factors.map((f) => (
                <th key={f.slug} className="label-xs" style={{ whiteSpace: 'nowrap' }}>
                  {f.slug}
                </th>
              ))}
              <th style={{ width: 160 }}>Last update</th>
            </tr>
          </thead>
          <tbody>
            {data.tickers.map((t) => (
              <tr key={t.id}>
                <td className="mono"><strong>{t.symbol}</strong></td>
                <td>
                  <ScoreBadge value={t.longScore} direction="long" />
                </td>
                <td>
                  <ScoreBadge value={t.shortScore} direction="short" />
                </td>
                {t.factors.map((f) => (
                  <td key={f.slug} style={{ minWidth: 110 }}>
                    <FactorBar factor={f} />
                  </td>
                ))}
                <td className="label-xs muted mono">
                  {t.lastUpdatedAt ? new Date(t.lastUpdatedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ScoreBadge({ value, direction }: { value: number; direction: 'long' | 'short' }) {
  const crossed = value >= 2
  const color = direction === 'long' ? 'var(--pos)' : 'var(--neg)'
  return (
    <span
      className="mono"
      style={{
        color: crossed ? color : 'var(--fg-3)',
        fontWeight: crossed ? 600 : 400,
      }}
    >
      {value.toFixed(2)}
    </span>
  )
}

function FactorBar({
  factor,
}: {
  factor: { slug: string; value: number; rangeMin: number; rangeMax: number; isDefault: boolean }
}) {
  const range = factor.rangeMax - factor.rangeMin
  const pct = range === 0 ? 50 : ((factor.value - factor.rangeMin) / range) * 100
  const midpoint = range === 0 ? 50 : (-factor.rangeMin / range) * 100
  const positive = factor.value > 0
  const color = positive ? 'var(--pos)' : factor.value < 0 ? 'var(--neg)' : 'var(--fg-4)'
  return (
    <div title={`${factor.slug}: ${factor.value.toFixed(2)}`} style={{ position: 'relative' }}>
      <div
        style={{
          height: 6,
          background: 'var(--bg-2)',
          borderRadius: 2,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(pct, midpoint)}%`,
            width: `${Math.abs(pct - midpoint)}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${midpoint}%`,
            width: 1,
            height: '100%',
            background: 'var(--fg-4)',
          }}
        />
      </div>
      <div className="label-xs mono" style={{ opacity: factor.isDefault ? 0.4 : 1, marginTop: 2 }}>
        {factor.value.toFixed(2)}
      </div>
    </div>
  )
}

function AlertQueue({ queue }: { queue: NonNullable<DashboardData>['alertQueue'] }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const cancel = useMutation(
    trpc.alert.cancel.mutationOptions({
      onSuccess: () => {
        toast.success('Alert cancelled')
        queryClient.invalidateQueries({ queryKey: trpc.dashboard.state.queryKey() })
      },
      onError: (err) => toast.error(err.message),
    }),
  )
  const forceDeliver = useMutation(
    trpc.alert.forceDeliver.mutationOptions({
      onSuccess: () => {
        toast.success('Scheduled for immediate delivery')
        queryClient.invalidateQueries({ queryKey: trpc.dashboard.state.queryKey() })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  return (
    <div className="card">
      <div className="card-head">
        <span className="title">Pending + held alerts</span>
        <div className="spacer" />
        <span className="label-xs">{queue.length} queued</span>
      </div>
      {queue.length === 0 ? (
        <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>No alerts in queue.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 70 }}>ID</th>
              <th style={{ width: 80 }}>Ticker</th>
              <th style={{ width: 70 }}>Dir</th>
              <th style={{ width: 80 }}>State</th>
              <th style={{ width: 90 }}>Score</th>
              <th style={{ width: 90 }}>Entry</th>
              <th style={{ width: 160 }}>Fired</th>
              <th style={{ width: 160 }}>Deliver</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((a) => (
              <tr key={a.id}>
                <td className="mono">#{a.id}</td>
                <td className="mono"><strong>{a.symbol}</strong></td>
                <td className="label-xs">{a.direction}</td>
                <td>
                  <span className="pill" style={{ color: a.state === 'held' ? 'var(--warn)' : 'var(--pos)' }}>
                    {a.state}
                  </span>
                </td>
                <td className="mono">{a.compositeScoreAtFire.toFixed(2)}</td>
                <td className="mono">${a.entryPrice.toFixed(2)}</td>
                <td className="label-xs muted mono">{new Date(a.firedAt).toLocaleString()}</td>
                <td className="label-xs muted mono">
                  {a.deliverAt ? new Date(a.deliverAt).toLocaleString() : '—'}
                </td>
                <td>
                  <div className="row-d" style={{ gap: 6 }}>
                    {a.state === 'held' ? (
                      <button
                        className="btn"
                        type="button"
                        disabled={forceDeliver.isPending}
                        onClick={() => forceDeliver.mutate({ id: a.id })}
                      >
                        Deliver now
                      </button>
                    ) : null}
                    <button
                      className="btn"
                      type="button"
                      disabled={cancel.isPending}
                      onClick={() => {
                        const reason = window.prompt('Cancel reason:')
                        if (reason && reason.trim().length > 0) {
                          cancel.mutate({ id: a.id, reason: reason.trim() })
                        }
                      }}
                    >
                      Cancel
                    </button>
                    <a className="btn" href={`/alerts/${a.id}`} target="_blank" rel="noreferrer">
                      Audit
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Simulation({
  factors,
  tickers,
}: {
  factors: NonNullable<DashboardData>['factors']
  tickers: string[]
}) {
  const trpc = useTRPC()
  const [symbol, setSymbol] = useState(tickers[0] ?? 'FRO')
  const [sentiment, setSentiment] = useState<'bullish' | 'bearish' | 'neutral'>('bullish')
  const [factorSlug, setFactorSlug] = useState(factors[0]?.slug ?? '')
  const [delta, setDelta] = useState(0.5)
  const [run, setRun] = useState<null | {
    symbol: string
    factorSlug: string
    sentiment: 'bullish' | 'bearish' | 'neutral'
    delta: number
  }>(null)

  const simulateInput = run
    ? {
        sentiment: run.sentiment,
        affectedTickers: [{ symbol: run.symbol, confidence: 0.8 }],
        factorDeltas: [{ factorSlug: run.factorSlug, delta: run.delta, reason: 'simulation' }],
        overallConfidence: 0.8,
        excerpt: 'simulated candidate',
      }
    : {
        sentiment: 'neutral' as const,
        affectedTickers: [{ symbol: tickers[0] ?? 'FRO', confidence: 0 }],
        factorDeltas: [],
        overallConfidence: 0,
        excerpt: 'placeholder',
      }
  const { data, isFetching } = useQuery(
    trpc.engine.simulate.queryOptions(simulateInput, { enabled: run !== null }),
  )

  return (
    <div className="card">
      <div className="card-head">
        <span className="title">Simulation</span>
        <div className="spacer" />
        <span className="label-xs">dry run — no persistence</span>
      </div>
      <div
        style={{
          padding: 'var(--pad-3)',
          display: 'grid',
          gap: 'var(--pad-2)',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          alignItems: 'end',
        }}
      >
        <label className="stack" style={{ gap: 4 }}>
          <span className="label-xs muted">Ticker</span>
          <select className="input-d" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {tickers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="label-xs muted">Sentiment</span>
          <select
            className="input-d"
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value as typeof sentiment)}
          >
            <option value="bullish">bullish</option>
            <option value="bearish">bearish</option>
            <option value="neutral">neutral</option>
          </select>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="label-xs muted">Factor</span>
          <select className="input-d" value={factorSlug} onChange={(e) => setFactorSlug(e.target.value)}>
            {factors.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.slug}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="label-xs muted">Delta</span>
          <input
            className="input-d"
            type="number"
            step={0.1}
            min={-2}
            max={2}
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
          />
        </label>
        <button
          className="btn"
          type="button"
          onClick={() => setRun({ symbol, sentiment, factorSlug, delta })}
        >
          Simulate
        </button>
      </div>
      {run && data ? (
        <div style={{ padding: 'var(--pad-3)', borderTop: '1px solid var(--border)' }}>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            MUTATIONS
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Factor</th>
                <th>Old</th>
                <th>New</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              {data.mutations.map((m, i) => (
                <tr key={i}>
                  <td className="mono">{m.symbol}</td>
                  <td className="mono">{m.factorSlug}</td>
                  <td className="mono">{m.oldValue.toFixed(2)}</td>
                  <td className="mono">{m.newValue.toFixed(2)}</td>
                  <td className="mono">{m.delta.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="label-xs" style={{ marginTop: 12, marginBottom: 6 }}>
            WOULD TRIGGER
          </div>
          {data.wouldTrigger.length === 0 ? (
            <div className="label-xs muted">No triggers (below threshold or insufficient support).</div>
          ) : (
            <ul>
              {data.wouldTrigger.map((t, i) => (
                <li key={i} className="mono">
                  {t.symbol} {t.direction} @ {t.compositeScore.toFixed(2)} (support: {t.supportingCandidateIds.length})
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : isFetching ? (
        <div style={{ padding: 'var(--pad-3)', color: 'var(--fg-3)' }}>Running simulation…</div>
      ) : null}
    </div>
  )
}

function HistoryStream({ rows }: { rows: Array<{ id: number; symbol: string; factorSlug: string; oldValue: number; newValue: number; delta: number; reason: string; createdAt: Date | string }> }) {
  const recent = useMemo(() => rows.slice(0, 50), [rows])
  return (
    <div className="card">
      <div className="card-head">
        <span className="title">Recent factor mutations</span>
        <div className="spacer" />
        <span className="label-xs">{recent.length} shown</span>
      </div>
      {recent.length === 0 ? (
        <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>No history yet.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 160 }}>At</th>
              <th style={{ width: 80 }}>Ticker</th>
              <th style={{ width: 180 }}>Factor</th>
              <th style={{ width: 70 }}>Old</th>
              <th style={{ width: 70 }}>New</th>
              <th style={{ width: 70 }}>Delta</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="label-xs muted mono">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="mono">{r.symbol}</td>
                <td className="mono">{r.factorSlug}</td>
                <td className="mono">{r.oldValue.toFixed(2)}</td>
                <td className="mono">{r.newValue.toFixed(2)}</td>
                <td className="mono">{r.delta.toFixed(2)}</td>
                <td style={{ fontSize: 12 }}>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
