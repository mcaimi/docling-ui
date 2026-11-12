import { useEffect, useState } from 'react'
import type { ResourceSample, RuntimeView } from '@/api/types'
import { Alert } from '@/components/ui/alert'
import { Sparkline } from '@/components/Sparkline'
import { StatusBadge } from '@/components/StatusBadge'
import { Table, Td, Th } from '@/components/ui/table'
import { formatBytes, formatClock } from '@/lib/format'
import { executorUnit } from '@/lib/executor'
import { appendSamples } from '@/lib/progress'
import { shardStatus } from './runtimeStatus'

// Podman event actions and Kubernetes event reasons worth highlighting
const ALERT_ACTIONS = new Set([
  'oom',
  'died',
  'kill',
  'OOMKilling',
  'BackOff',
  'Failed',
  'FailedScheduling',
  'FailedMount',
  'FailedCreate',
  'DeadlineExceeded',
  'BackoffLimitExceeded',
  'Evicted',
])

export function RuntimePanel({ runtime, executor }: { runtime: RuntimeView | undefined; executor: string }) {
  const unit = executorUnit(executor)
  const title = unit.plural[0]!.toUpperCase() + unit.plural.slice(1)
  const [samples, setSamples] = useState<Record<number, ResourceSample[]>>({})
  useEffect(() => {
    if (runtime?.resources.length) setSamples((buffer) => appendSamples(buffer, runtime.resources))
  }, [runtime])

  if (!runtime) return <p className="text-sm text-ink-2">Loading…</p>
  const latest = Object.entries(samples)
  return (
    <div className="flex flex-col gap-6">
      {runtime.error && <Alert tone="critical" title="Runtime unavailable">{runtime.error}</Alert>}
      <section>
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        <Table aria-label={title}>
          <thead>
            <tr>
              <Th>Shard</Th>
              <Th>Attempt</Th>
              <Th>Name</Th>
              <Th>State</Th>
              <Th>Started</Th>
              <Th>Finished</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {runtime.containers.map((c) => {
              const { status, label, detail } = shardStatus(c)
              return (
                <tr key={`${c.shard_index}-${c.attempt}`}>
                  <Td className="tabular">{c.shard_index}</Td>
                  <Td className="tabular">{c.attempt}</Td>
                  <Td className="font-mono text-xs">{c.name ?? c.container_id}</Td>
                  <Td>
                    <StatusBadge status={status} label={label} />
                  </Td>
                  <Td className="text-xs text-ink-2">{c.started_at ?? '—'}</Td>
                  <Td className="text-xs text-ink-2">{c.finished_at ?? '—'}</Td>
                  <Td className="max-w-80 truncate text-xs text-ink-2" title={detail}>
                    {detail ?? '—'}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Resources</h3>
        {latest.length === 0 ? (
          <p className="text-sm text-ink-2">{`No samples yet (only running ${unit.plural} report usage${executor === 'kubernetes' ? ', and only when the cluster runs metrics-server' : ''}).`}</p>
        ) : (
          <Table aria-label="Resource usage">
            <thead>
              <tr>
                <Th>Shard</Th>
                <Th className="text-right">CPU</Th>
                <Th>CPU trend</Th>
                <Th className="text-right">Memory</Th>
                <Th>Memory trend</Th>
              </tr>
            </thead>
            <tbody>
              {latest.map(([shard, series]) => {
                const last = series[series.length - 1]!
                return (
                  <tr key={shard}>
                    <Td className="tabular">{shard}</Td>
                    <Td className="text-right tabular">{last.cpu_percent === null ? '—' : `${last.cpu_percent.toFixed(0)}%`}</Td>
                    <Td>
                      <Sparkline values={series.map((s) => s.cpu_percent ?? 0)} label={`Shard ${shard} CPU trend`} />
                    </Td>
                    <Td className="text-right tabular">
                      {formatBytes(last.memory_bytes)}
                      {last.memory_limit_bytes ? ` / ${formatBytes(last.memory_limit_bytes)}` : ''}
                    </Td>
                    <Td>
                      <Sparkline values={series.map((s) => s.memory_bytes ?? 0)} label={`Shard ${shard} memory trend`} />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Events</h3>
        {runtime.events.length === 0 ? (
          <p className="text-sm text-ink-2">No events.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {[...runtime.events].reverse().map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-ink-2 tabular">{formatClock(e.timestamp * 1000)}</span>
                <span className="w-16 text-ink-2">shard {e.shard_index ?? '—'}</span>
                <span className={ALERT_ACTIONS.has(e.action) ? 'font-semibold text-critical-text' : 'text-ink'}>{e.action}</span>
                <span className="truncate text-ink-2">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
