import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/sources')({
  component: SourcesPage,
})

type SourceRow = {
  id: number
  name: string
  url: string
  rssUrl: string | null
  kind: 'rss' | 'scraper'
  pollIntervalSec: number
  active: boolean
  lastFetchedAt: Date | null
  lastError: string | null
}

function SourcesPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: sources, isLoading } = useQuery(
    trpc.newsSource.list.queryOptions(),
  )

  const updateMutation = useMutation(
    trpc.newsSource.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.newsSource.list.queryKey(),
        })
        toast.success('Source saved')
      },
      onError: (error) => toast.error(`Update failed: ${error.message}`),
    }),
  )

  const runMutation = useMutation(
    trpc.cron.runIngestNews.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({
          queryKey: trpc.newsSource.list.queryKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.newsItem.list.queryKey(),
        })
        toast.success(
          `Ingest done: ${result.totalInserted} new across ${result.perSource.length} sources`,
        )
      },
      onError: (error) => toast.error(`Ingest failed: ${error.message}`),
    }),
  )

  const activeCount = (sources ?? []).filter((s) => s.active).length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ADMIN / SOURCES
          </div>
          <h1 className="page-title">News sources</h1>
          <div className="page-sub">
            RSS feeds + scraper fallbacks. Cron runs every 5 minutes and
            respects each source's poll interval.
          </div>
        </div>
        <div className="row-d">
          <span className="pill">{activeCount} active</span>
          <button
            className="btn accent"
            type="button"
            disabled={runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            {runMutation.isPending ? 'Running…' : 'Run ingest now'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Configured sources</span>
          <div className="spacer" />
          <span className="label-xs">edit inline</span>
        </div>
        {isLoading ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            Loading…
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Source</th>
                <th style={{ width: 80 }}>Kind</th>
                <th className="num" style={{ width: 120 }}>
                  Poll (s)
                </th>
                <th style={{ width: 160 }}>Last fetched</th>
                <th style={{ width: 80 }}>Status</th>
                <th style={{ width: 80 }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {(sources ?? []).map((s) => (
                <Row
                  key={s.id}
                  source={s as SourceRow}
                  onUpdate={(patch) =>
                    updateMutation.mutate({ id: s.id, ...patch })
                  }
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
  source,
  onUpdate,
}: {
  source: SourceRow
  onUpdate: (patch: {
    pollIntervalSec?: number
    active?: boolean
  }) => void
}) {
  const [poll, setPoll] = useState<number>(source.pollIntervalSec)

  return (
    <tr>
      <td>
        <div>{source.name}</div>
        <div className="label-xs mono" style={{ color: 'var(--fg-4)' }}>
          {source.rssUrl ?? source.url}
        </div>
      </td>
      <td className="label-xs">{source.kind}</td>
      <td className="num">
        <input
          className="input-d"
          type="number"
          min={60}
          max={86_400}
          step={30}
          value={poll}
          onChange={(e) => setPoll(parseInt(e.target.value, 10) || 0)}
          onBlur={() => {
            if (poll !== source.pollIntervalSec && poll >= 60) {
              onUpdate({ pollIntervalSec: poll })
            }
          }}
          style={{ width: 90 }}
        />
      </td>
      <td className="label-xs mono">
        {source.lastFetchedAt
          ? new Date(source.lastFetchedAt).toLocaleString()
          : '—'}
      </td>
      <td>
        {source.lastError ? (
          <span
            className="pill"
            title={source.lastError}
            style={{ color: 'var(--neg)' }}
          >
            error
          </span>
        ) : source.lastFetchedAt ? (
          <span className="pill" style={{ color: 'var(--pos)' }}>
            ok
          </span>
        ) : (
          <span className="label-xs" style={{ color: 'var(--fg-4)' }}>
            —
          </span>
        )}
      </td>
      <td>
        <input
          type="checkbox"
          checked={source.active}
          onChange={(e) => onUpdate({ active: e.target.checked })}
        />
      </td>
    </tr>
  )
}
