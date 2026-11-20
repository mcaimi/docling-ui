import { ExternalLink } from 'lucide-react'
import type { MlflowOverview, ShardRuntime } from '@/api/types'
import { Card, CardHeader } from '@/components/ui/card'
import { Meter } from '@/components/Meter'
import { StatusBadge } from '@/components/StatusBadge'
import { Table, Td, Th } from '@/components/ui/table'
import { formatCount } from '@/lib/format'
import { shardStatus } from './runtimeStatus'

export function ShardsTable({
  shardCount,
  runtime,
  overview,
  onOpenShard,
}: {
  shardCount: number
  runtime: ShardRuntime[]
  overview: MlflowOverview | undefined
  onOpenShard: (index: number) => void
}) {
  const byIndex = new Map(runtime.map((s) => [s.shard_index, s]))
  return (
    <Card>
      <CardHeader title="Shards" description={`${shardCount} ${shardCount === 1 ? 'instance' : 'instances'} · select a shard to see its agent workflow`} />
      <Table aria-label="Shards" className="mt-2">
        <thead>
          <tr>
            <Th>Shard</Th>
            <Th>Process</Th>
            <Th>MLflow run</Th>
            <Th className="w-56">Documents</Th>
            <Th className="text-right">Chunks</Th>
            <Th className="text-right">Errors</Th>
            <Th className="text-right">Attempts</Th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: shardCount }, (_, index) => {
            const mlflow = overview?.shards.find((s) => s.shard_index === index)
            const done = mlflow?.metrics?.docs_completed ?? 0
            const total = mlflow?.document_count ?? 0
            const { status, label, detail } = shardStatus(byIndex.get(index))
            return (
              <tr key={index}>
                <Td className="tabular">
                  <button
                    type="button"
                    onClick={() => onOpenShard(index)}
                    aria-label={`Show shard ${index} workflow`}
                    className="rounded font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {index}
                  </button>
                </Td>
                <Td title={detail}>
                  <StatusBadge status={status} label={label} />
                </Td>
                <Td>
                  {mlflow?.run_id ? (
                    <span className="inline-flex items-center gap-2">
                      <StatusBadge status={mlflow.status} />
                      {mlflow.link && (
                        <a href={mlflow.link} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink" aria-label={`Open shard ${index} run in MLflow`}>
                          <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">not started</span>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Meter size="sm" value={done} max={total || 1} label={`Shard ${index}: ${done} of ${total} documents`} />
                    <span className="shrink-0 text-xs text-ink-2 tabular">
                      {formatCount(done)} / {total ? formatCount(total) : '—'}
                    </span>
                  </div>
                </Td>
                <Td className="text-right tabular">{formatCount(mlflow?.metrics?.total_chunks ?? null)}</Td>
                <Td className="text-right tabular">{formatCount(mlflow?.metrics?.error_count ?? null)}</Td>
                <Td className="text-right tabular">{(byIndex.get(index)?.attempt ?? 0) + (byIndex.has(index) ? 1 : 0)}</Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Card>
  )
}
