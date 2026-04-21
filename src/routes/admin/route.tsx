import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SignIn, UserButton, useAuth } from '@clerk/tanstack-react-start'
import { Toaster } from '#/components/ui/sonner'
import { Tweaks } from '#/components/Tweaks'
import { Icon, type IconName } from '#/components/DesignIcons'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

interface NavEntry {
  label: string
  to: string
  icon: IconName
  enabled: boolean
  task?: string
}

interface NavGroup {
  label: string
  entries: ReadonlyArray<NavEntry>
}

const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    label: 'Analyst',
    entries: [
      { label: 'Alert feed', to: '/admin/feed', icon: 'bell', enabled: false, task: 'T09' },
      { label: 'Tickers', to: '/admin/tickers', icon: 'ticker', enabled: true },
      { label: 'News', to: '/admin/news', icon: 'feed', enabled: true },
      { label: 'Prices', to: '/admin/prices', icon: 'chart', enabled: true },
      { label: 'Event catalog', to: '/admin/events', icon: 'layers', enabled: true },
      { label: 'Performance', to: '/admin/perf', icon: 'chart', enabled: false, task: 'T15' },
    ],
  },
  {
    label: 'Admin',
    entries: [
      { label: 'Factors', to: '/admin/factors', icon: 'sliders', enabled: true },
      { label: 'Sources', to: '/admin/sources', icon: 'feed', enabled: true },
      { label: 'X accounts', to: '/admin/x-accounts', icon: 'x', enabled: false, task: 'T05' },
      { label: 'Extractor', to: '/admin/extractor', icon: 'cpu', enabled: true },
      { label: 'Candidates', to: '/admin/candidates', icon: 'layers', enabled: true },
      { label: 'Prompt', to: '/admin/prompt', icon: 'terminal', enabled: true },
      { label: 'Workers', to: '/admin/workers', icon: 'clock', enabled: false, task: 'T16' },
    ],
  },
]

const CRUMBS: Record<string, ReadonlyArray<string>> = {
  '/admin/tickers': ['Analyst', 'Tickers'],
  '/admin/news': ['Analyst', 'News'],
  '/admin/prices': ['Analyst', 'Prices'],
  '/admin/events': ['Analyst', 'Event catalog'],
  '/admin/factors': ['Admin', 'Factors'],
  '/admin/sources': ['Admin', 'Sources'],
  '/admin/extractor': ['Admin', 'Extractor'],
  '/admin/candidates': ['Admin', 'Candidates'],
  '/admin/prompt': ['Admin', 'Prompt'],
}

export const Route = createFileRoute('/admin')({
  component: AdminGate,
})

function AdminGate() {
  if (!clerkEnabled) return <AdminLayout />
  return <AuthGate />
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--fg-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Verifying session…
      </div>
    )
  }
  if (!isSignedIn) return <SignInScreen />
  return <AdminLayout />
}

function SignInScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--pad-5)',
      }}
    >
      <div className="stack" style={{ gap: 'var(--pad-4)', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="label-xs" style={{ marginBottom: 6 }}>
            ANALYST · ADMIN
          </div>
          <h1 style={{ fontSize: 'var(--text-xl)', marginBottom: 4 }}>
            Sign in to continue
          </h1>
          <div className="page-sub">
            Admin access is limited to whitelisted emails.
          </div>
        </div>
        <SignIn routing="hash" />
      </div>
      <Tweaks />
    </div>
  )
}

function deriveCrumbs(pathname: string): ReadonlyArray<string> {
  if (CRUMBS[pathname]) return CRUMBS[pathname]
  // Drill-down routes get the parent crumb plus a generic leaf so users still
  // see where they are without registering every dynamic path.
  if (pathname.startsWith('/admin/events/')) return ['Analyst', 'Event catalog', '…']
  if (pathname.startsWith('/admin/prices/')) return ['Analyst', 'Prices', '…']
  return ['Analyst']
}

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const crumbs = deriveCrumbs(pathname)

  return (
    <div className="app">
      <Sidebar pathname={pathname} />
      <div className="main">
        <TopBar crumbs={crumbs} />
        <Outlet />
      </div>
      <Tweaks />
      <Toaster />
    </div>
  )
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div className="brand-name">Analyst</div>
        <span className="brand-sub">
          {import.meta.env.VITE_WT_LABEL ?? 'v0.4'}
        </span>
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="nav-group">
          <div className="nav-label">{group.label}</div>
          {group.entries.map((entry) => (
            <NavItem
              key={entry.to}
              entry={entry}
              active={pathname === entry.to}
            />
          ))}
        </div>
      ))}

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 'var(--pad-3)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="label-xs" style={{ marginBottom: 6 }}>
          SYSTEM
        </div>
        <div
          className="row-d"
          style={{ fontSize: 11, color: 'var(--fg-3)', gap: 6 }}
        >
          <span className="dot" style={{ color: 'var(--pos)' }} /> worker · not
          yet wired
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-4)',
            marginTop: 4,
            fontFamily: 'var(--font-mono)',
          }}
        >
          news cron · /api/cron/ingest-news
        </div>
      </div>
    </aside>
  )
}

function NavItem({ entry, active }: { entry: NavEntry; active: boolean }) {
  const IconCmp = Icon[entry.icon]
  const body: ReactNode = (
    <>
      <span className="nav-icon">
        <IconCmp />
      </span>
      <span>{entry.label}</span>
      {entry.task ? <span className="nav-badge">{entry.task}</span> : null}
    </>
  )
  if (!entry.enabled) {
    return (
      <div className="nav-item disabled" title={`Lands in ${entry.task}`}>
        {body}
      </div>
    )
  }
  return (
    <Link
      to={entry.to}
      className={`nav-item${active ? ' active' : ''}`}
      style={{ textDecoration: 'none' }}
    >
      {body}
    </Link>
  )
}

function TopBar({ crumbs }: { crumbs: ReadonlyArray<string> }) {
  const today = new Date()
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase()
  return (
    <header className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', gap: 6 }}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'here' : ''}>{c}</span>
          </span>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div className="row-d" style={{ gap: 8 }}>
        <span className="label-xs">{today}</span>
        <span className="kbd">⌘K</span>
        {clerkEnabled ? <UserButton /> : null}
      </div>
    </header>
  )
}
