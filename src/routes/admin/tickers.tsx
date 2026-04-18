import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'
import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export const Route = createFileRoute('/admin/tickers')({
  component: TickersPage,
})

function TickersPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: tickers, isLoading } = useQuery(trpc.ticker.list.queryOptions())

  const updateMutation = useMutation(
    trpc.ticker.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.ticker.list.queryKey(),
        })
      },
      onError: (error) => {
        toast.error(`Update failed: ${error.message}`)
      },
    }),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tickers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tanker universe. Toggle <code>active</code> to include/exclude from
          ingestion and alerts. Edit name inline.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Symbol</TableHead>
                <TableHead className="w-28">Exchange</TableHead>
                <TableHead className="w-28">Segment</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-24 text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickers?.map((t) => (
                <TickerRow
                  key={t.id}
                  ticker={t}
                  onUpdate={(patch) =>
                    updateMutation.mutate({ id: t.id, ...patch })
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

interface TickerRowProps {
  ticker: {
    id: number
    symbol: string
    exchange: string
    segment: string
    name: string
    active: boolean
  }
  onUpdate: (patch: { name?: string; active?: boolean }) => void
}

function TickerRow({ ticker, onUpdate }: TickerRowProps) {
  const [draftName, setDraftName] = useState(ticker.name)

  const commitName = () => {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== ticker.name) {
      onUpdate({ name: trimmed })
    } else {
      setDraftName(ticker.name)
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono font-semibold">{ticker.symbol}</TableCell>
      <TableCell className="text-muted-foreground">{ticker.exchange}</TableCell>
      <TableCell>
        <span className="rounded border px-2 py-0.5 text-xs uppercase tracking-wide">
          {ticker.segment}
        </span>
      </TableCell>
      <TableCell>
        <Input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setDraftName(ticker.name)
          }}
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-right">
        <Switch
          checked={ticker.active}
          onCheckedChange={(checked) => onUpdate({ active: checked })}
        />
      </TableCell>
    </TableRow>
  )
}
