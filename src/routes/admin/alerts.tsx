import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/alerts')({
  component: AlertsPage,
})

type StateFilter = 'any' | 'pending' | 'held' | 'delivered' | 'cancelled'
type DirectionFilter = 'any' | 'long' | 'short'

function AlertsPage() {
  const trpc = useTRPC()
  const [state, setState] = useState<StateFilter>('any')
  const [direction, setDirection] = useState<DirectionFilter>('any')
  const [symbol, setSymbol] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery(
    trpc.alert.list.queryOptions({
      state: state === 'any' ? undefined : state,
      direction: direction === 'any' ? undefined : direction,
      tickerSymbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
      limit: 100,
    }),
  )
  const items = data?.items ?? []

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ANALYST / ALERTS
          </div>
          <h1 className="page-title">Alerts</h1>
          <div className="page-sub">All alerts (any state). Public audit pages at /alerts/[id] ship with T12.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Filters</span>
        </div>
        <div
          style={{
            padding: 'var(--pad-3)',
            display: 'grid',
            gap: 'var(--pad-2)',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          }}
        >
          <select
            className="input-d"
            value={state}
            onChange={(e) => setState(e.target.value as StateFilter)}
          >
            <option value="any">Any state</option>
            <option value="pending">Pending</option>
            <option value="held">Held</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="input-d"
            value={direction}
            onChange={(e) => setDirection(e.target.value as DirectionFilter)}
          >
            <option value="any">Any direction</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <input
            className="input-d"
            placeholder="Ticker (e.g. FRO)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Alerts</span>
          <div className="spacer" />
          <span className="label-xs">{items.length} shown</span>
        </div>
        {isLoading ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>No alerts match these filters.</div>
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
                <th style={{ width: 90 }}>EV 5d</th>
                <th style={{ width: 80 }}>Hit%</th>
                <th style={{ width: 60 }}>N</th>
                <th style={{ width: 160 }}>Fired</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  style={{ cursor: 'pointer', background: selectedId === a.id ? 'var(--bg-2)' : undefined }}
                >
                  <td className="mono">#{a.id}</td>
                  <td className="mono"><strong>{a.symbol}</strong></td>
                  <td className="label-xs">{a.direction}</td>
                  <td>
                    <span className="pill">{a.state}</span>
                  </td>
                  <td className="mono">{a.compositeScoreAtFire.toFixed(2)}</td>
                  <td className="mono">${a.entryPrice.toFixed(2)}</td>
                  <td className="mono">{(a.expectedReturn5d * 100).toFixed(1)}%</td>
                  <td className="mono">{(a.hitRate * 100).toFixed(0)}%</td>
                  <td className="mono">{a.nComparables}</td>
                  <td className="label-xs muted mono">{new Date(a.firedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId !== null ? <AlertDetail id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </div>
  )
}

function AlertDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.alert.byId.queryOptions({ id }))
  return (
    <div className="card">
      <div className="card-head">
        <span className="title">Alert #{id}</span>
        <div className="spacer" />
        <button className="btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div style={{ padding: 'var(--pad-3)' }}>
        {isLoading || !data ? (
          <div style={{ color: 'var(--fg-3)' }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--pad-3)', gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div className="label-xs" style={{ marginBottom: 4 }}>
                SUMMARY
              </div>
              <div>
                <strong>{data.ticker.symbol}</strong> {data.direction} @ ${data.entryPrice.toFixed(2)}
              </div>
              <div style={{ marginTop: 8, fontSize: 13 }}>{data.thesis}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-2)' }}>
                <strong>Catalyst:</strong> {data.topCatalyst}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--fg-2)' }}>
                <strong>Invalidation:</strong> {data.invalidation}
              </div>
              <div className="label-xs muted" style={{ marginTop: 8 }}>
                Composite {data.compositeScoreAtFire.toFixed(2)} · EV5d {(data.expectedReturn5d * 100).toFixed(1)}% ·
                Hit {(data.hitRate * 100).toFixed(0)}% (N={data.nComparables})
              </div>
              {data.cancelReason ? (
                <div className="label-xs" style={{ color: 'var(--warn)', marginTop: 8 }}>
                  Cancelled: {data.cancelReason}
                </div>
              ) : null}
            </div>
            <div>
              <div className="label-xs" style={{ marginBottom: 4 }}>
                SOURCES
              </div>
              {data.sources.length === 0 ? (
                <div className="label-xs muted">None recorded.</div>
              ) : (
                <ul style={{ fontSize: 12 }}>
                  {data.sources.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      {s.newsItem ? (
                        <>
                          <a href={s.newsItem.url} target="_blank" rel="noreferrer">
                            {s.newsItem.title}
                          </a>{' '}
                          <span className="label-xs muted">
                            {s.newsItem.source.name} ·{' '}
                            {s.newsItem.publishedAt
                              ? new Date(s.newsItem.publishedAt).toLocaleString()
                              : '—'}
                          </span>
                        </>
                      ) : s.xPost ? (
                        <>
                          <span className="mono">@{s.xPost.account.handle}</span> — {s.xPost.text}
                        </>
                      ) : (
                        <span className="label-xs muted">missing source</span>
                      )}
                      <span className="label-xs muted" style={{ marginLeft: 6 }}>
                        w={s.contributionWeight.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
