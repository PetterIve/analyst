import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'

export function CatalogPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: classes, isLoading } = useQuery(
    trpc.eventClass.list.queryOptions(),
  )

  const recompute = useMutation(
    trpc.eventClass.recomputeReturns.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Recomputed ${res.updated} instance(s), skipped ${res.skipped}`)
        queryClient.invalidateQueries({ queryKey: trpc.eventClass.list.queryKey() })
      },
      onError: (err) => toast.error(`Recompute failed: ${err.message}`),
    }),
  )

  const totals = useMemo(() => {
    const rows = classes ?? []
    return {
      classes: rows.length,
      instances: rows.reduce((n, r) => n + r.instanceCount, 0),
      lowSample: rows.filter((r) => r.instanceCount < 5).length,
    }
  }, [classes])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ANALYST / EVENTS
          </div>
          <h1 className="page-title">Event catalog</h1>
          <div className="page-sub">
            Historical comparables backing every alert. Each class lists its
            5d-return base rate across all instances and tickers; alerts cite
            these in the EV summary line. Low-sample classes (&lt;5) are
            flagged.
          </div>
        </div>
        <div className="row-d">
          <span className="pill">{totals.classes} classes</span>
          <span className="pill accent">{totals.instances} instances</span>
          {totals.lowSample > 0 && (
            <span className="pill warn">
              <span className="dot" /> {totals.lowSample} low-N
            </span>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={recompute.isPending}
            onClick={() => recompute.mutate({})}
          >
            {recompute.isPending ? 'Recomputing…' : 'Recompute returns'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Classes</span>
          <div className="spacer" />
          <span className="label-xs">d5 returns pooled across all (instance × ticker)</span>
        </div>
        {isLoading ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            Loading…
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Class</th>
                <th className="num" style={{ width: 80 }}>N</th>
                <th className="num" style={{ width: 90 }}>Mean d5</th>
                <th className="num" style={{ width: 90 }}>Median d5</th>
                <th className="num" style={{ width: 90 }}>StDev d5</th>
                <th className="num" style={{ width: 90 }}>Hit %</th>
                <th style={{ width: 80 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {classes?.map((cls) => {
                const lowN = cls.instanceCount < 5
                return (
                  <tr key={cls.id}>
                    <td>
                      <Link
                        to="/admin/events/$slug"
                        params={{ slug: cls.slug }}
                        style={{ textDecoration: 'none' }}
                      >
                        <div>
                          <b>{cls.name}</b>
                        </div>
                        <div className="label-xs mono">{cls.slug}</div>
                      </Link>
                      {cls.description ? (
                        <div
                          className="label-sm muted"
                          style={{ marginTop: 2, maxWidth: 560 }}
                        >
                          {cls.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="num mono">{cls.instanceCount}</td>
                    <td className="num mono">{formatPct(cls.meanD5)}</td>
                    <td className="num mono">{formatPct(cls.medianD5)}</td>
                    <td className="num mono">{formatPct(cls.stddevD5)}</td>
                    <td className="num mono">{formatHitRate(cls.hitRateD5)}</td>
                    <td>
                      {lowN ? (
                        <span className="pill warn">
                          <span className="dot" /> LOW-N
                        </span>
                      ) : (
                        <span className="pill ok">
                          <span className="dot" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(2)}%`
}

function formatHitRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(0)}%`
}
