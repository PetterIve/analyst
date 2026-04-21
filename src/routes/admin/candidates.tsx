import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/candidates')({
  component: CandidatesPage,
})

type ConsumedFilter = 'any' | 'consumed' | 'pending'

function CandidatesPage() {
  const trpc = useTRPC()
  const [sourceKind, setSourceKind] = useState<'any' | 'news' | 'x'>('any')
  const [consumed, setConsumed] = useState<ConsumedFilter>('any')
  const [minConfidence, setMinConfidence] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery(
    trpc.candidate.list.queryOptions({
      sourceKind: sourceKind === 'any' ? undefined : sourceKind,
      consumed,
      minConfidence: minConfidence > 0 ? minConfidence : undefined,
      limit: 100,
    }),
  )

  const items = data?.items ?? []

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ADMIN / CANDIDATES
          </div>
          <h1 className="page-title">Event candidates</h1>
          <div className="page-sub">
            Structured signals extracted from news + X posts. T09 consumes
            pending candidates to update factor state.
          </div>
        </div>
        <div className="row-d">
          <span className="pill">{items.length} shown</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Filters</span>
          <div className="spacer" />
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
            value={sourceKind}
            onChange={(e) =>
              setSourceKind(e.target.value as 'any' | 'news' | 'x')
            }
          >
            <option value="any">Any source</option>
            <option value="news">News only</option>
            <option value="x">X only</option>
          </select>
          <select
            className="input-d"
            value={consumed}
            onChange={(e) => setConsumed(e.target.value as ConsumedFilter)}
          >
            <option value="any">Consumed or pending</option>
            <option value="pending">Pending only</option>
            <option value="consumed">Consumed only</option>
          </select>
          <label
            className="row-d"
            style={{
              gap: 8,
              padding: '0 8px',
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}
          >
            <span className="label-xs muted">min conf</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span className="mono" style={{ width: 40, textAlign: 'right' }}>
              {minConfidence.toFixed(2)}
            </span>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Candidates</span>
          <div className="spacer" />
          <span className="label-xs">most recent first</span>
        </div>
        {isLoading ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            No candidates match these filters. Run the extractor from{' '}
            <a href="/admin/extractor">/admin/extractor</a>.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Created</th>
                <th style={{ width: 70 }}>Source</th>
                <th>Event class</th>
                <th>Tickers</th>
                <th style={{ width: 90 }}>Sentiment</th>
                <th style={{ width: 70 }}>Conf</th>
                <th style={{ width: 90 }}>State</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    cursor: 'pointer',
                    background:
                      selectedId === item.id ? 'var(--bg-2)' : undefined,
                  }}
                >
                  <td className="label-xs mono">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="label-xs">{item.sourceKind}</td>
                  <td>
                    {item.eventClassSlug ? (
                      <span className="mono" style={{ fontSize: 12 }}>
                        {item.eventClassSlug}
                      </span>
                    ) : (
                      <span className="label-xs muted">— not relevant</span>
                    )}
                  </td>
                  <td className="label-xs mono">
                    {item.summary.tickers.length > 0
                      ? item.summary.tickers.join(', ')
                      : '—'}
                  </td>
                  <td className="label-xs">{item.summary.sentiment ?? '—'}</td>
                  <td className="label-xs mono">
                    {item.overallConfidence.toFixed(2)}
                  </td>
                  <td>
                    {item.consumedAt ? (
                      <span className="pill" style={{ color: 'var(--pos)' }}>
                        consumed
                      </span>
                    ) : (
                      <span className="label-xs muted">pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId !== null ? (
        <CandidateDetail
          id={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  )
}

function CandidateDetail({
  id,
  onClose,
}: {
  id: number
  onClose: () => void
}) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.candidate.byId.queryOptions({ id }),
  )

  return (
    <div className="card">
      <div className="card-head">
        <span className="title">Candidate #{id}</span>
        <div className="spacer" />
        <button className="btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div style={{ padding: 'var(--pad-3)' }}>
        {isLoading || !data ? (
          <div style={{ color: 'var(--fg-3)' }}>Loading…</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 'var(--pad-3)',
              gridTemplateColumns: '1fr 1fr',
            }}
          >
            <div>
              <div className="label-xs" style={{ marginBottom: 4 }}>
                SOURCE
              </div>
              {data.source === null ? (
                <div className="label-xs muted">source row missing</div>
              ) : data.source.kind === 'news' ? (
                <div>
                  <div style={{ marginBottom: 4 }}>
                    <a
                      href={data.source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {data.source.title}
                    </a>
                  </div>
                  <div className="label-xs muted">
                    {data.source.sourceName} ·{' '}
                    {data.source.publishedAt
                      ? new Date(data.source.publishedAt).toLocaleString()
                      : '—'}
                  </div>
                  {data.source.bodyText ? (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: 'var(--fg-2)',
                        maxHeight: 240,
                        overflow: 'auto',
                      }}
                    >
                      {data.source.bodyText}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <div className="label-xs muted">
                    {data.source.sourceName} ·{' '}
                    {new Date(data.source.postedAt).toLocaleString()}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    {data.source.text}
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="label-xs" style={{ marginBottom: 4 }}>
                EXTRACTED JSON
              </div>
              <pre
                className="mono"
                style={{
                  fontSize: 11,
                  maxHeight: 360,
                  overflow: 'auto',
                  background: 'var(--bg-2)',
                  padding: 8,
                  borderRadius: 4,
                }}
              >
                {JSON.stringify(data.rawJson, null, 2)}
              </pre>
              {data.parseError ? (
                <div
                  className="label-xs"
                  style={{ color: 'var(--neg)', marginTop: 4 }}
                >
                  parse error: {data.parseError}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
