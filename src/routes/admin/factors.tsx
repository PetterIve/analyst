import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'
import { Input } from '#/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export const Route = createFileRoute('/admin/factors')({
  component: FactorsPage,
})

function FactorsPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: factors, isLoading } = useQuery(
    trpc.factor.list.queryOptions(),
  )

  const updateMutation = useMutation(
    trpc.factor.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.factor.list.queryKey(),
        })
        toast.success('Weight saved')
      },
      onError: (error) => {
        toast.error(`Update failed: ${error.message}`)
      },
    }),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Factors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Composite-score weights. Edit weight inline — used by the alert
          engine (T09) as <code>Σ(factor_value × weight)</code>. See{' '}
          <code>docs/factors.md</code> for the full taxonomy.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Slug</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-24 text-right">Range</TableHead>
                <TableHead className="w-20 text-right">Default</TableHead>
                <TableHead className="w-28 text-right">Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factors?.map((f) => (
                <FactorRow
                  key={f.id}
                  factor={f}
                  onUpdate={(weight) =>
                    updateMutation.mutate({ id: f.id, weight })
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

interface FactorRowProps {
  factor: {
    id: number
    slug: string
    name: string
    description: string | null
    rangeMin: number
    rangeMax: number
    defaultValue: number
    weight: number
  }
  onUpdate: (weight: number) => void
}

function FactorRow({ factor, onUpdate }: FactorRowProps) {
  const [draft, setDraft] = useState(String(factor.weight))

  const commit = () => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed) && parsed !== factor.weight) {
      onUpdate(parsed)
    } else {
      setDraft(String(factor.weight))
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {factor.slug}
      </TableCell>
      <TableCell>
        <div className="font-medium">{factor.name}</div>
        {factor.description ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {factor.description}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {factor.rangeMin} … {factor.rangeMax}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {factor.defaultValue}
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="0.1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setDraft(String(factor.weight))
          }}
          className="h-8 w-24 text-right font-mono"
        />
      </TableCell>
    </TableRow>
  )
}
