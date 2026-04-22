import type { ExtractorModel } from '#/lib/anthropic.server'
import {
  extractSignalFromText,
  ExtractorMalformedError,
  type ExtractResult,
} from './extract'
import type { ExtractorInput } from './prompt'
import { sumUsage, type TokenUsage } from './pricing'
import type { Taxonomy } from './taxonomy'

export interface BatchItem<T> {
  key: T
  input: ExtractorInput
}

export type ErrorKind = 'malformed' | 'transient'

export interface BatchItemOutcome<T> {
  key: T
  result: ExtractResult | null
  error: string | null
  /**
   * `malformed` = the model produced an unparseable tool call — the input is
   *   the problem, so the source should be marked processed (retrying would
   *   burn tokens on the same bad input).
   * `transient` = network / auth / rate-limit / anything else — the caller
   *   should NOT mark the source processed so the next cron can retry.
   */
  errorKind: ErrorKind | null
}

export interface BatchResult<T> {
  outcomes: Array<BatchItemOutcome<T>>
  totalUsage: TokenUsage
  successCount: number
  errorCount: number
}

export interface BatchOptions<T> {
  taxonomy: Taxonomy
  items: ReadonlyArray<BatchItem<T>>
  model?: ExtractorModel
  concurrency?: number
  onItemEnd?: (outcome: BatchItemOutcome<T>) => void
}

/**
 * Run the extractor over a batch with a bounded concurrency window.
 * Individual failures do NOT abort the batch — they are returned in the
 * outcomes array so callers can still mark successful items processed.
 */
export async function extractBatch<T>(
  opts: BatchOptions<T>,
): Promise<BatchResult<T>> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 16))
  const outcomes: Array<BatchItemOutcome<T>> = []
  let cursor = 0

  async function worker() {
    while (cursor < opts.items.length) {
      const index = cursor++
      const item = opts.items[index]
      try {
        const result = await extractSignalFromText({
          taxonomy: opts.taxonomy,
          input: item.input,
          model: opts.model,
        })
        const outcome: BatchItemOutcome<T> = {
          key: item.key,
          result,
          error: null,
          errorKind: null,
        }
        outcomes[index] = outcome
        opts.onItemEnd?.(outcome)
      } catch (err) {
        const isMalformed = err instanceof ExtractorMalformedError
        const message =
          err instanceof Error ? err.message : String(err)
        const outcome: BatchItemOutcome<T> = {
          key: item.key,
          result: null,
          error: isMalformed ? `malformed: ${message}` : message,
          errorKind: isMalformed ? 'malformed' : 'transient',
        }
        outcomes[index] = outcome
        opts.onItemEnd?.(outcome)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, opts.items.length) }, () =>
      worker(),
    ),
  )

  const successfulUsages = outcomes
    .filter((o): o is BatchItemOutcome<T> & { result: ExtractResult } =>
      Boolean(o.result),
    )
    .map((o) => o.result.usage)

  return {
    outcomes,
    totalUsage: sumUsage(successfulUsages),
    successCount: successfulUsages.length,
    errorCount: outcomes.length - successfulUsages.length,
  }
}
