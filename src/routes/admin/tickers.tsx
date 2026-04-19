import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/tickers')({
  component: TickersPage,
})

type TickerRow = {
  id: number
  symbol: string
  exchange: string
  segment: string
  name: string
  active: boolean
}

function TickersPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: tickers, isLoading } = useQuery(trpc.ticker.list.queryOptions())

  const updateMutation = useMutation(
    trpc.ticker.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.ticker.list.queryKey() })
      },
      onError: (error) => toast.error(`Update failed: ${error.message}`),
    }),
  )

  const activeCount = tickers?.filter((t) => t.active).length ?? 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ANALYST / TICKERS
          </div>
          <h1 className="page-title">Ticker universe</h1>
          <div className="page-sub">
            Crude + product tankers tracked by the engine. Toggle active to
            include in ingestion and alerts.
          </div>
        </div>
        <div className="row-d">
          <span className="pill">{tickers?.length ?? 0} total</span>
          <span className="pill ok">
            <span className="dot" /> {activeCount} active
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Universe</span>
          <div className="spacer" />
          <span className="label-xs">editable</span>
        </div>
        {isLoading ? (
          <div style={{ padding: 'var(--pad-4)', color: 'var(--fg-3)' }}>
            Loading…
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Symbol</th>
                <th style={{ width: 110 }}>Exchange</th>
                <th style={{ width: 110 }}>Segment</th>
                <th>Name</th>
                <th style={{ width: 110 }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {tickers?.map((t) => (
                <Row
                  key={t.id}
                  ticker={t as TickerRow}
                  onUpdate={(patch) =>
                    updateMutation.mutate({ id: t.id, ...patch })
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
  ticker,
  onUpdate,
}: {
  ticker: TickerRow
  onUpdate: (patch: { name?: string; active?: boolean }) => void
}) {
  const [draft, setDraft] = useState(ticker.name)
  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== ticker.name) onUpdate({ name: trimmed })
    else setDraft(ticker.name)
  }
  return (
    <tr>
      <td>
        <b className="mono">{ticker.symbol}</b>
      </td>
      <td className="mono label-xs">{ticker.exchange}</td>
      <td>
        <span className="pill">{ticker.segment.toUpperCase()}</span>
      </td>
      <td>
        <input
          className="input-d"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setDraft(ticker.name)
          }}
        />
      </td>
      <td>
        <button
          type="button"
          className={`btn sm${ticker.active ? ' primary' : ''}`}
          onClick={() => onUpdate({ active: !ticker.active })}
        >
          {ticker.active ? 'ON' : 'OFF'}
        </button>
      </td>
    </tr>
  )
}
