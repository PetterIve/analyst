import { auth, clerkClient } from '@clerk/tanstack-react-start/server'

// Expected shape when the Clerk Dashboard's "Customize session token" adds
// `{ "email": "{{user.primary_email_address}}",
//     "email_verified": "{{user.email_verified}}" }`. Makes both available in
// sessionClaims so we don't hit the Clerk API on every admin call — and so
// we can require verification server-side.
interface SessionClaimsWithEmail {
  email?: string
  email_verified?: boolean
}

export async function createTRPCContext() {
  const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY)
  if (!clerkConfigured) {
    return {
      userId: null,
      userEmail: null,
      userEmailVerified: false,
      clerkConfigured: false as const,
    }
  }

  let state: Awaited<ReturnType<typeof auth>>
  try {
    state = await auth()
  } catch {
    return {
      userId: null,
      userEmail: null,
      userEmailVerified: false,
      clerkConfigured: true as const,
    }
  }

  if (!state.isAuthenticated || !state.userId) {
    return {
      userId: null,
      userEmail: null,
      userEmailVerified: false,
      clerkConfigured: true as const,
    }
  }

  const claims = state.sessionClaims as SessionClaimsWithEmail | null
  if (claims?.email) {
    return {
      userId: state.userId,
      userEmail: claims.email,
      userEmailVerified: Boolean(claims.email_verified),
      clerkConfigured: true as const,
    }
  }

  // Fallback: dashboard hasn't been configured to include the claims. One
  // Clerk API call per admin request until the operator sets it up.
  try {
    const user = await clerkClient().users.getUser(state.userId)
    const primary = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    ) ?? user.emailAddresses[0] ?? null
    return {
      userId: state.userId,
      userEmail: primary?.emailAddress ?? null,
      userEmailVerified: primary?.verification?.status === 'verified',
      clerkConfigured: true as const,
    }
  } catch {
    return {
      userId: state.userId,
      userEmail: null,
      userEmailVerified: false,
      clerkConfigured: true as const,
    }
  }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
