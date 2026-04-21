import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '#/integrations/trpc/react'
import type { ExtractorModel } from '#/lib/anthropic.server'

const PROMPT_STORAGE_KEY = 'analyst.extractor.systemPromptOverride'

export const Route = createFileRoute('/admin/extractor')({
  component: ExtractorPage,
})

const MODELS: ReadonlyArray<{ id: ExtractorModel; label: string }> = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7' },
]

type PlaygroundResult = {
  candidate: {
    eventClassSlug: string | null
    affectedTickers: { symbol: string; confidence: number }[]
    sentiment: 'bullish' | 'bearish' | 'neutral'
    proposedFactorDeltas: { factorSlug: string; delta: number; reason: string }[]
    overallConfidence: number
    excerpt: string
  }
  usage: {
    inputTokens: number
    outputTokens: number
    cacheCreationInputTokens: number
    cacheReadInputTokens: number
  }
  cost: {
    input: number
    output: number
    cacheWrite: number
    cacheRead: number
    total: number
  }
  model: ExtractorModel
}

function ExtractorPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [model, setModel] = useState<ExtractorModel>('claude-sonnet-4-6')
  const [result, setResult] = useState<PlaygroundResult | null>(null)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [promptOverride, setPromptOverride] = useState<string | null>(null)
  const [promptHydrated, setPromptHydrated] = useState(false)

  const { data: queue } = useQuery(
    trpc.extractor.queueStatus.queryOptions(undefined, {
      refetchInterval: 15_000,
    }),
  )

  const { data: defaultPrompt } = useQuery(
    trpc.extractor.previewPrompt.queryOptions(),
  )

  // Load any saved override once on mount. We only honor it after hydration
  // so SSR + first paint stay deterministic.
  useEffect(() => {
    if (promptHydrated) return
    try {
      const saved = window.localStorage.getItem(PROMPT_STORAGE_KEY)
      if (saved !== null) setPromptOverride(saved)
    } catch {
      // localStorage may be blocked (privacy mode) — silently fall back.
    }
    setPromptHydrated(true)
  }, [promptHydrated])

  // Persist edits so they survive reloads. null => "use default".
  useEffect(() => {
    if (!promptHydrated) return
    try {
      if (promptOverride === null) {
        window.localStorage.removeItem(PROMPT_STORAGE_KEY)
      } else {
        window.localStorage.setItem(PROMPT_STORAGE_KEY, promptOverride)
      }
    } catch {
      // ignore
    }
  }, [promptOverride, promptHydrated])

  const effectivePrompt =
    promptOverride !== null ? promptOverride : (defaultPrompt?.prompt ?? '')
  const promptDirty =
    promptOverride !== null &&
    defaultPrompt !== undefined &&
    promptOverride.trim() !== defaultPrompt.prompt.trim()

  const runOnText = useMutation(
    trpc.extractor.runOnText.mutationOptions({
      onSuccess: (r) => setResult(r as PlaygroundResult),
      onError: (e) => toast.error(`Extract failed: ${e.message}`),
    }),
  )

  const runBatch = useMutation(
    trpc.extractor.runBatch.mutationOptions({
      onSuccess: (r) => {
        queryClient.invalidateQueries({
          queryKey: trpc.extractor.queueStatus.queryKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.candidate.list.queryKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.newsItem.list.queryKey(),
        })
        toast.success(
          `Extracted ${r.itemsProcessed} items, wrote ${r.candidatesWritten} candidates (${r.errors} errors, $${r.costUsd.toFixed(4)})`,
        )
      },
      onError: (e) => toast.error(`Batch failed: ${e.message}`),
    }),
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ADMIN / EXTRACTOR
          </div>
          <h1 className="page-title">Signal extractor</h1>
          <div className="page-sub">
            LLM playground + batch runner. System prompt is prompt-cached so
            repeated calls read the taxonomy from cache.
          </div>
        </div>
        <div className="row-d" style={{ gap: 8 }}>
          <span className="pill">
            {queue?.unprocessedNews ?? '—'} news pending
          </span>
          <span className="pill">{queue?.unprocessedX ?? '—'} x pending</span>
          <span className="pill">
            {queue?.candidatesLast24h ?? '—'} candidates/24h
          </span>
          <button
            className="btn accent"
            type="button"
            disabled={runBatch.isPending}
            onClick={() => runBatch.mutate({ model, limit: 25 })}
          >
            {runBatch.isPending ? 'Running…' : 'Run batch (25)'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">System prompt</span>
          <div className="spacer" />
          {promptDirty ? (
            <span
              className="pill"
              style={{ color: 'var(--neg)', marginRight: 8 }}
              title="Edited prompt — won't hit the shared prompt cache until text matches the default again"
            >
              edited · cache miss likely
            </span>
          ) : (
            <span className="pill" style={{ marginRight: 8 }}>
              default
            </span>
          )}
          <button
            className="btn"
            type="button"
            onClick={() => setPromptExpanded((v) => !v)}
          >
            {promptExpanded ? 'Hide' : 'Edit'}
          </button>
        </div>
        {promptExpanded ? (
          <div
            style={{
              padding: 'var(--pad-3)',
              display: 'grid',
              gap: 'var(--pad-2)',
            }}
          >
            <div className="label-xs muted">
              Edits stay in your browser (localStorage). The cron + batch
              runner always use the default built from the taxonomy —
              overrides here only affect the Extract button below.
            </div>
            <textarea
              className="input-d"
              value={effectivePrompt}
              onChange={(e) => setPromptOverride(e.target.value)}
              rows={18}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
              spellCheck={false}
            />
            <div className="row-d">
              <button
                className="btn"
                type="button"
                disabled={!promptDirty}
                onClick={() => setPromptOverride(null)}
              >
                Reset to default
              </button>
              <span className="label-xs muted" style={{ marginLeft: 12 }}>
                {effectivePrompt.length.toLocaleString()} chars · ~
                {Math.ceil(effectivePrompt.length / 4).toLocaleString()} tok
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card mt-6">
        <div className="card-head">
          <span className="title">Playground</span>
          <div className="spacer" />
          <select
            className="input-d"
            value={model}
            onChange={(e) => setModel(e.target.value as ExtractorModel)}
            style={{ width: 180 }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div
          style={{
            padding: 'var(--pad-3)',
            display: 'grid',
            gap: 'var(--pad-2)',
          }}
        >
          <input
            className="input-d"
            placeholder="Optional title (e.g. Reuters headline)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input-d"
            placeholder="Paste a news excerpt or tweet to classify…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
          <div className="row-d">
            <button
              className="btn accent"
              type="button"
              disabled={runOnText.isPending || text.trim().length === 0}
              onClick={() =>
                runOnText.mutate({
                  text,
                  title: title.trim() || undefined,
                  model,
                  systemPromptOverride: promptDirty
                    ? effectivePrompt
                    : undefined,
                })
              }
            >
              {runOnText.isPending ? 'Extracting…' : 'Extract'}
            </button>
            <span className="label-xs muted" style={{ marginLeft: 12 }}>
              {text.length} chars
            </span>
          </div>
        </div>
      </div>

      {result ? <PlaygroundResultCard result={result} /> : null}
    </div>
  )
}

function PlaygroundResultCard({ result }: { result: PlaygroundResult }) {
  const cacheRead = result.usage.cacheReadInputTokens
  const cacheWrite = result.usage.cacheCreationInputTokens
  const cacheStatus =
    cacheRead > 0
      ? `cache HIT · ${cacheRead.toLocaleString()} tok`
      : cacheWrite > 0
        ? `cache MISS (wrote ${cacheWrite.toLocaleString()} tok)`
        : 'no cache activity'

  return (
    <div className="card">
      <div className="card-head">
        <span className="title">Result</span>
        <div className="spacer" />
        <span className="label-xs mono">{result.model}</span>
      </div>
      <div
        style={{
          padding: 'var(--pad-3)',
          display: 'grid',
          gap: 'var(--pad-3)',
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        <div>
          <div className="label-xs" style={{ marginBottom: 4 }}>
            CLASSIFICATION
          </div>
          <KV
            label="event class"
            value={result.candidate.eventClassSlug ?? '— none (not tanker-relevant)'}
          />
          <KV label="sentiment" value={result.candidate.sentiment} />
          <KV
            label="confidence"
            value={result.candidate.overallConfidence.toFixed(2)}
          />
          <KV
            label="tickers"
            value={
              result.candidate.affectedTickers.length === 0
                ? '—'
                : result.candidate.affectedTickers
                    .map(
                      (t) => `${t.symbol} (${(t.confidence * 100).toFixed(0)}%)`,
                    )
                    .join(', ')
            }
          />
          <KV
            label="excerpt"
            value={result.candidate.excerpt}
            mono={false}
          />
          {result.candidate.proposedFactorDeltas.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <div className="label-xs" style={{ marginBottom: 4 }}>
                FACTOR OVERRIDES
              </div>
              {result.candidate.proposedFactorDeltas.map((d, i) => (
                <div
                  key={i}
                  className="mono"
                  style={{ fontSize: 12, color: 'var(--fg-2)' }}
                >
                  {d.factorSlug} Δ{d.delta >= 0 ? '+' : ''}
                  {d.delta.toFixed(2)} — {d.reason}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <div className="label-xs" style={{ marginBottom: 4 }}>
            USAGE
          </div>
          <KV
            label="input tokens"
            value={result.usage.inputTokens.toLocaleString()}
          />
          <KV
            label="output tokens"
            value={result.usage.outputTokens.toLocaleString()}
          />
          <KV label="cache" value={cacheStatus} />
          <KV label="cost (USD)" value={`$${result.cost.total.toFixed(6)}`} />
          <div style={{ marginTop: 12 }}>
            <div className="label-xs" style={{ marginBottom: 4 }}>
              RAW JSON
            </div>
            <pre
              className="mono"
              style={{
                fontSize: 11,
                maxHeight: 260,
                overflow: 'auto',
                background: 'var(--bg-2)',
                padding: 8,
                borderRadius: 4,
              }}
            >
              {JSON.stringify(result.candidate, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

function KV({
  label,
  value,
  mono = true,
}: {
  label: string
  value: string | number
  mono?: boolean
}) {
  return (
    <div
      className="row-d"
      style={{
        justifyContent: 'space-between',
        padding: '4px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span className="label-xs muted">{label}</span>
      <span
        className={mono ? 'mono' : undefined}
        style={{
          fontSize: 12,
          textAlign: 'right',
          maxWidth: '70%',
          whiteSpace: mono ? 'nowrap' : 'normal',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </span>
    </div>
  )
}
