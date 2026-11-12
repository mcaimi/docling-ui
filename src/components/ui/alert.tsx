import type { ReactNode } from 'react'
import { AlertTriangle, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const tones = {
  info: { icon: Info, bar: 'bg-accent' },
  warning: { icon: AlertTriangle, bar: 'bg-warning' },
  critical: { icon: XCircle, bar: 'bg-critical' },
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const { icon: Icon, bar } = tones[tone]
  return (
    <div role={tone === 'critical' ? 'alert' : 'status'} className={cn('relative flex gap-2.5 overflow-hidden rounded-md bg-surface-2 p-3 pl-4 text-sm', className)}>
      <span className={cn('absolute inset-y-0 left-0 w-1', bar)} aria-hidden />
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden />
      <div className="min-w-0 text-ink">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-ink-2">{children}</div>}
      </div>
    </div>
  )
}
