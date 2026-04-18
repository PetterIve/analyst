import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Landing,
})

function Landing() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--pad-5)',
      }}
    >
      <div style={{ maxWidth: 560, textAlign: 'left' }}>
        <div className="label-xs" style={{ marginBottom: 10 }}>
          ANALYST · V0.4
        </div>
        <h1
          style={{
            fontSize: 'var(--text-3xl)',
            lineHeight: 1.08,
            marginBottom: 12,
          }}
        >
          Tanker equity research, instrumented.
        </h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          Confirmation-based alerts across a curated universe of crude and
          product tankers. Signals fuse news, X, factor models, and historical
          event EVs into an auditable thesis per call.
        </p>
        <div className="row-d" style={{ gap: 8 }}>
          <Link to="/admin/tickers" className="btn primary">
            Open admin
          </Link>
          <a
            className="btn"
            href="https://github.com/PetterIve/analyst"
            target="_blank"
            rel="noreferrer"
          >
            Repo
          </a>
        </div>
      </div>
    </main>
  )
}
