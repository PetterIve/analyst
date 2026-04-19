import { useEffect } from 'react'
import { useAuth } from '@clerk/tanstack-react-start'
import { setTokenGetter } from './token-holder'

/**
 * Bridges Clerk's `useAuth().getToken` into a module-level singleton so the
 * tRPC client (created outside the React tree) can attach the current user's
 * session JWT to every request without sniffing `window.Clerk` directly.
 */
export function TokenSync() {
  const { getToken } = useAuth()
  useEffect(() => {
    setTokenGetter(() => getToken())
    return () => setTokenGetter(null)
  }, [getToken])
  return null
}
