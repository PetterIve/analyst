# Admin auth

The tRPC admin mutations (`ticker.update`, `factor.update`, …) are gated by
`adminProcedure` in `src/integrations/trpc/init.ts`. It checks the signed-in
Clerk user's primary email against an `ADMIN_EMAILS` whitelist.

## Wiring

- [`src/start.ts`](../src/start.ts) — registers `clerkMiddleware()` in
  `requestMiddleware` so every request has Clerk's auth state available via
  `auth()` from `@clerk/tanstack-react-start/server`.
- [`src/integrations/trpc/context.ts`](../src/integrations/trpc/context.ts) —
  tRPC context calls `auth()` (no args; reads from the middleware) and
  pulls the user's primary email from `sessionClaims.email`. Falls back
  to `clerkClient().users.getUser()` only if the claim is missing.
- [`src/integrations/trpc/init.ts`](../src/integrations/trpc/init.ts) —
  `adminProcedure` enforces the whitelist.
- [`src/integrations/clerk/TokenSync.tsx`](../src/integrations/clerk/TokenSync.tsx)
  — renders once inside `<ClerkProvider>`, calls `useAuth()`, and writes the
  current `getToken` into a singleton (`token-holder.ts`).
- [`src/integrations/tanstack-query/root-provider.tsx`](../src/integrations/tanstack-query/root-provider.tsx)
  — the tRPC `httpBatchStreamLink` reads from the same singleton and attaches
  `Authorization: Bearer <jwt>` on every request.

No sniffing of `window.Clerk`, no duplicated auth logic server-side.

## One-time Clerk Dashboard setup

To avoid a `clerkClient().users.getUser()` roundtrip on every admin mutation,
add the email to the session token itself:

1. Clerk Dashboard → **Sessions** → **Customize session token**.
2. Add the claims:
   ```json
   {
     "email": "{{user.primary_email_address}}",
     "email_verified": "{{user.email_verified}}"
   }
   ```
3. Save. New sessions now carry both in `sessionClaims`; the server reads
   them directly.

`adminProcedure` requires **both** that the email matches the whitelist AND
that `email_verified` is `true` — without the verified check, an attacker
could sign up with an unverified email matching an `ADMIN_EMAILS` entry and
get in.

If you skip this dashboard step, the gate still works — it falls back to
fetching the user from the Clerk API per request and reads the verification
status from there.

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

## Test identity for agents (dev only)

Dev Clerk instances treat any email containing `+clerk_test` as a test
identity: the account skips real email verification and accepts the fixed
OTP `424242` for any code prompt. Useful when a coding agent needs to sign
into the admin UI without access to a real inbox.

Recommended setup:

1. Add a test email to `ADMIN_EMAILS` in `.env.local`, e.g.:
   ```
   ADMIN_EMAILS=you@real.com,analyst-agent+clerk_test@analyst.local
   ```
2. At the sign-in screen, enter the same test email. Clerk will send an
   "email code" — use **`424242`** and hit continue.
3. You're signed in as the test identity; admin mutations work.

This trick only works on dev Clerk instances. In production, real Clerk
accounts with real verification are required.

For scripted e2e tests, prefer [`@clerk/testing`](https://clerk.com/docs/testing/overview)
— it provides Playwright/Cypress helpers to authenticate without driving
the UI at all.

## Client UX

The tRPC client always attaches the current session JWT when one exists.
Signed-out callers get no header, and the server gate decides. When an
admin mutation is rejected, the sonner toast surfaces "UNAUTHORIZED".

To unlock admin edits: sign in via the Clerk `<SignInButton>` (currently in
`src/components/Header.tsx`) with an email in `ADMIN_EMAILS`.
