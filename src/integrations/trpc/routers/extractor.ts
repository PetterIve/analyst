import { z } from 'zod'
import type { TRPCRouterRecord } from '@trpc/server'
import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'
import {
  extractSignalFromText,
  loadTaxonomy,
  buildSystemPrompt,
} from '#/lib/extractor'
import type { ExtractorModel } from '#/lib/anthropic.server'
import { runExtractor } from '#/server/ingest/extractor/run'
import { adminProcedure, publicProcedure } from '../init'

const EXTRACT_JOB = 'extract'

const MODELS = ['claude-sonnet-4-6', 'claude-opus-4-7'] as const
const modelSchema = z.enum(MODELS)

export const extractorRouter = {
  /**
   * Playground endpoint — runs the extractor over arbitrary text. Does NOT
   * persist an event_candidate row; just returns the candidate + usage so
   * the UI can render cost and cache-hit telemetry.
   */
  runOnText: adminProcedure
    .input(
      z.object({
        text: z.string().trim().min(1).max(8000),
        title: z.string().trim().max(500).optional(),
        model: modelSchema.default('claude-sonnet-4-6'),
        systemPromptOverride: z
          .string()
          .trim()
          .min(1)
          .max(50_000)
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const taxonomy = await loadTaxonomy()
      const result = await extractSignalFromText({
        taxonomy,
        input: {
          kind: 'manual',
          title: input.title,
          body: input.text,
        },
        model: input.model,
        systemPromptOverride: input.systemPromptOverride,
      })
      return {
        candidate: result.candidate,
        usage: result.usage,
        cost: result.cost,
        model: result.model,
      }
    }),

  /**
   * "Run now" button on /admin/extractor — mirrors the cron handler but
   * bypasses the shared-secret auth (tRPC adminProcedure already gates
   * access). Writes a CronRun row so admin observability stays consistent.
   */
  runBatch: adminProcedure
    .input(
      z.object({
        model: modelSchema.default('claude-sonnet-4-6'),
        limit: z.number().int().min(1).max(100).default(25),
        concurrency: z.number().int().min(1).max(16).default(4),
      }),
    )
    .mutation(async ({ input }) => {
      const startedAt = new Date()
      const run = await prisma.cronRun.create({
        data: { jobName: EXTRACT_JOB, startedAt, status: 'ok' },
      })
      logger.info(
        { job: EXTRACT_JOB, runId: run.id, trigger: 'admin' },
        'cron starting',
      )
      try {
        const result = await runExtractor({
          model: input.model,
          limit: input.limit,
          concurrency: input.concurrency,
          onItemEnd: (outcome) => {
            if (outcome.error) {
              logger.warn(
                {
                  job: EXTRACT_JOB,
                  runId: run.id,
                  sourceKind: outcome.sourceKind,
                  sourceRefId: outcome.sourceRefId,
                  err: outcome.error,
                },
                'extract item failed',
              )
            }
          },
        })
        await prisma.cronRun.update({
          where: { id: run.id },
          data: {
            finishedAt: result.finishedAt,
            status: result.errors > 0 ? 'error' : 'ok',
            errorMsg:
              result.errors > 0
                ? `${result.errors}/${result.itemsProcessed} items failed`
                : null,
            metrics: {
              model: result.model,
              itemsProcessed: result.itemsProcessed,
              candidatesWritten: result.candidatesWritten,
              errors: result.errors,
              usage: { ...result.usage },
              costUsd: Number(result.cost.total.toFixed(6)),
            } as object,
          },
        })
        return {
          itemsProcessed: result.itemsProcessed,
          candidatesWritten: result.candidatesWritten,
          errors: result.errors,
          costUsd: result.cost.total,
          cacheReadTokens: result.usage.cacheReadInputTokens,
          cacheWriteTokens: result.usage.cacheCreationInputTokens,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await prisma.cronRun.update({
          where: { id: run.id },
          data: { finishedAt: new Date(), status: 'error', errorMsg: message },
        })
        throw err
      }
    }),

  /**
   * Returns the current rendered system prompt + sizes so /admin/prompt can
   * show what we're actually sending the model. Purely informational.
   */
  previewPrompt: publicProcedure.query(async () => {
    const taxonomy = await loadTaxonomy()
    const prompt = buildSystemPrompt(taxonomy)
    return {
      prompt,
      characterCount: prompt.length,
      approxTokens: Math.ceil(prompt.length / 4),
      tickerCount: taxonomy.tickers.length,
      factorCount: taxonomy.factors.length,
      eventClassCount: taxonomy.eventClasses.length,
    }
  }),

  /**
   * Counts for the /admin/extractor dashboard — how many items are still
   * unprocessed and how many recent candidates we've written.
   */
  queueStatus: publicProcedure.query(async () => {
    const [unprocessedNews, unprocessedX, totalCandidates, last24h] =
      await Promise.all([
        prisma.newsItem.count({ where: { processedAt: null } }),
        prisma.xPost.count({ where: { processedAt: null } }),
        prisma.eventCandidate.count(),
        prisma.eventCandidate.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        }),
      ])
    return {
      unprocessedNews,
      unprocessedX,
      totalCandidates,
      candidatesLast24h: last24h,
    }
  }),

  availableModels: publicProcedure.query(() => {
    return [...MODELS] as ExtractorModel[]
  }),
} satisfies TRPCRouterRecord
