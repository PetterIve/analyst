import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { createStart } from '@tanstack/react-start'

// clerkMiddleware() throws if CLERK_SECRET_KEY is missing, so only wire it when
// Clerk is configured. Without it, `auth()` in the tRPC context returns
// "not configured" and `adminProcedure` falls back to its dev-bypass path.
const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY)

export const startInstance = createStart(() => {
  return {
    requestMiddleware: clerkConfigured ? [clerkMiddleware()] : [],
  }
})
