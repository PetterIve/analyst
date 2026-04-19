import type { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/tanstack-react-start'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined

export default function AppClerkProvider({
  children,
}: {
  children: ReactNode
}) {
  if (!publishableKey) {
    // Clerk is not configured — skip the provider. Admin mutations fall
    // through to the fail-closed / explicit-bypass path in adminProcedure.
    return <>{children}</>
  }
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  )
}
