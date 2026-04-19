import { TRPCError, initTRPC } from '@trpc/server'
import superjson from 'superjson'
import type { TRPCContext } from './context'

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

function parseAdminEmails(): ReadonlyArray<string> {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Admin-only procedure. Requires a signed-in Clerk user whose primary email
 * is in the `ADMIN_EMAILS` whitelist (comma-separated).
 *
 * Non-production with Clerk not configured: bypassed (dev convenience).
 * Production with Clerk not configured OR ADMIN_EMAILS unset: fails closed.
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  const isProd = process.env.NODE_ENV === 'production'

  if (!ctx.clerkConfigured) {
    if (isProd) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Clerk is not configured on the server.',
      })
    }
    return next()
  }

  const whitelist = parseAdminEmails()
  if (whitelist.length === 0) {
    if (isProd) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'ADMIN_EMAILS whitelist is empty.',
      })
    }
    return next()
  }

  const email = ctx.userEmail?.toLowerCase() ?? null
  if (!email || !whitelist.includes(email)) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  if (!ctx.userEmailVerified) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Email not verified.',
    })
  }
  return next()
})
