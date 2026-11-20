import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, Copy, ExternalLink, RotateCcw, Trash2 } from 'lucide-react'
import {
  useCancelRun,
  useDeleteRun,
  useErrorReports,
  useMlflowOverview,
  useRetryFailed,
  useRun,
  useRuntime,
} from '@/api/queries'
import type { RunView } from '@/api/types'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Meter } from '@/components/Meter'
import { StatTile } from '@/components/StatTile'
import { StatusBadge } from '@/components/StatusBadge'
import { Tabs } from '@/components/ui/tabs'
import { formatCount, formatDuration, formatTime } from '@/lib/format'
import { totalOverTime, withOrigin } from '@/lib/progress'
import { DocumentsPanel } from './DocumentsPanel'
import { ErrorsPanel } from './ErrorsPanel'
import { LogViewer } from './LogViewer'
import { RuntimePanel } from './RuntimePanel'
import { ShardsTable } from './ShardsTable'
import { ShardWorkflowDialog } from './ShardWorkflowDialog'
import { ThroughputChart } from './ThroughputChart'
import { useDocuments } from './useDocuments'

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function RunHeader({ run }: { run: RunView }) {
  const navigate = useNavigate()
  const cancel = useCancelRun()
  const retry = useRetryFailed()
  const remove = useDeleteRun()
  const now = useNow(!run.final)
  const end = run.finished_at ? run.finished_at * 1000 : now
  const actionError = cancel.error ?? retry.error ?? remove.error

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">
          Run <span className="font-mono">{run.id}</span>
        </h1>
        <StatusBadge status={run.status} />
        <span className="text-sm text-ink-2">
          {formatTime(run.created_at * 1000)} · {run.final ? 'took' : 'running for'} {formatDuration(end - run.created_at * 1000)} ·{' '}
          {run.shard_count} shard{run.shard_count > 1 ? 's' : ''} · {run.target_type}
          {` · ${run.image}`}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {run.mlflow_link && (
            <a href={run.mlflow_link} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost" tabIndex={-1}>
                MLflow <ExternalLink className="size-3.5" aria-hidden />
              </Button>
            </a>
          )}
          {!run.final && (
            <Button size="sm" variant="danger" onClick={() => cancel.mutate(run.id)} disabled={cancel.isPending || run.cancelled}>
              <Ban className="size-4" aria-hidden />
              {run.cancelled ? 'Cancelling…' : 'Cancel'}
            </Button>
          )}
          {run.final && run.status === 'FAILED' && (
            <Button size="sm" onClick={() => retry.mutate(run.id)} disabled={retry.isPending}>
              <RotateCcw className="size-4" aria-hidden />
              Retry failed shards
            </Button>
          )}
          <Button size="sm" onClick={() => navigate(`/runs/new?from=${run.id}`)}>
            <Copy className="size-4" aria-hidden />
            Re-run
          </Button>
          {run.final && (
            <Button
              size="sm"
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete run ${run.id}? Its ${run.target_type === 'kubernetes' ? 'Jobs and pods are' : 'containers are'} removed; MLflow runs are kept.`)) {
                  remove.mutate(run.id, { onSuccess: () => navigate('/runs') })
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </Button>
          )}
        </div>
      </div>
      {run.error && <Alert tone="critical" title="Launch failed">{run.error}</Alert>}
      {run.runtime_error && <Alert tone="critical" title="Runtime unavailable">{run.runtime_error}</Alert>}
      {actionError && <Alert tone="critical" title="Action failed">{actionError.message}</Alert>}
      {(run.config.warnings?.length ?? 0) > 0 && (
        <details className="text-sm text-ink-2">
          <summary className="cursor-pointer hover:text-ink">{run.config.warnings!.length} pre-flight warning(s) at launch</summary>
          <ul className="mt-1 list-disc pl-5">
            {run.config.warnings!.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function MonitorPage() {
  const { runId = '' } = useParams()
  const runQuery = useRun(runId)
  const run = runQuery.data
  const live = run ? !run.final : true
  const overview = useMlflowOverview(runId, live)
  const runtime = useRuntime(runId, live)
  const errors = useErrorReports(runId, live)
  const documents = useDocuments(runId, live)
  const [tab, setTab] = useState('documents')
  const [openShard, setOpenShard] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const final = run?.final ?? false
  const { refresh: refreshDocuments } = documents

  // polling stops once the run is final: fetch everything one last time so
  // the page shows the final totals, not the last poll before completion
  useEffect(() => {
    if (!final) return
    void queryClient.invalidateQueries({ queryKey: ['run', runId] })
    void refreshDocuments()
  }, [final, runId, queryClient, refreshDocuments])

  const totals = overview.data?.totals
  const expected = overview.data?.total_document_count ?? run?.config.document_count ?? null
  const series = useMemo(
    () => withOrigin(totalOverTime(overview.data, 'docs_completed'), run ? run.created_at * 1000 : undefined),
    [overview.data, run],
  )

  if (runQuery.error) {
    return (
      <Alert tone="critical" title="Cannot load run">
        {runQuery.error.message} · <Link to="/runs" className="underline">All runs</Link>
      </Alert>
    )
  }
  if (!run) return <p className="text-sm text-ink-2">Loading…</p>

  const completed = totals?.docs_completed ?? 0
  const errorCount = errors.data?.length

  return (
    <div className={`flex flex-col gap-6 ${overview.isFetching && overview.isPlaceholderData ? 'opacity-80' : ''}`}>
      <RunHeader run={run} />

      <Card>
        <CardBody className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-ink">Progress</p>
            <p className="text-sm text-ink-2 tabular">
              {expected
                ? `${Math.round((completed / expected) * 100)}% · ${formatCount(completed)} of ${formatCount(expected)} documents`
                : `${formatCount(completed)} documents`}
            </p>
          </div>
          <Meter value={completed} max={expected ?? Math.max(completed, 1)} label="Documents completed" />
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Documents done" value={formatCount(completed)} context={expected ? `of ${formatCount(expected)}` : undefined} />
        <StatTile label="Failed documents" value={formatCount(totals?.docs_failed ?? 0)} />
        <StatTile label="Chunks" value={formatCount(totals?.total_chunks ?? 0)} />
        <StatTile
          label="Embeddings"
          value={formatCount(totals?.non_null_embeddings ?? 0)}
          context={totals && totals.total_embeddings > totals.non_null_embeddings ? `${formatCount(totals.total_embeddings - totals.non_null_embeddings)} failed` : undefined}
        />
        <StatTile
          label="Vectors stored"
          value={formatCount(totals?.vectors_stored ?? 0)}
          context={totals?.vectors_upserted ? `${formatCount(totals.vectors_upserted)} upserted` : undefined}
        />
        <StatTile label="Errors" value={formatCount(totals?.error_count ?? 0)} context={totals?.vector_store_retry_count ? `${formatCount(totals.vector_store_retry_count)} store retries` : undefined} />
      </div>

      {overview.error && <Alert tone="critical" title="MLflow unavailable">{overview.error.message}</Alert>}

      <ThroughputChart series={series} startMs={run.created_at * 1000} total={expected} />
      <ShardsTable shardCount={run.shard_count} runtime={run.shards} overview={overview.data} onOpenShard={setOpenShard} />
      <ShardWorkflowDialog runId={run.id} shardIndex={openShard} live={live} onClose={() => setOpenShard(null)} />

      <Card>
        <CardBody>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'documents', label: `Documents (${formatCount(documents.rows.length)})` },
              { id: 'logs', label: 'Logs' },
              { id: 'runtime', label: run.target_type === 'kubernetes' ? 'Pods' : 'Containers' },
              { id: 'errors', label: `Errors${errorCount !== undefined ? ` (${errorCount})` : ''}` },
            ]}
          >
            {tab === 'documents' && (
              <DocumentsPanel rows={documents.rows} completed={completed} final={run.final} error={documents.error} />
            )}
            {tab === 'logs' && <LogViewer runId={run.id} shardCount={run.shard_count} live={live} />}
            {tab === 'runtime' && <RuntimePanel runtime={runtime.data} executor={run.target_type} />}
            {tab === 'errors' && <ErrorsPanel reports={errors.data} />}
          </Tabs>
        </CardBody>
      </Card>
    </div>
  )
}
