import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (client) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local to run the LLM extractor.',
    )
  }
  client = new Anthropic({ apiKey })
  return client
}

export type ExtractorModel = 'claude-sonnet-4-6' | 'claude-opus-4-7'

export const DEFAULT_EXTRACTOR_MODEL: ExtractorModel = 'claude-sonnet-4-6'
