import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/news')({
  component: NewsPage,
})

type ProcessedFilter = 'any' | 'processed' | 'unprocessed'

function NewsPage() {
  const trpc = useTRPC()
  const [selectedSources, setSelectedSources] = useState<number[]>([])
  const [processed, setProcessed] = useState<ProcessedFilter>('any')
  const [search, setSearch] = useState('')

  const { data: sources } = useQuery(trpc.newsSource.list.queryOptions())
  const { data, isLoading } = useQuery(
    trpc.newsItem.list.queryOptions({
      sourceIds: selectedSources.length ? selectedSources : undefined,
      processed,
      search: search.trim() || undefined,
      limit: 100,
    }),
  )

  const sourceOptions = useMemo(() => sources ?? [], [sources])
  const items = data?.items ?? []
  const itemIds = useMemo(() => items.map((i) => i.id), [items])
  const { data: candidatesByNewsId } = useQuery(
    trpc.candidate.latestBySourceIds.queryOptions(
      { sourceKind: 'news', sourceRefIds: itemIds },
      { enabled: itemIds.length > 0 },
    ),
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ANALYST / NEWS
          </div>
          <h1 className="page-title">News inbox</h1>
          <div className="page-sub">
            Deduped headlines from configured RSS + scraper sources. Signal
            extraction lands in T07.
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
            gridTemplateColumns: 'minmax(0, 2fr) 160px minmax(0, 2fr)',
          }}
        >
          <input
            className="input-d"
            placeholder="Search titles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input-d"
            value={processed}
            onChange={(e) => setProcessed(e.target.value as ProcessedFilter)}
          >
            <option value="any">All items</option>
            <option value="unprocessed">Unprocessed only</option>
            <option value="processed">Processed only</option>
          </select>
          <select
            className="input-d"
            multiple
            value={selectedSources.map(String)}
            onChange={(e) =>
              setSelectedSources(
                Array.from(e.target.selectedOptions).map((o) =>
                  parseInt(o.value, 10),
                ),
              )
            }
            style={{ minHeight: 64 }}
          >
            {sourceOptions.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Items</span>
          <div className="spacer" />
          <span className="label-xs">most recent first</span>
        </div>
        {isLoading ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            No items match these filters. Try "Run ingest now" on{' '}
            <a href="/admin/sources">Sources</a>.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Title</th>
                <th style={{ width: 140 }}>Source</th>
                <th style={{ width: 150 }}>Published</th>
                <th style={{ width: 220 }}>Extraction</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const candidate = candidatesByNewsId?.[item.id]
                return (
                  <tr key={item.id}>
                    <td>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ color: 'var(--fg-1)' }}
                      >
                        {item.title}
                      </a>
                      {item.bodyText ? (
                        <div
                          className="label-sm muted"
                          style={{
                            marginTop: 2,
                            maxWidth: 680,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.bodyText.slice(0, 200)}
                        </div>
                      ) : null}
                    </td>
                    <td className="label-xs">{item.source.name}</td>
                    <td className="label-xs mono">
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleString()
                        : '—'}
                    </td>
                    <td>
                      <NewsExtractionCell
                        processedAt={item.processedAt}
                        candidate={candidate ?? null}
                      />
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

interface NewsCandidateSummary {
  id: number
  eventClassSlug: string | null
  overallConfidence: number
  sentiment: string | null
  tickers: string[]
}

function NewsExtractionCell({
  processedAt,
  candidate,
}: {
  processedAt: Date | string | null
  candidate: NewsCandidateSummary | null
}) {
  if (!processedAt) {
    return <span className="label-xs muted">pending</span>
  }
  if (!candidate) {
    return (
      <span className="pill" style={{ color: 'var(--fg-3)' }}>
        processed · no signal
      </span>
    )
  }
  if (!candidate.eventClassSlug) {
    return (
      <a
        href="/admin/candidates"
        className="pill"
        style={{ color: 'var(--fg-3)', textDecoration: 'none' }}
      >
        not relevant
      </a>
    )
  }
  return (
    <a
      href="/admin/candidates"
      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
    >
      <div className="mono" style={{ fontSize: 12 }}>
        {candidate.eventClassSlug}
      </div>
      <div className="label-xs muted">
        {candidate.sentiment ?? '—'} · conf{' '}
        {candidate.overallConfidence.toFixed(2)}
        {candidate.tickers.length > 0
          ? ` · ${candidate.tickers.join(', ')}`
          : ''}
      </div>
    </a>
  )
}
