import { cn } from '@/lib/utils'

/**
 * Single ratio against a limit: accent fill on a lighter step of the same
 * ramp. The label carries the value, so the bar never reads as color alone.
 */
export function Meter({
  value,
  max,
  label,
  className,
  size = 'md',
}: {
  value: number
  max: number
  label: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-accent-track', size === 'sm' ? 'h-1.5' : 'h-2.5', className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}
