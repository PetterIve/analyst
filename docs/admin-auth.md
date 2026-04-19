# Admin auth

The tRPC admin mutations (`ticker.update`, `factor.update`, …) are gated by
`adminProcedure` in `src/integrations/trpc/init.ts`. It checks the signed-in
Clerk user's primary email against an `ADMIN_EMAILS` whitelist.

## Server side

Env vars:

- `CLERK_SECRET_KEY` — Clerk backend secret.
- `ADMIN_EMAILS` — comma-separated list, case-insensitive (e.g.
  `me@example.com, ops@example.com`).

Behavior:

- **Clerk not configured + `NODE_ENV !== 'production'`** — gate bypassed.
  Local dev can hit mutations without sign-in. Matches how `VITE_CLERK_PUBLISHABLE_KEY` is optional in most starters.
- **Clerk not configured + production** — every admin mutation returns
  `UNAUTHORIZED`. Fail-closed.
- **Clerk configured but `ADMIN_EMAILS` empty + non-production** — bypassed.
  Production — fail-closed.
- **Clerk configured + whitelist set** — caller must be signed in AND have
  a primary email in the list. Otherwise `UNAUTHORIZED`.

The gate lives in `src/integrations/trpc/init.ts`
(`adminProcedure`). The Clerk session is verified in
`src/integrations/trpc/context.ts` via `@clerk/backend`'s
`authenticateRequest`, which supports both `Authorization: Bearer <jwt>` and
the Clerk session cookie.

Read-only queries (`ticker.list`, `factor.list`) remain public — they don't
leak anything sensitive.

## Client side

The tRPC client in `src/integrations/tanstack-query/root-provider.tsx`
attaches `Authorization: Bearer <jwt>` on every request by calling
`window.Clerk.session.getToken()`. If the user isn't signed in, no header is
sent and the server gate decides.

To unlock admin edits:

1. Sign in via Clerk (the existing `<SignInButton />` in
   `src/components/Header.tsx`, or a dedicated sign-in page).
2. Ensure your email is in `ADMIN_EMAILS`.
3. Reload — mutations start working. A forbidden user sees a toast with
   "UNAUTHORIZED".

## Why Clerk (not a shared secret)?

A per-user gate gives us audit-friendly attribution (which admin changed
which factor weight) for free, and removes the need to copy/paste a shared
secret. Clerk was already wired for the `<SignInButton>` UI; the backend
verification is a few extra lines.
