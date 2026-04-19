import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Toaster } from '#/components/ui/sonner'
import { Tweaks } from '#/components/Tweaks'
import { Icon, type IconName } from '#/components/DesignIcons'

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
      { label: 'Alert feed', to: '/admin/feed', icon: 'bell', enabled: false, task: 'T11' },
      { label: 'Tickers', to: '/admin/tickers', icon: 'ticker', enabled: true },
      { label: 'Event catalog', to: '/admin/events', icon: 'layers', enabled: false, task: 'T08' },
      { label: 'Performance', to: '/admin/perf', icon: 'chart', enabled: false, task: 'T15' },
    ],
  },
  {
    label: 'Admin',
    entries: [
      { label: 'Factors', to: '/admin/factors', icon: 'sliders', enabled: true },
      { label: 'Sources', to: '/admin/sources', icon: 'feed', enabled: false, task: 'T04' },
      { label: 'X accounts', to: '/admin/x-accounts', icon: 'x', enabled: false, task: 'T05' },
      { label: 'Extractor', to: '/admin/extractor', icon: 'cpu', enabled: false, task: 'T07' },
      { label: 'Prompt', to: '/admin/prompt', icon: 'terminal', enabled: false, task: 'T07' },
      { label: 'Workers', to: '/admin/workers', icon: 'clock', enabled: false, task: 'T16' },
    ],
  },
]

const CRUMBS: Record<string, ReadonlyArray<string>> = {
  '/admin/tickers': ['Analyst', 'Tickers'],
  '/admin/factors': ['Admin', 'Factors'],
}

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const crumbs = CRUMBS[pathname] ?? ['Analyst']

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
        <span className="brand-sub">v0.4</span>
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
          cron lands in T04
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
      </div>
    </header>
  )
}
