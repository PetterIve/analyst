import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'

export function DrillDownPage({ slug }: { slug: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: cls, isLoading } = useQuery(
    trpc.eventClass.get.queryOptions({ slug }),
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.eventClass.get.queryKey({ slug }) })
    queryClient.invalidateQueries({ queryKey: trpc.eventClass.list.queryKey() })
  }

  const recompute = useMutation(
    trpc.eventClass.recomputeReturns.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Recomputed ${res.updated} instance(s)`)
        invalidate()
      },
      onError: (err) => toast.error(`Recompute failed: ${err.message}`),
    }),
  )

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>Loading…</div>
      </div>
    )
  }
  if (!cls) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Unknown class</h1>
            <Link to="/admin/events" style={{ color: 'var(--accent)' }}>
              ← back to catalog
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const instances = cls.instances
  const stats = cls.stats
  const lowN = stats.instanceCount < 5

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ANALYST / EVENTS / {cls.slug.toUpperCase()}
          </div>
          <h1 className="page-title">{cls.name}</h1>
          <div className="page-sub" style={{ maxWidth: 720 }}>
            {cls.description}
          </div>
        </div>
        <div className="row-d">
          <Link to="/admin/events" className="btn" style={{ textDecoration: 'none' }}>
            ← Catalog
          </Link>
          <span className="pill">{stats.instanceCount} instances</span>
          <span className="pill accent">{stats.observationCount} obs</span>
          {lowN && (
            <span className="pill warn">
              <span className="dot" /> LOW-N
            </span>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={recompute.isPending}
            onClick={() => recompute.mutate({ slug })}
          >
            {recompute.isPending ? '…' : 'Recompute returns'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Pooled forward-return stats</span>
          <div className="spacer" />
          <span className="label-xs">all (instance × ticker) data points</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 100 }}>Horizon</th>
              <th className="num" style={{ width: 80 }}>N</th>
              <th className="num" style={{ width: 100 }}>Mean</th>
              <th className="num" style={{ width: 100 }}>Median</th>
              <th className="num" style={{ width: 100 }}>StDev</th>
              <th className="num" style={{ width: 100 }}>Hit %</th>
            </tr>
          </thead>
          <tbody>
            <StatsRow label="1d" stats={stats.d1} />
            <StatsRow label="5d" stats={stats.d5} />
            <StatsRow label="20d" stats={stats.d20} />
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 'var(--pad-4)' }}>
        <div className="card-head">
          <span className="title">Per-ticker breakdown (5d)</span>
          <div className="spacer" />
          <span className="label-xs">stats across this ticker's appearances in this class</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 100 }}>Symbol</th>
              <th className="num" style={{ width: 80 }}>N</th>
              <th className="num" style={{ width: 100 }}>Mean</th>
              <th className="num" style={{ width: 100 }}>Median</th>
              <th className="num" style={{ width: 100 }}>StDev</th>
              <th className="num" style={{ width: 100 }}>Hit %</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.perTicker)
              .sort(([, a], [, b]) => (b.d5?.mean ?? -Infinity) - (a.d5?.mean ?? -Infinity))
              .map(([symbol, t]) => (
                <tr key={symbol}>
                  <td>
                    <b className="mono">{symbol}</b>
                  </td>
                  <td className="num mono">{t.d5?.count ?? 0}</td>
                  <td className="num mono">{formatPct(t.d5?.mean)}</td>
                  <td className="num mono">{formatPct(t.d5?.median)}</td>
                  <td className="num mono">{formatPct(t.d5?.stddev)}</td>
                  <td className="num mono">{formatHitRate(t.d5?.hitRate)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 'var(--pad-4)' }}>
        <div className="card-head">
          <span className="title">Instances</span>
          <div className="spacer" />
          <span className="label-xs">{instances.length} total</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Date</th>
              <th>Description</th>
              <th style={{ width: 200 }}>Affected</th>
              <th style={{ width: 90 }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((inst) => (
              <tr key={inst.id}>
                <td className="mono label-xs">
                  {inst.occurredAt.toISOString().slice(0, 10)}
                </td>
                <td>
                  <div>{inst.description ?? '—'}</div>
                  <div className="label-xs mono muted" style={{ marginTop: 2 }}>
                    {Object.entries(inst.tickerReturns)
                      .filter(([, r]) => r.d5 !== null)
                      .map(([s, r]) => `${s}: ${formatPct(r.d5)}`)
                      .join('  ·  ') || 'no return data yet'}
                  </div>
                </td>
                <td className="label-xs mono muted">
                  {inst.affectedSymbols.join(' ')}
                </td>
                <td>
                  {inst.sourceUrl ? (
                    <a
                      href={inst.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="label-xs"
                      style={{ color: 'var(--accent)' }}
                    >
                      link ↗
                    </a>
                  ) : (
                    <span className="label-xs muted">{inst.sourceKind}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddInstanceForm
        classSlug={slug}
        defaultSymbols={inferDefaultSymbols(instances)}
        onCreated={invalidate}
      />
    </div>
  )
}

function inferDefaultSymbols(
  instances: ReadonlyArray<{ affectedSymbols: ReadonlyArray<string> }>,
): string {
  // Most-common affected-symbol set in this class — saves the operator typing.
  const counts = new Map<string, number>()
  for (const i of instances) {
    const key = [...i.affectedSymbols].sort().join(' ')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best = ''
  let bestN = 0
  for (const [key, n] of counts) {
    if (n > bestN) {
      best = key
      bestN = n
    }
  }
  return best
}

function AddInstanceForm({
  classSlug,
  defaultSymbols,
  onCreated,
}: {
  classSlug: string
  defaultSymbols: string
  onCreated: () => void
}) {
  const trpc = useTRPC()
  const [occurredAt, setOccurredAt] = useState<string>(
    new Date().toISOString().slice(0, 10),
  )
  const [description, setDescription] = useState<string>('')
  const [sourceUrl, setSourceUrl] = useState<string>('')
  const [symbolsRaw, setSymbolsRaw] = useState<string>(defaultSymbols)

  const create = useMutation(
    trpc.eventInstance.create.mutationOptions({
      onSuccess: () => {
        toast.success('Instance added')
        setDescription('')
        setSourceUrl('')
        onCreated()
      },
      onError: (err) => toast.error(`Add failed: ${err.message}`),
    }),
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const symbols = symbolsRaw
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    if (symbols.length === 0) {
      toast.error('At least one ticker symbol required')
      return
    }
    create.mutate({
      classSlug,
      occurredAt: new Date(`${occurredAt}T00:00:00Z`),
      description,
      sourceUrl: sourceUrl.trim() || undefined,
      affectedSymbols: symbols,
    })
  }

  return (
    <div className="card" style={{ marginTop: 'var(--pad-4)' }}>
      <div className="card-head">
        <span className="title">Add instance</span>
        <div className="spacer" />
        <span className="label-xs">returns computed immediately from prices_daily</span>
      </div>
      <form onSubmit={submit} style={{ padding: 'var(--pad-4)' }}>
        <div className="stack" style={{ gap: 'var(--pad-3)' }}>
          <div className="row-d" style={{ gap: 'var(--pad-3)' }}>
            <label className="stack" style={{ gap: 4, flex: '0 0 160px' }}>
              <span className="label-xs">DATE (UTC)</span>
              <input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
              />
            </label>
            <label className="stack" style={{ gap: 4, flex: '1 1 auto' }}>
              <span className="label-xs">SOURCE URL (optional)</span>
              <input
                type="url"
                placeholder="https://…"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </label>
          </div>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label-xs">DESCRIPTION</span>
            <input
              type="text"
              placeholder="One-line summary of what happened"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={3}
              maxLength={500}
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label-xs">
              AFFECTED SYMBOLS ({defaultSymbols ? 'default = most common in class' : 'space or comma separated'})
            </span>
            <input
              type="text"
              placeholder="FRO DHT NAT …"
              value={symbolsRaw}
              onChange={(e) => setSymbolsRaw(e.target.value)}
              required
            />
          </label>
          <div className="row-d" style={{ justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn primary"
              disabled={create.isPending}
            >
              {create.isPending ? 'Adding…' : 'Add instance'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function StatsRow({
  label,
  stats,
}: {
  label: string
  stats: {
    count: number
    mean: number
    median: number
    stddev: number
    hitRate: number
  } | null
}) {
  return (
    <tr>
      <td>
        <b className="mono">{label}</b>
      </td>
      <td className="num mono">{stats?.count ?? 0}</td>
      <td className="num mono">{formatPct(stats?.mean)}</td>
      <td className="num mono">{formatPct(stats?.median)}</td>
      <td className="num mono">{formatPct(stats?.stddev)}</td>
      <td className="num mono">{formatHitRate(stats?.hitRate)}</td>
    </tr>
  )
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(2)}%`
}

function formatHitRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(0)}%`
}
