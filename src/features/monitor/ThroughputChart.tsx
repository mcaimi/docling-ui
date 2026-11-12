import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, Td, Th } from '@/components/ui/table'
import { formatClock, formatCount, formatDuration } from '@/lib/format'
import type { SeriesPoint } from '@/lib/progress'

function elapsed(t: number, start: number): string {
  return formatDuration(Math.max(0, t - start))
}

/** Axis ticks: whole seconds/minutes, no "0 ms". */
function elapsedTick(t: number, start: number): string {
  const seconds = Math.max(0, (t - start) / 1000)
  if (seconds < 10) return `${Number(seconds.toFixed(1))}s`
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m${Math.round(seconds % 60).toString().padStart(2, '0')}`
  return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')}`
}

/** Three clean ticks ending at the expected total (0, midpoint, total). */
function yTicks(max: number): number[] {
  if (max <= 2) return Array.from({ length: max + 1 }, (_, i) => i)
  return [0, Math.round(max / 2), max]
}

function ChartTooltip({ active, payload, start }: TooltipContentProps<number, string> & { start: number }) {
  const point = payload?.[0]?.payload as SeriesPoint | undefined
  if (!active || !point) return null
  return (
    <div className="rounded-md bg-surface px-2.5 py-1.5 text-xs shadow-md ring-1 ring-line">
      <p className="text-sm font-semibold text-ink tabular">{formatCount(point.value)}</p>
      <p className="text-ink-2">
        documents · {elapsed(point.t, start)} in ({formatClock(point.t)})
      </p>
    </div>
  )
}

/** Cumulative documents completed across all shards (single series, so no legend box). */
export function ThroughputChart({ series, startMs, total }: { series: SeriesPoint[]; startMs: number; total: number | null }) {
  const [showTable, setShowTable] = useState(false)
  const yMax = Math.max(total ?? 0, ...series.map((p) => p.value), 1)
  return (
    <Card>
      <CardHeader
        title="Documents completed"
        description={total ? `Across all shards, of ${formatCount(total)}` : 'Across all shards'}
        actions={
          <Button size="sm" variant="ghost" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
            {showTable ? 'Chart' : 'Table'}
          </Button>
        }
      />
      <CardBody>
        {series.length < 2 ? (
          <p className="py-12 text-center text-sm text-ink-2">Progress appears after the first batch completes.</p>
        ) : showTable ? (
          <div className="max-h-56 overflow-auto">
            <Table aria-label="Documents completed over time">
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Elapsed</Th>
                  <Th className="text-right">Documents</Th>
                </tr>
              </thead>
              <tbody>
                {series.map((p) => (
                  <tr key={p.t}>
                    <Td className="tabular">{formatClock(p.t)}</Td>
                    <Td className="tabular">{elapsed(p.t, startMs)}</Td>
                    <Td className="text-right tabular">{formatCount(p.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <div className="h-56" role="img" aria-label={`Documents completed over time, latest ${series[series.length - 1]!.value}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--gridline)" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(t: number) => elapsedTick(t, startMs)}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--baseline)' }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  allowDecimals={false}
                  width={44}
                  tickFormatter={(v: number) => formatCount(v)}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, yMax]}
                  ticks={yTicks(yMax)}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }}
                  content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} start={startMs} />}
                  isAnimationActive={false}
                />
                <Area
                  type="stepAfter"
                  dataKey="value"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  fill="var(--series-1)"
                  fillOpacity={0.1}
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--surface-1)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
