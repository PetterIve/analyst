import type { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/tanstack-react-start'
import { TokenSync } from './TokenSync'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined

export default function AppClerkProvider({
  children,
}: {
  children: ReactNode
}) {
  if (!publishableKey) {
    // Clerk is not configured — skip both the provider and the token
    // synchroniser. Admin mutations run in their dev-bypass path so local
    // development still works without Clerk.
    return <>{children}</>
  }
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <TokenSync />
      {children}
    </ClerkProvider>
  )
}
