import { describe, expect, it } from 'vitest'
import { costOf, sumUsage } from './pricing'

describe('costOf', () => {
  it('prices Sonnet 4.6 at $3/MTok input and $15/MTok output', () => {
    const cost = costOf('claude-sonnet-4-6', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    })
    expect(cost.input).toBeCloseTo(3, 6)
    expect(cost.output).toBeCloseTo(15, 6)
    expect(cost.total).toBeCloseTo(18, 6)
  })

  it('prices cache reads at ~0.1× input', () => {
    const cost = costOf('claude-sonnet-4-6', {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 1_000_000,
    })
    expect(cost.cacheRead).toBeCloseTo(0.3, 6)
  })

  it('Opus is 5x Sonnet on input', () => {
    const sonnet = costOf('claude-sonnet-4-6', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    })
    const opus = costOf('claude-opus-4-7', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    })
    expect(opus.input).toBeCloseTo(sonnet.input * 5, 6)
  })
})

describe('sumUsage', () => {
  it('sums all four token fields element-wise', () => {
    const total = sumUsage([
      {
        inputTokens: 10,
        outputTokens: 5,
        cacheCreationInputTokens: 2,
        cacheReadInputTokens: 1,
      },
      {
        inputTokens: 20,
        outputTokens: 15,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 4,
      },
    ])
    expect(total).toEqual({
      inputTokens: 30,
      outputTokens: 20,
      cacheCreationInputTokens: 2,
      cacheReadInputTokens: 5,
    })
  })

  it('returns all-zero for empty input', () => {
    expect(sumUsage([])).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    })
  })
})
