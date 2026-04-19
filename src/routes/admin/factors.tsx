import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/admin/factors')({
  component: FactorsPage,
})

type FactorRow = {
  id: number
  slug: string
  name: string
  description: string | null
  rangeMin: number
  rangeMax: number
  defaultValue: number
  weight: number
}

function FactorsPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: factors, isLoading } = useQuery(trpc.factor.list.queryOptions())

  const updateMutation = useMutation(
    trpc.factor.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.factor.list.queryKey() })
        toast.success('Weight saved')
      },
      onError: (error) => toast.error(`Update failed: ${error.message}`),
    }),
  )

  const total = useMemo(
    () => (factors ?? []).reduce((sum, f) => sum + f.weight, 0),
    [factors],
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ADMIN / FACTORS
          </div>
          <h1 className="page-title">Factor editor</h1>
          <div className="page-sub">
            Composite-score weights. Edits persist immediately — the engine
            (T09) reads the live values on each tick.
          </div>
        </div>
        <div className="row-d">
          <span className="pill">{factors?.length ?? 0} factors</span>
          <span className="pill accent">Σ weight = {total.toFixed(2)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Factor weights</span>
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
                <th>Factor</th>
                <th className="num" style={{ width: 120 }}>
                  Range
                </th>
                <th className="num" style={{ width: 90 }}>
                  Default
                </th>
                <th style={{ width: 220 }}>Weight</th>
                <th className="num" style={{ width: 80 }}>
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {factors?.map((f) => (
                <Row
                  key={f.id}
                  factor={f as FactorRow}
                  share={total > 0 ? (f.weight / total) * 100 : 0}
                  onUpdate={(weight) =>
                    updateMutation.mutate({ id: f.id, weight })
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
  factor,
  share,
  onUpdate,
}: {
  factor: FactorRow
  share: number
  onUpdate: (weight: number) => void
}) {
  const [draft, setDraft] = useState<number>(factor.weight)
  const commit = () => {
    if (draft !== factor.weight) onUpdate(draft)
  }
  return (
    <tr>
      <td>
        <div>{factor.name}</div>
        <div className="label-xs">{factor.slug}</div>
        {factor.description ? (
          <div
            className="label-sm muted"
            style={{ marginTop: 2, maxWidth: 520 }}
          >
            {factor.description}
          </div>
        ) : null}
      </td>
      <td className="num mono label-xs">
        {factor.rangeMin} … {factor.rangeMax}
      </td>
      <td className="num">{factor.defaultValue}</td>
      <td>
        <div className="row-d" style={{ gap: 8 }}>
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={draft}
            onChange={(e) => setDraft(parseFloat(e.target.value))}
            onMouseUp={commit}
            onKeyUp={commit}
            onBlur={commit}
            style={{ width: 140 }}
          />
          <span className="num" style={{ width: 44, textAlign: 'right' }}>
            {draft.toFixed(2)}
          </span>
        </div>
      </td>
      <td className="num">{share.toFixed(1)}%</td>
    </tr>
  )
}
