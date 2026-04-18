import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Toaster } from '#/components/ui/sonner'

interface NavEntry {
  label: string
  to: string
  enabled: boolean
  task?: string
}

const navEntries: ReadonlyArray<NavEntry> = [
  { label: 'Tickers', to: '/admin/tickers', enabled: true },
  { label: 'Factors', to: '/admin/factors', enabled: true },
  { label: 'News', to: '/admin/news', enabled: false, task: 'T04' },
  { label: 'Sources', to: '/admin/sources', enabled: false, task: 'T04' },
  { label: 'X posts', to: '/admin/x-posts', enabled: false, task: 'T05' },
  { label: 'X accounts', to: '/admin/x-accounts', enabled: false, task: 'T05' },
  { label: 'Prices', to: '/admin/prices', enabled: false, task: 'T06' },
  { label: 'Extractor', to: '/admin/extractor', enabled: false, task: 'T07' },
  { label: 'Candidates', to: '/admin/candidates', enabled: false, task: 'T07' },
  { label: 'Events', to: '/admin/events', enabled: false, task: 'T08' },
  { label: 'Dashboard', to: '/admin/dashboard', enabled: false, task: 'T09' },
  { label: 'Alerts', to: '/admin/alerts', enabled: false, task: 'T09' },
]

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r bg-muted/30 p-4">
        <div className="mb-6">
          <Link
            to="/admin/tickers"
            className="block text-lg font-semibold tracking-tight"
          >
            Analyst · Admin
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Operator controls
          </p>
        </div>
        <nav className="flex flex-col gap-0.5 text-sm">
          {navEntries.map((entry) =>
            entry.enabled ? (
              <Link
                key={entry.to}
                to={entry.to}
                activeProps={{
                  className: 'bg-accent text-accent-foreground font-medium',
                }}
                className="rounded px-3 py-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              >
                {entry.label}
              </Link>
            ) : (
              <span
                key={entry.to}
                className="flex items-center justify-between rounded px-3 py-1.5 text-muted-foreground/60"
                title={`Lands in ${entry.task}`}
              >
                <span>{entry.label}</span>
                <span className="text-[10px] uppercase tracking-wide">
                  {entry.task}
                </span>
              </span>
            ),
          )}
        </nav>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
