import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const control =
  'w-full rounded-md bg-surface px-2.5 text-sm text-ink ring-1 ring-line placeholder:text-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-accent aria-[invalid=true]:ring-critical disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(control, 'h-9', className)} {...props} />,
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(control, 'min-h-20 py-2', className)} {...props} />,
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(control, 'h-9', className)} {...props} />,
)
Select.displayName = 'Select'

export function Field({
  id,
  label,
  hint,
  error,
  badge,
  children,
  className,
}: {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  badge?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {badge}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-critical-text">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-2">{hint}</p>
      )}
    </div>
  )
}
