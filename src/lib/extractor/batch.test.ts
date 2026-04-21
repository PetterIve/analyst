import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractBatch } from './batch'
import type { Taxonomy } from './taxonomy'

// Lightweight stub taxonomy — batch.ts does not read it, only passes it through.
const taxonomy: Taxonomy = { tickers: [], factors: [], eventClasses: [] }

function stubResult(slug: string | null, confidence = 0.7) {
  return {
    candidate: {
      eventClassSlug: slug,
      affectedTickers: [],
      sentiment: 'neutral' as const,
      proposedFactorDeltas: [],
      overallConfidence: confidence,
      excerpt: 'stub',
    },
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 50,
    },
    cost: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, total: 0 },
    model: 'claude-sonnet-4-6' as const,
    rawJson: {},
  }
}

// Mock the single-item extractor — the batch runner is the unit under test.
vi.mock('./extract', async () => {
  return {
    extractSignalFromText: vi.fn(),
    ExtractorMalformedError: class ExtractorMalformedError extends Error {
      readonly raw: unknown
      constructor(message: string, raw: unknown = null) {
        super(message)
        this.name = 'ExtractorMalformedError'
        this.raw = raw
      }
    },
  }
})

import { extractSignalFromText, ExtractorMalformedError } from './extract'
const mock = vi.mocked(extractSignalFromText)

afterEach(() => mock.mockReset())

describe('extractBatch', () => {
  it('runs all items and sums usage on full success', async () => {
    mock.mockImplementation(async () => stubResult('red_sea_attack'))
    const items = [1, 2, 3].map((k) => ({
      key: k,
      input: { kind: 'news' as const, body: `text ${k}` },
    }))
    const out = await extractBatch({ taxonomy, items, concurrency: 2 })
    expect(out.successCount).toBe(3)
    expect(out.errorCount).toBe(0)
    expect(out.totalUsage.inputTokens).toBe(300)
    expect(out.totalUsage.cacheReadInputTokens).toBe(150)
  })

  it('continues past individual item errors and tags error kinds', async () => {
    mock
      .mockImplementationOnce(async () => stubResult('red_sea_attack'))
      .mockImplementationOnce(async () => {
        throw new ExtractorMalformedError('bad tool call')
      })
      .mockImplementationOnce(async () => {
        throw new Error('network down')
      })
      .mockImplementationOnce(async () => stubResult(null))
    const items = [1, 2, 3, 4].map((k) => ({
      key: k,
      input: { kind: 'news' as const, body: `t${k}` },
    }))
    const out = await extractBatch({ taxonomy, items, concurrency: 1 })
    expect(out.successCount).toBe(2)
    expect(out.errorCount).toBe(2)
    expect(out.outcomes[1].errorKind).toBe('malformed')
    expect(out.outcomes[1].error).toContain('malformed: bad tool call')
    expect(out.outcomes[2].errorKind).toBe('transient')
    expect(out.outcomes[2].error).toBe('network down')
  })

  it('invokes the onItemEnd hook exactly once per item', async () => {
    mock.mockImplementation(async () => stubResult(null))
    const seen: number[] = []
    const items = [10, 20, 30].map((k) => ({
      key: k,
      input: { kind: 'news' as const, body: 't' },
    }))
    await extractBatch({
      taxonomy,
      items,
      concurrency: 3,
      onItemEnd: (o) => seen.push(o.key),
    })
    expect(seen.sort()).toEqual([10, 20, 30])
  })
})
