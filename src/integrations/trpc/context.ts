import { createClerkClient } from '@clerk/backend'

let clerk: ReturnType<typeof createClerkClient> | null = null

function getClerk() {
  if (clerk) return clerk
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null
  clerk = createClerkClient({ secretKey })
  return clerk
}

export async function createTRPCContext({ req }: { req: Request }) {
  const client = getClerk()
  if (!client) {
    return { userId: null, userEmail: null, clerkConfigured: false as const }
  }

  const requestState = await client.authenticateRequest(req)
  if (!requestState.isAuthenticated) {
    return { userId: null, userEmail: null, clerkConfigured: true as const }
  }

  const { userId } = requestState.toAuth()
  if (!userId) {
    return { userId: null, userEmail: null, clerkConfigured: true as const }
  }

  try {
    const user = await client.users.getUser(userId)
    const primaryEmail = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    )?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null
    return {
      userId,
      userEmail: primaryEmail,
      clerkConfigured: true as const,
    }
  } catch {
    return { userId, userEmail: null, clerkConfigured: true as const }
  }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
