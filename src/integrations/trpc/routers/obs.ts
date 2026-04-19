import type { TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '#/server/db'
import { adminProcedure } from '../init'

// Jobs the health page surfaces a card for, even when they've never run.
// New crons should append themselves here so the dashboard always has a row.
const KNOWN_JOBS = ['ingest-news', 'ingest-prices'] as const

interface JobSummary {
  jobName: string
  lastRunAt: Date | null
  lastFinishedAt: Date | null
  lastStatus: 'ok' | 'error' | null
  lastErrorMsg: string | null
  lastRunId: number | null
  durationMs: number | null
  successesLast24h: number
  failuresLast24h: number
}

export const obsRouter = {
  health: adminProcedure.query(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Pull every job slug we've ever seen so old/retired jobs still show up
    // alongside the curated KNOWN_JOBS list.
    const seenJobs = await prisma.cronRun.findMany({
      distinct: ['jobName'],
      select: { jobName: true },
    })
    const jobs = Array.from(
      new Set([...KNOWN_JOBS, ...seenJobs.map((j) => j.jobName)]),
    )

    const summaries: JobSummary[] = await Promise.all(
      jobs.map(async (jobName) => {
        const last = await prisma.cronRun.findFirst({
          where: { jobName },
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            startedAt: true,
            finishedAt: true,
            status: true,
            errorMsg: true,
          },
        })
        const [successesLast24h, failuresLast24h] = await Promise.all([
          prisma.cronRun.count({
            where: { jobName, startedAt: { gte: since24h }, status: 'ok' },
          }),
          prisma.cronRun.count({
            where: { jobName, startedAt: { gte: since24h }, status: 'error' },
          }),
        ])
        return {
          jobName,
          lastRunAt: last?.startedAt ?? null,
          lastFinishedAt: last?.finishedAt ?? null,
          lastStatus: last?.status ?? null,
          lastErrorMsg: last?.errorMsg ?? null,
          lastRunId: last?.id ?? null,
          durationMs:
            last?.startedAt && last.finishedAt
              ? last.finishedAt.getTime() - last.startedAt.getTime()
              : null,
          successesLast24h,
          failuresLast24h,
        }
      }),
    )

    const recentErrors = await prisma.cronRun.findMany({
      where: { status: 'error', startedAt: { gte: since24h } },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        jobName: true,
        startedAt: true,
        finishedAt: true,
        errorMsg: true,
      },
    })

    // Alert delivery — `Alert.deliveredAt` is set by the composer on send.
    // Until T11 ships, every count returns 0 and the cards render as "—".
    const [delivered24h, delivered7d, pending, held] = await Promise.all([
      prisma.alert.count({ where: { deliveredAt: { gte: since24h } } }),
      prisma.alert.count({ where: { deliveredAt: { gte: since7d } } }),
      prisma.alert.count({ where: { state: 'pending' } }),
      prisma.alert.count({ where: { state: 'held' } }),
    ])

    return {
      jobs: summaries.sort((a, b) => a.jobName.localeCompare(b.jobName)),
      recentErrors,
      alerts: { delivered24h, delivered7d, pending, held },
      telegramErrorChannelConfigured: Boolean(
        process.env.TELEGRAM_ERROR_CHAT_ID,
      ),
    }
  }),

  recentRuns: adminProcedure
    .input(
      z.object({
        jobName: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const runs = await prisma.cronRun.findMany({
        where: { jobName: input.jobName },
        orderBy: { startedAt: 'desc' },
        take: input.limit,
        select: {
          id: true,
          startedAt: true,
          finishedAt: true,
          status: true,
          errorMsg: true,
          metrics: true,
        },
      })
      return runs
    }),
} satisfies TRPCRouterRecord
