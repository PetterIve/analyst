import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTRPC } from '#/integrations/trpc/react'

type Range = '1M' | '6M' | '1Y' | '5Y' | 'MAX'

const rangeOptions: ReadonlyArray<Range> = ['1M', '6M', '1Y', '5Y', 'MAX']

export const Route = createFileRoute('/admin/prices/$symbol')({
  component: SymbolChartPage,
})

function SymbolChartPage() {
  const { symbol } = Route.useParams()
  const trpc = useTRPC()
  const [range, setRange] = useState<Range>('1Y')
  const [showBenchmark, setShowBenchmark] = useState(true)

  const from = useMemo(() => rangeToDate(range), [range])

  const seriesQuery = useQuery(
    trpc.price.series.queryOptions({
      symbol,
      from,
      withBenchmark: showBenchmark,
    }),
  )

  const chartData = useMemo(() => {
    if (!seriesQuery.data) return []
    const benchByDate = new Map<string, number>()
    const benchmark = seriesQuery.data.benchmark
    if (benchmark && benchmark.length) {
      const base = benchmark[0]?.adjClose
      if (base) {
        for (const row of benchmark) {
          benchByDate.set(
            row.date.toISOString().slice(0, 10),
            (row.adjClose / base) * 100,
          )
        }
      }
    }
    const first = seriesQuery.data.bars[0]
    const baseAdj = first?.adjClose ?? null
    return seriesQuery.data.bars.map((bar) => {
      const iso = bar.date.toISOString().slice(0, 10)
      return {
        date: iso,
        close: bar.close,
        adjClose: bar.adjClose,
        tickerIdx: baseAdj ? (bar.adjClose / baseAdj) * 100 : null,
        benchIdx: benchByDate.get(iso) ?? null,
      }
    })
  }, [seriesQuery.data])

  const quality = useMemo(() => {
    const bars = seriesQuery.data?.bars
    if (!bars || bars.length === 0) {
      return { rowCount: 0, firstDate: null, lastDate: null, gapCount: 0 }
    }
    let gapCount = 0
    for (let i = 1; i < bars.length; i++) {
      const prev = bars[i - 1].date
      const curr = bars[i].date
      const businessGap = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
      )
      if (businessGap > 4) gapCount++
    }
    return {
      rowCount: bars.length,
      firstDate: bars[0].date,
      lastDate: bars[bars.length - 1].date,
      gapCount,
    }
  }, [seriesQuery.data])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link
            to="/admin/prices"
            style={{
              textDecoration: 'none',
              color: 'var(--fg-3)',
              fontSize: 12,
            }}
          >
            ← Prices
          </Link>
          <h1
            className="page-title mono"
            style={{ marginTop: 6 }}
          >
            {symbol}
          </h1>
          <div className="page-sub">
            {seriesQuery.data?.ticker.name
              ? `${seriesQuery.data.ticker.name} · ${seriesQuery.data.ticker.segment.toUpperCase()}`
              : 'Daily OHLCV'}
          </div>
        </div>
        <div className="row-d" style={{ gap: 6, flexWrap: 'wrap' }}>
          {rangeOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`btn sm${range === opt ? ' primary' : ''}`}
              onClick={() => setRange(opt)}
            >
              {opt}
            </button>
          ))}
          <button
            type="button"
            className={`btn sm${showBenchmark ? ' primary' : ''}`}
            onClick={() => setShowBenchmark((v) => !v)}
          >
            XLE overlay
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Price chart</span>
          <div className="spacer" />
          <span className="label-xs">
            {seriesQuery.data?.benchmarkSymbol &&
              showBenchmark &&
              `benchmark: ${seriesQuery.data.benchmarkSymbol}`}
          </span>
        </div>
        <div style={{ padding: 'var(--pad-4)' }}>
          {seriesQuery.isLoading ? (
            <div style={{ color: 'var(--fg-3)' }}>Loading…</div>
          ) : seriesQuery.error ? (
            <div style={{ color: 'var(--neg)' }}>
              {seriesQuery.error.message}
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ color: 'var(--fg-3)' }}>
              No price data. Run a backfill from the Prices overview.
            </div>
          ) : (
            <div style={{ height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="date"
                    minTickGap={40}
                    stroke="var(--fg-3)"
                    fontSize={11}
                  />
                  <YAxis
                    yAxisId="price"
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => v.toFixed(2)}
                    stroke="var(--fg-3)"
                    fontSize={11}
                  />
                  {showBenchmark && (
                    <YAxis
                      yAxisId="index"
                      orientation="right"
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => `${v.toFixed(0)}`}
                      stroke="var(--fg-3)"
                      fontSize={11}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-1)',
                      border: '1px solid var(--border)',
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="adjClose"
                    name={`${symbol} adj close`}
                    stroke="var(--accent, #2563eb)"
                    dot={false}
                    strokeWidth={1.5}
                  />
                  {showBenchmark && (
                    <>
                      <Line
                        yAxisId="index"
                        type="monotone"
                        dataKey="tickerIdx"
                        name={`${symbol} (idx=100)`}
                        stroke="var(--accent, #2563eb)"
                        strokeDasharray="2 4"
                        dot={false}
                        strokeWidth={1}
                      />
                      <Line
                        yAxisId="index"
                        type="monotone"
                        dataKey="benchIdx"
                        name="XLE (idx=100)"
                        stroke="var(--warn, #f59e0b)"
                        dot={false}
                        strokeWidth={1.5}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Data quality</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--pad-3)',
            padding: 'var(--pad-4)',
          }}
        >
          <Stat label="Rows" value={quality.rowCount.toLocaleString()} />
          <Stat label="First" value={formatDate(quality.firstDate)} />
          <Stat label="Last" value={formatDate(quality.lastDate)} />
          <Stat
            label="Gaps > 4d"
            value={quality.gapCount.toString()}
            tone={quality.gapCount > 0 ? 'warn' : 'ok'}
          />
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'ok',
}: {
  label: string
  value: string
  tone?: 'ok' | 'warn'
}) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div
        className="mono"
        style={{
          fontSize: 18,
          marginTop: 4,
          color: tone === 'warn' ? 'var(--warn)' : 'var(--fg-1)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toISOString().slice(0, 10)
}

function rangeToDate(range: Range): Date | undefined {
  if (range === 'MAX') return undefined
  const now = new Date()
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  switch (range) {
    case '1M':
      d.setUTCMonth(d.getUTCMonth() - 1)
      return d
    case '6M':
      d.setUTCMonth(d.getUTCMonth() - 6)
      return d
    case '1Y':
      d.setUTCFullYear(d.getUTCFullYear() - 1)
      return d
    case '5Y':
      d.setUTCFullYear(d.getUTCFullYear() - 5)
      return d
  }
}
