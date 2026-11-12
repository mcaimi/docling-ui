import type { ReactNode } from 'react'

/** Stat tile: label, value (proportional figures), optional context line. */
export function StatTile({ label, value, context }: { label: string; value: ReactNode; context?: ReactNode }) {
  return (
    <div className="rounded-lg bg-surface p-4 ring-1 ring-line">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {context && <p className="mt-0.5 text-xs text-ink-2">{context}</p>}
    </div>
  )
}
