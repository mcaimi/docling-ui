import { lazy, Suspense, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { ExternalLink, Monitor, Moon, Sun } from 'lucide-react'
import { useTargets } from '@/api/queries'
import { TokenGate } from '@/features/auth/TokenGate'
import { RunsPage } from '@/features/history/RunsPage'
import { getTheme, setTheme, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

// route-level code splitting: the chart and form libraries load on demand
const DesignerPage = lazy(() => import('@/features/designer/DesignerPage').then((m) => ({ default: m.DesignerPage })))
const MonitorPage = lazy(() => import('@/features/monitor/MonitorPage').then((m) => ({ default: m.MonitorPage })))

function ThemeToggle() {
  const [theme, setState] = useState<Theme>(getTheme)
  const order: Theme[] = ['system', 'light', 'dark']
  const next = order[(order.indexOf(theme) + 1) % order.length]!
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next)
        setState(next)
      }}
      className="rounded-md p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}

function Header() {
  const { data: targets } = useTargets()
  const nav = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-md px-3 py-1.5 text-sm', isActive ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:text-ink')
  const executor = targets?.executor
  return (
    <header className="border-b border-grid bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link to="/runs" className="text-sm font-semibold text-ink">
          Docling agent
        </Link>
        <nav className="flex gap-1" aria-label="Main">
          <NavLink to="/runs" end className={nav}>
            Runs
          </NavLink>
          <NavLink to="/runs/new" className={nav}>
            New run
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-ink-2">
          {executor && (
            <span
              title={
                executor.name === 'kubernetes'
                  ? `Shards run as Kubernetes Jobs${targets.kubernetes?.namespace ? ` in namespace ${targets.kubernetes.namespace}` : ''}`
                  : 'Shards run in Podman containers'
              }
            >
              Executor: <span className="font-medium text-ink">{executor.name}</span>
            </span>
          )}
          {targets?.mlflow.ui_uri && (
            <a href={targets.mlflow.ui_uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              MLflow <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export function App() {
  return (
    <TokenGate>
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Suspense fallback={<p className="text-sm text-ink-2">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Navigate to="/runs" replace />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/new" element={<DesignerPage />} />
            <Route path="/runs/:runId" element={<MonitorPage />} />
            <Route path="*" element={<Navigate to="/runs" replace />} />
          </Routes>
          </Suspense>
        </main>
      </div>
    </TokenGate>
  )
}
