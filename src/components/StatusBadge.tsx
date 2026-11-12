import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Status colors are reserved for state and always paired with an icon + label.
type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral' | 'active'

const tones: Record<Tone, { dot: string; icon: LucideIcon; spin?: boolean }> = {
  good: { dot: 'text-good', icon: CheckCircle2 },
  warning: { dot: 'text-warning', icon: AlertTriangle },
  serious: { dot: 'text-serious', icon: AlertTriangle },
  critical: { dot: 'text-critical', icon: XCircle },
  neutral: { dot: 'text-muted', icon: CircleDashed },
  active: { dot: 'text-accent', icon: Loader2, spin: true },
}

const STATUS_TONES: Record<string, { tone: Tone; label: string }> = {
  SUCCEEDED: { tone: 'good', label: 'Succeeded' },
  FINISHED: { tone: 'good', label: 'Finished' },
  OK: { tone: 'good', label: 'OK' },
  FAILED: { tone: 'critical', label: 'Failed' },
  SUBMIT_FAILED: { tone: 'critical', label: 'Launch failed' },
  ERROR: { tone: 'critical', label: 'Error' },
  PARTIAL: { tone: 'warning', label: 'Partial' },
  UNKNOWN: { tone: 'serious', label: 'Unknown' },
  KILLED: { tone: 'neutral', label: 'Killed' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
  RUNNING: { tone: 'active', label: 'Running' },
  PENDING: { tone: 'neutral', label: 'Pending' },
  SUBMITTING: { tone: 'neutral', label: 'Submitting' },
  SCHEDULED: { tone: 'neutral', label: 'Scheduled' },
}

export function StatusBadge({ status, label, className }: { status: string | null | undefined; label?: string; className?: string }) {
  const key = (status ?? 'UNKNOWN').toUpperCase()
  const { tone, label: defaultLabel } = STATUS_TONES[key] ?? { tone: 'neutral' as Tone, label: status ?? 'Unknown' }
  const { dot, icon: Icon, spin } = tones[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pr-2 pl-1.5 text-xs font-medium whitespace-nowrap text-ink',
        className,
      )}
    >
      <Icon className={cn('size-3.5', dot, spin && 'animate-spin motion-reduce:animate-none')} aria-hidden />
      {label ?? defaultLabel}
    </span>
  )
}
