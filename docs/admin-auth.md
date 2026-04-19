# Admin auth

The tRPC admin mutations (`ticker.update`, `factor.update`, …) are gated by
`adminProcedure` in `src/integrations/trpc/init.ts`. It checks the signed-in
Clerk user's primary email against an `ADMIN_EMAILS` whitelist.

## Wiring

- [`src/start.ts`](../src/start.ts) — registers `clerkMiddleware()` in
  `requestMiddleware` so every request has Clerk's auth state available via
  `auth()` from `@clerk/tanstack-react-start/server`.
- [`src/integrations/trpc/context.ts`](../src/integrations/trpc/context.ts) —
  tRPC context calls `auth()` (no args; reads from the middleware), then
  looks up the user's primary email via `clerkClient()`.
- [`src/integrations/trpc/init.ts`](../src/integrations/trpc/init.ts) —
  `adminProcedure` enforces the whitelist.
- [`src/integrations/clerk/TokenSync.tsx`](../src/integrations/clerk/TokenSync.tsx)
  — renders once inside `<ClerkProvider>`, calls `useAuth()`, and writes the
  current `getToken` into a singleton (`token-holder.ts`).
- [`src/integrations/tanstack-query/root-provider.tsx`](../src/integrations/tanstack-query/root-provider.tsx)
  — the tRPC `httpBatchStreamLink` reads from the same singleton and attaches
  `Authorization: Bearer <jwt>` on every request.

No sniffing of `window.Clerk`, no duplicated auth logic server-side.

## Env vars

- `CLERK_PUBLISHABLE_KEY` — injected into the page by the Clerk middleware.
- `CLERK_SECRET_KEY` — backend-only; required for `auth()` / `clerkClient`.
- `ADMIN_EMAILS` — comma-separated, case-insensitive list.

## Gate behavior

- **Clerk not configured + `NODE_ENV !== 'production'`** → bypassed. Local dev
  hits mutations without sign-in.
- **Clerk not configured + production** → every admin mutation returns
  `UNAUTHORIZED`. Fail-closed.
- **Clerk configured + `ADMIN_EMAILS` empty + non-prod** → bypassed.
- **Clerk configured + `ADMIN_EMAILS` empty + prod** → fail-closed.
- **Clerk configured + whitelist populated** → caller must be signed in AND
  have a primary email in the list. Otherwise `UNAUTHORIZED`.

Read-only queries (`ticker.list`, `factor.list`) remain public.

## Client UX

The tRPC client always attaches the current session JWT when one exists.
Signed-out callers get no header, and the server gate decides. When an
admin mutation is rejected, the sonner toast surfaces "UNAUTHORIZED".

To unlock admin edits: sign in via the Clerk `<SignInButton>` (currently in
`src/components/Header.tsx`) with an email in `ADMIN_EMAILS`.
