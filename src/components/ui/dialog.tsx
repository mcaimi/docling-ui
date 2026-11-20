import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Modal on the native <dialog>: focus trap, Escape and the top layer come from the browser. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  actions,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // a click on the backdrop lands on the <dialog> itself, outside the content box
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={cn(
        'm-auto max-h-[90vh] w-[min(64rem,calc(100vw-2rem))] rounded-lg bg-surface text-ink shadow-xl ring-1 ring-line backdrop:bg-black/40',
        className,
      )}
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <header className="flex flex-wrap items-start gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {description && <div className="mt-0.5 text-sm text-ink-2">{description}</div>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </header>
          {children}
        </div>
      )}
    </dialog>
  )
}
