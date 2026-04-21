import type { Taxonomy } from './taxonomy'
import { candidateToolSchema } from './schema'

export const EXTRACTOR_TOOL_NAME = 'submit_candidate'

const BASE_INSTRUCTIONS = `You are the signal extractor for a tanker-equity trading analyst.
Your job: read one short piece of text (a news headline+body or a social post) and decide whether it is a tanker-relevant event, and if so, which one.

Core rules:
- Only pick an event class from the provided catalog. If none fits, return eventClassSlug: null.
- "Tanker-relevant" means the text plausibly moves crude- or product-tanker equities in the locked universe below. Generic energy news, broad market moves, or unrelated shipping (containers, dry bulk) are NOT tanker-relevant unless the text explicitly ties them to tanker rates or fleet.
- Be conservative. When in doubt, return null. False positives here become false alerts downstream.
- affectedTickers must only contain symbols from the locked universe. Include a symbol only if the text names it or clearly implicates its segment/geography.
- proposedFactorDeltas is OPTIONAL. Leave it [] to accept the event class defaults. Override only when the text gives a concrete reason that a specific factor should move by more or less than the default. Each override must cite that reason in 'reason'.
- sentiment is the net directional effect on tanker equities in the affected segment — NOT the tone of the article.
- overallConfidence reflects how sure you are of the classification overall (0 = guessing, 1 = unambiguous).
- excerpt must be a short quoted passage from the input that justifies the classification (≤300 chars).`

export function buildSystemPrompt(taxonomy: Taxonomy): string {
  const tickerLines = taxonomy.tickers
    .map((t) => `- ${t.symbol} (${t.segment}) — ${t.name}`)
    .join('\n')

  const factorLines = taxonomy.factors
    .map((f) => {
      const range = `[${f.rangeMin}, ${f.rangeMax}]`
      const desc = f.description ? ` — ${f.description}` : ''
      return `- ${f.slug} ${range}: ${f.name}${desc}`
    })
    .join('\n')

  const eventLines = taxonomy.eventClasses
    .map((c) => {
      const defaults =
        Object.entries(c.defaultFactorDeltas).length > 0
          ? ` default deltas: ${Object.entries(c.defaultFactorDeltas)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')}`
          : ''
      const desc = c.description ? ` — ${c.description}` : ''
      return `- ${c.slug}: ${c.name}${desc}${defaults}`
    })
    .join('\n')

  return `${BASE_INSTRUCTIONS}

LOCKED TICKER UNIVERSE (symbols you may use):
${tickerLines}

FACTOR TAXONOMY (slugs you may reference in proposedFactorDeltas):
${factorLines}

EVENT CLASSES (slugs you may use for eventClassSlug):
${eventLines}

Call the ${EXTRACTOR_TOOL_NAME} tool exactly once per input with your best structured answer.`
}

export function buildTool() {
  return {
    name: EXTRACTOR_TOOL_NAME,
    description:
      'Submit a structured tanker-equity event candidate for the input text.',
    input_schema: candidateToolSchema,
  }
}

/**
 * Format the per-item user message. Source metadata goes in a short header so
 * the model can disambiguate e.g. a Reuters headline from a tweet.
 */
export interface ExtractorInput {
  kind: 'news' | 'x' | 'manual'
  title?: string | null
  body: string
  sourceName?: string | null
  publishedAt?: Date | null
}

export function buildUserMessage(input: ExtractorInput): string {
  const lines: string[] = []
  lines.push(`[source: ${input.kind}${input.sourceName ? ` · ${input.sourceName}` : ''}]`)
  if (input.publishedAt) {
    lines.push(`[published: ${input.publishedAt.toISOString()}]`)
  }
  if (input.title) lines.push(`Title: ${input.title}`)
  lines.push('')
  lines.push(input.body.trim())
  return lines.join('\n')
}
