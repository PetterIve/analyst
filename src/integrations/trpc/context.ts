import { auth, clerkClient } from '@clerk/tanstack-react-start/server'

// Expected shape when the Clerk Dashboard's "Customize session token" adds
// `{ "email": "{{user.primary_email_address}}" }`. Makes the email available
// in sessionClaims so we don't have to fetch the user on every admin call.
interface SessionClaimsWithEmail {
  email?: string
}

export async function createTRPCContext() {
  const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY)
  if (!clerkConfigured) {
    return { userId: null, userEmail: null, clerkConfigured: false as const }
  }

  let state: Awaited<ReturnType<typeof auth>>
  try {
    state = await auth()
  } catch {
    return { userId: null, userEmail: null, clerkConfigured: true as const }
  }

  if (!state.isAuthenticated || !state.userId) {
    return { userId: null, userEmail: null, clerkConfigured: true as const }
  }

  const claimsEmail = (state.sessionClaims as SessionClaimsWithEmail | null)
    ?.email
  if (claimsEmail) {
    return {
      userId: state.userId,
      userEmail: claimsEmail,
      clerkConfigured: true as const,
    }
  }

  // Fallback: dashboard hasn't been configured to include the email claim.
  // One Clerk API call per admin request until the operator sets it up; not
  // great but correct.
  try {
    const user = await clerkClient().users.getUser(state.userId)
    const primaryEmail =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null
    return {
      userId: state.userId,
      userEmail: primaryEmail,
      clerkConfigured: true as const,
    }
  } catch {
    return {
      userId: state.userId,
      userEmail: null,
      clerkConfigured: true as const,
    }
  }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
