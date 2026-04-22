import { describe, expect, it } from 'vitest'
import {
  buildSystemPrompt,
  buildTool,
  buildUserMessage,
  EXTRACTOR_TOOL_NAME,
} from './prompt'
import type { Taxonomy } from './taxonomy'

const taxonomy: Taxonomy = {
  tickers: [
    { symbol: 'FRO', name: 'Frontline plc', segment: 'crude' },
    { symbol: 'STNG', name: 'Scorpio Tankers', segment: 'product' },
  ],
  factors: [
    {
      slug: 'vlcc_rate_momentum',
      name: 'VLCC rate momentum',
      description: null,
      rangeMin: -2,
      rangeMax: 2,
    },
  ],
  eventClasses: [
    {
      slug: 'red_sea_attack',
      name: 'Red Sea attack',
      description: 'Strike on tanker',
      defaultFactorDeltas: { vlcc_rate_momentum: 0.4 },
    },
  ],
}

describe('buildSystemPrompt', () => {
  it('includes every ticker, factor, and event class from the taxonomy', () => {
    const prompt = buildSystemPrompt(taxonomy)
    expect(prompt).toContain('FRO (crude) — Frontline plc')
    expect(prompt).toContain('STNG (product) — Scorpio Tankers')
    expect(prompt).toContain('vlcc_rate_momentum [-2, 2]: VLCC rate momentum')
    expect(prompt).toContain('red_sea_attack: Red Sea attack')
  })

  it('renders default factor deltas per event class', () => {
    const prompt = buildSystemPrompt(taxonomy)
    expect(prompt).toContain('default deltas: vlcc_rate_momentum=0.4')
  })

  it('tells the model to return null when not tanker-relevant', () => {
    const prompt = buildSystemPrompt(taxonomy)
    expect(prompt).toMatch(/return eventClassSlug: null/i)
  })

  it('names the tool it should call', () => {
    const prompt = buildSystemPrompt(taxonomy)
    expect(prompt).toContain(EXTRACTOR_TOOL_NAME)
  })
})

describe('buildTool', () => {
  it('shapes the tool with the expected name and schema', () => {
    const tool = buildTool()
    expect(tool.name).toBe(EXTRACTOR_TOOL_NAME)
    expect(tool.input_schema.required).toContain('eventClassSlug')
    expect(tool.input_schema.required).toContain('overallConfidence')
  })
})

describe('buildUserMessage', () => {
  it('prefixes a header with source kind and sourceName', () => {
    const msg = buildUserMessage({
      kind: 'news',
      title: 'Red Sea strike',
      body: 'A tanker was hit.',
      sourceName: 'Reuters',
      publishedAt: new Date('2026-04-19T10:00:00Z'),
    })
    expect(msg).toContain('[source: news · Reuters]')
    expect(msg).toContain('[published: 2026-04-19T10:00:00.000Z]')
    expect(msg).toContain('Title: Red Sea strike')
    expect(msg).toContain('A tanker was hit.')
  })

  it('omits optional lines when fields are missing', () => {
    const msg = buildUserMessage({ kind: 'manual', body: 'Hello' })
    expect(msg).toContain('[source: manual]')
    expect(msg).not.toContain('Title:')
    expect(msg).not.toContain('[published:')
  })
})
