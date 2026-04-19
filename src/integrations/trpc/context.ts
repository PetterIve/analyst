import { auth, clerkClient } from '@clerk/tanstack-react-start/server'

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
