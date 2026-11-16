import { AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepStatus {
  key: string
  title: string
  visited: boolean
  skipped: boolean
  changed: number
  errors: number
}

function detail(step: StepStatus): string | null {
  if (step.errors > 0) return `${step.errors} error${step.errors > 1 ? 's' : ''}`
  if (step.changed > 0) return `${step.changed} changed`
  if (step.skipped) return 'defaults'
  return null
}

/** Visited steps can be revisited directly; the others are reached with Next. */
export function Stepper({
  steps,
  active,
  onSelect,
}: {
  steps: StepStatus[]
  active: string
  onSelect: (key: string) => void
}) {
  return (
    <nav aria-label="Run designer steps" className="overflow-x-auto">
      <ol className="flex min-w-max gap-1 pb-1">
        {steps.map((step, i) => {
          const current = step.key === active
          const text = detail(step)
          return (
            <li key={step.key}>
              <button
                type="button"
                aria-current={current ? 'step' : undefined}
                disabled={!step.visited || current}
                onClick={() => onSelect(step.key)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  current ? 'bg-surface ring-1 ring-line' : step.visited ? 'hover:bg-surface-2' : 'opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular',
                    step.errors > 0
                      ? 'text-critical-text ring-1 ring-critical'
                      : current
                        ? 'bg-accent text-accent-ink'
                        : step.visited
                          ? 'bg-accent-track text-ink'
                          : 'text-ink-2 ring-1 ring-line',
                  )}
                  aria-hidden
                >
                  {step.errors > 0 ? (
                    <AlertCircle className="size-3.5" />
                  ) : step.visited && !current ? (
                    <Check className="size-3.5" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className={cn('whitespace-nowrap', current ? 'font-semibold text-ink' : 'text-ink-2')}>{step.title}</span>
                  {text && (
                    <span className={cn('text-[11px]', step.errors > 0 ? 'text-critical-text' : 'text-muted')}>{text}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
