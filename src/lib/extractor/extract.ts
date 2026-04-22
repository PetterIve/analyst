import {
  DEFAULT_EXTRACTOR_MODEL,
  getAnthropic,
  type ExtractorModel,
} from '#/lib/anthropic.server'
import { costOf, type CostBreakdown, type TokenUsage } from './pricing'
import { eventCandidateSchema, type EventCandidate } from './schema'
import {
  buildSystemPrompt,
  buildTool,
  buildUserMessage,
  EXTRACTOR_TOOL_NAME,
  type ExtractorInput,
} from './prompt'
import type { Taxonomy } from './taxonomy'

export interface ExtractResult {
  candidate: EventCandidate
  usage: TokenUsage
  cost: CostBreakdown
  model: ExtractorModel
  rawJson: unknown
}

export interface ExtractOptions {
  taxonomy: Taxonomy
  input: ExtractorInput
  model?: ExtractorModel
  maxTokens?: number
  /**
   * Skip the taxonomy-based system prompt and use this text instead. The
   * caller is responsible for including the ticker/factor/event-class context
   * the model needs. Used by the playground so analysts can iterate on the
   * prompt without touching production defaults.
   */
  systemPromptOverride?: string
}

/**
 * Run the LLM extractor against a single text item. Throws if the model
 * response is malformed (no tool use, unexpected tool name, or Zod-invalid
 * shape) so the caller can surface the error. On success returns the
 * validated candidate plus usage / cost telemetry.
 */
export async function extractSignalFromText(
  opts: ExtractOptions,
): Promise<ExtractResult> {
  const model = opts.model ?? DEFAULT_EXTRACTOR_MODEL
  const anthropic = getAnthropic()
  const system =
    opts.systemPromptOverride?.trim() ?? buildSystemPrompt(opts.taxonomy)
  const tool = buildTool()
  const userMessage = buildUserMessage(opts.input)

  const response = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [tool],
    tool_choice: { type: 'tool', name: EXTRACTOR_TOOL_NAME },
    messages: [{ role: 'user', content: userMessage }],
  })

  const toolUse = response.content.find(
    (block): block is typeof block & { type: 'tool_use' } =>
      block.type === 'tool_use' && block.name === EXTRACTOR_TOOL_NAME,
  )
  if (!toolUse) {
    throw new ExtractorMalformedError(
      `Model did not call ${EXTRACTOR_TOOL_NAME} — response had blocks: ${response.content
        .map((b) => b.type)
        .join(', ')}`,
    )
  }

  const parsed = eventCandidateSchema.safeParse(toolUse.input)
  if (!parsed.success) {
    throw new ExtractorMalformedError(
      `Tool output failed schema validation: ${parsed.error.message}`,
      toolUse.input,
    )
  }

  const usage: TokenUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
  }

  return {
    candidate: parsed.data,
    usage,
    cost: costOf(model, usage),
    model,
    rawJson: toolUse.input,
  }
}

export class ExtractorMalformedError extends Error {
  readonly raw: unknown
  constructor(message: string, raw: unknown = null) {
    super(message)
    this.name = 'ExtractorMalformedError'
    this.raw = raw
  }
}
