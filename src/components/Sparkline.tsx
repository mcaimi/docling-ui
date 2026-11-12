/** Tiny trend line: de-emphasis stroke, current value marked in the accent. */
export function Sparkline({ values, width = 80, height = 20, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length < 2) return <span className="text-xs text-muted">—</span>
  const max = Math.max(...values, 1e-9)
  const min = Math.min(...values, 0)
  const x = (i: number) => (i / (values.length - 1)) * (width - 6) + 3
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6)
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const last = values.length - 1
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      <polyline points={points} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last]!)} r={3} fill="var(--accent)" stroke="var(--surface-1)" strokeWidth={2} />
    </svg>
  )
}
