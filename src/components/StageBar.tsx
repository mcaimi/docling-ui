import type { StageName } from '@/api/types'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

// Categorical slots 1-4 of the validated palette, fixed per stage (identity,
// never rank), adjacent order checked for CVD separation in both modes.
export const STAGES: { key: StageName; label: string; color: string }[] = [
  { key: 'convert_pdf', label: 'Convert', color: 'var(--series-1)' },
  { key: 'chunk_doc', label: 'Chunk', color: 'var(--series-2)' },
  { key: 'embed_doc', label: 'Embed', color: 'var(--series-3)' },
  { key: 'store_doc', label: 'Store', color: 'var(--series-4)' },
]

export function StageLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2', className)} aria-label="Pipeline stages">
      {STAGES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-[2px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Stacked horizontal bar of one document's stage durations on a shared scale
 * (``scaleMs`` = longest document), so rows compare honestly. Each segment is
 * focusable with a tooltip; numbers are also available in the table view.
 */
export function StageBar({
  stages,
  scaleMs,
  width = 160,
}: {
  stages: Partial<Record<StageName, number>>
  scaleMs: number
  width?: number
}) {
  const present = STAGES.filter((s) => (stages[s.key] ?? 0) > 0)
  if (!present.length || scaleMs <= 0) return <span className="text-xs text-muted">—</span>
  const total = present.reduce((sum, s) => sum + (stages[s.key] ?? 0), 0)
  const summary = present.map((s) => `${s.label} ${formatDuration(stages[s.key])}`).join(', ')
  return (
    <div className="flex items-center" style={{ width }} role="group" aria-label={`Stage times: ${summary}`}>
      <div className="flex items-center gap-[2px]" style={{ width: `${Math.max(4, (total / scaleMs) * 100)}%` }}>
        {present.map((s, i) => {
          const ms = stages[s.key] ?? 0
          return (
            <span
              key={s.key}
              tabIndex={0}
              className="group relative flex min-w-[2px] cursor-default items-center py-2 outline-none"
              style={{ flexGrow: ms, flexBasis: 0 }}
            >
              <span
                className={cn(
                  'block h-2.5 w-full group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-accent',
                  i === present.length - 1 && 'rounded-r-[4px]',
                )}
                style={{ background: s.color }}
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 rounded-md bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-md ring-1 ring-line group-hover:block group-focus-visible:block"
              >
                <span className="font-semibold text-ink tabular">{formatDuration(ms)}</span>
                <span className="ml-1.5 inline-flex items-center gap-1 text-ink-2">
                  <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </span>
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
