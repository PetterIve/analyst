import type { ExtractorModel } from '#/lib/anthropic.server'

interface ModelPricing {
  inputPerMTok: number
  outputPerMTok: number
  cacheWritePerMTok: number
  cacheReadPerMTok: number
}

// Prices in USD per million tokens. Cache-write is typically 1.25× input,
// cache-read is typically 0.1× input. Kept explicit so changes are obvious.
const PRICING: Record<ExtractorModel, ModelPricing> = {
  'claude-sonnet-4-6': {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.3,
  },
  'claude-opus-4-7': {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheWritePerMTok: 18.75,
    cacheReadPerMTok: 1.5,
  },
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
}

export interface CostBreakdown {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
  total: number
}

export function costOf(model: ExtractorModel, usage: TokenUsage): CostBreakdown {
  const p = PRICING[model]
  const input = (usage.inputTokens * p.inputPerMTok) / 1_000_000
  const output = (usage.outputTokens * p.outputPerMTok) / 1_000_000
  const cacheWrite =
    (usage.cacheCreationInputTokens * p.cacheWritePerMTok) / 1_000_000
  const cacheRead =
    (usage.cacheReadInputTokens * p.cacheReadPerMTok) / 1_000_000
  return {
    input,
    output,
    cacheWrite,
    cacheRead,
    total: input + output + cacheWrite + cacheRead,
  }
}

export function sumUsage(usages: ReadonlyArray<TokenUsage>): TokenUsage {
  return usages.reduce<TokenUsage>(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      cacheCreationInputTokens:
        acc.cacheCreationInputTokens + u.cacheCreationInputTokens,
      cacheReadInputTokens: acc.cacheReadInputTokens + u.cacheReadInputTokens,
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
  )
}
