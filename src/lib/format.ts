const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const integer = new Intl.NumberFormat()

/** 1,284 below 10k, then 12.9K / 4.2M. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return Math.abs(value) < 10_000 ? integer.format(Math.round(value)) : compact.format(value)
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  if (minutes < 60) return `${minutes}m ${rest.toString().padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${(minutes % 60).toString().padStart(2, '0')}m`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`
}

export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function basename(path: string | null | undefined): string {
  if (!path) return '—'
  return path.split('/').pop() || path
}
