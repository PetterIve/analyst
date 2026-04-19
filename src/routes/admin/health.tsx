import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/health')({
  component: HealthPage,
})

function HealthPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(trpc.obs.health.queryOptions())

  const runIngestNews = useMutation(
    trpc.cron.runIngestNews.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({
          queryKey: trpc.obs.health.queryKey(),
        })
        toast.success(
          `ingest-news: ${result.totalInserted} new across ${result.perSource.length} sources`,
        )
      },
      onError: (error) => toast.error(`ingest-news failed: ${error.message}`),
    }),
  )

  const jobs = data?.jobs ?? []
  const recentErrors = data?.recentErrors ?? []
  const alerts = data?.alerts

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ADMIN / HEALTH
          </div>
          <h1 className="page-title">Workers &amp; health</h1>
          <div className="page-sub">
            Cron run history, recent failures, and alert delivery counts.
            LLM cost tracking lands once T07 wires the extractor.
          </div>
        </div>
        <div className="row-d">
          <span
            className="pill"
            title={
              data?.telegramErrorChannelConfigured
                ? 'TELEGRAM_ERROR_CHAT_ID is set — failures notify the error channel.'
                : 'TELEGRAM_ERROR_CHAT_ID not set — failures only land in CronRun + logs.'
            }
            style={{
              color: data?.telegramErrorChannelConfigured
                ? 'var(--pos)'
                : 'var(--fg-3)',
            }}
          >
            error channel{' '}
            {data?.telegramErrorChannelConfigured ? 'on' : 'off'}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Crons</span>
          <div className="spacer" />
          <span className="label-xs">last run + trailing 24h</span>
        </div>
        {isLoading ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            Loading…
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            No cron runs recorded yet.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Job</th>
                <th>Last run</th>
                <th>Status</th>
                <th>Duration</th>
                <th>24h ok / err</th>
                <th>Last error</th>
                <th style={{ width: 96 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.jobName}>
                  <td className="mono">{job.jobName}</td>
                  <td className="label-xs mono">
                    {job.lastRunAt
                      ? new Date(job.lastRunAt).toLocaleString()
                      : '—'}
                  </td>
                  <td>
                    {job.lastStatus === 'ok' ? (
                      <span className="pill" style={{ color: 'var(--pos)' }}>
                        ok
                      </span>
                    ) : job.lastStatus === 'error' ? (
                      <span className="pill" style={{ color: 'var(--neg)' }}>
                        error
                      </span>
                    ) : (
                      <span className="label-xs muted">never</span>
                    )}
                  </td>
                  <td className="label-xs mono">
                    {job.durationMs != null
                      ? `${(job.durationMs / 1000).toFixed(1)}s`
                      : '—'}
                  </td>
                  <td className="label-xs mono">
                    {job.successesLast24h} / {job.failuresLast24h}
                  </td>
                  <td
                    className="label-xs muted"
                    style={{
                      maxWidth: 320,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={job.lastErrorMsg ?? undefined}
                  >
                    {job.lastErrorMsg ?? '—'}
                  </td>
                  <td>
                    {job.jobName === 'ingest-news' ? (
                      <button
                        className="btn"
                        type="button"
                        disabled={runIngestNews.isPending}
                        onClick={() => runIngestNews.mutate()}
                      >
                        Run now
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Alert delivery</span>
          <div className="spacer" />
          <span className="label-xs">populated when T11 ships</span>
        </div>
        <div
          style={{
            padding: 'var(--pad-3)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 'var(--pad-2)',
          }}
        >
          <Stat label="Delivered 24h" value={alerts?.delivered24h ?? 0} />
          <Stat label="Delivered 7d" value={alerts?.delivered7d ?? 0} />
          <Stat label="Pending" value={alerts?.pending ?? 0} />
          <Stat label="Held (off-hours)" value={alerts?.held ?? 0} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Recent errors (24h)</span>
          <div className="spacer" />
          <span className="label-xs">{recentErrors.length} shown</span>
        </div>
        {recentErrors.length === 0 ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            No errors in the last 24 hours.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Time</th>
                <th>Job</th>
                <th>Run</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {recentErrors.map((e) => (
                <tr key={e.id}>
                  <td className="label-xs mono">
                    {new Date(e.startedAt).toLocaleString()}
                  </td>
                  <td className="mono">{e.jobName}</td>
                  <td className="label-xs mono">#{e.id}</td>
                  <td
                    className="label-xs"
                    style={{
                      color: 'var(--neg)',
                      maxWidth: 520,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={e.errorMsg ?? undefined}
                  >
                    {e.errorMsg ?? '(no message)'}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 'var(--pad-3)',
        border: '1px solid var(--border)',
        borderRadius: 6,
      }}
    >
      <div className="label-xs muted" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
    </div>
  )
}
