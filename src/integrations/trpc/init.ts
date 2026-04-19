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
 * is in the `ADMIN_EMAILS` whitelist and has `email_verified: true`.
 *
 * The gate is fail-closed everywhere unless `ADMIN_AUTH_BYPASS=true` is set
 * — intentionally not keyed on `NODE_ENV` so staging / preview deploys
 * that don't mark themselves as production don't accidentally go open.
 * Set the bypass only in local `.env.local`, never in shared/remote envs.
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  const bypass = process.env.ADMIN_AUTH_BYPASS === 'true'

  if (!ctx.clerkConfigured) {
    if (bypass) return next()
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Clerk is not configured on the server.',
    })
  }

  const whitelist = parseAdminEmails()
  if (whitelist.length === 0) {
    if (bypass) return next()
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'ADMIN_EMAILS whitelist is empty.',
    })
  }

  const email = ctx.userEmail?.toLowerCase() ?? null
  if (!email || !whitelist.includes(email)) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authorized for admin mutations.',
    })
  }
  if (!ctx.userEmailVerified) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Email not verified.',
    })
  }
  return next()
})
