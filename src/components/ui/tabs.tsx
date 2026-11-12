import { useId, type ReactNode, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  id: string
  label: ReactNode
}

export function Tabs({
  items,
  value,
  onChange,
  children,
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  children: ReactNode
}) {
  const base = useId()
  const onKey = (event: KeyboardEvent) => {
    const index = items.findIndex((i) => i.id === value)
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = items[(index + delta + items.length) % items.length]!
    onChange(next.id)
    document.getElementById(`${base}-tab-${next.id}`)?.focus()
  }
  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-grid" onKeyDown={onKey}>
        {items.map((item) => {
          const selected = item.id === value
          return (
            <button
              key={item.id}
              id={`${base}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm',
                selected ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${value}`} className="pt-4">
        {children}
      </div>
    </div>
  )
}
