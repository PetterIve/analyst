import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/prompt')({
  component: PromptPage,
})

function PromptPage() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.extractor.previewPrompt.queryOptions(),
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ADMIN / PROMPT
          </div>
          <h1 className="page-title">Extractor system prompt</h1>
          <div className="page-sub">
            This is what gets sent to Claude as the cached system block on
            every extraction. Edit taxonomy in /admin/tickers, /admin/factors,
            /admin/events.
          </div>
        </div>
        <div className="row-d" style={{ gap: 8 }}>
          {data ? (
            <>
              <span className="pill">{data.tickerCount} tickers</span>
              <span className="pill">{data.factorCount} factors</span>
              <span className="pill">{data.eventClassCount} classes</span>
              <span className="pill">~{data.approxTokens} tok</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <span className="title">System prompt</span>
          <div className="spacer" />
          <span className="label-xs">
            {data ? `${data.characterCount.toLocaleString()} chars` : '—'}
          </span>
        </div>
        <div style={{ padding: 'var(--pad-3)' }}>
          {isLoading || !data ? (
            <div style={{ color: 'var(--fg-3)' }}>Loading…</div>
          ) : (
            <pre
              className="mono"
              style={{
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                background: 'var(--bg-2)',
                padding: 12,
                borderRadius: 4,
                maxHeight: 600,
                overflow: 'auto',
              }}
            >
              {data.prompt}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
