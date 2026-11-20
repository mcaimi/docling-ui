import { Fragment, type ReactNode } from 'react'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { useShardWorkflow } from '@/api/queries'
import type { DocumentStageKey, ShardWorkflow, WorkflowStage, WorkflowStatus, WorkflowStep, WorkflowStepKey } from '@/api/types'
import { Alert } from '@/components/ui/alert'
import { Dialog } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/StatusBadge'
import { Table, Td, Th } from '@/components/ui/table'
import { formatCount, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

const STEP_LABELS: Record<WorkflowStepKey, { label: string; what: string }> = {
  prompt_extraction: { label: 'Prompt extraction', what: 'Reads setting overrides from the user prompt' },
  discovery: { label: 'Document discovery', what: "Lists this shard's documents" },
  pipeline: { label: 'Document pipeline', what: 'Converts, chunks, embeds and stores each document' },
  aggregation: { label: 'Results aggregation', what: 'Merges results and writes the error report' },
}

const STAGE_LABELS: Record<DocumentStageKey, string> = {
  convert_pdf: 'Convert',
  chunk_doc: 'Chunk',
  embed_doc: 'Embed',
  store_doc: 'Store',
}

const STATUS_RING: Record<WorkflowStatus, string> = {
  ok: 'ring-line',
  pending: 'ring-line opacity-75',
  skipped: 'ring-line opacity-75',
  running: 'ring-2 ring-accent',
  error: 'ring-2 ring-critical',
}

const stepLabel = (step: WorkflowStep) => STEP_LABELS[step.key]?.label ?? step.name

/** One sentence on where the shard is. */
export function workflowSummary(workflow: ShardWorkflow): string {
  if (!workflow.run_id) return 'Not started: the shard has no MLflow run yet.'
  const { completed, failed, total } = workflow.documents
  const docs = `${formatCount(completed)}${total !== null ? ` of ${formatCount(total)}` : ''} documents processed${failed ? `, ${formatCount(failed)} failed` : ''}`
  const failedStep = workflow.steps.find((s) => s.status === 'error')
  if (failedStep) return `Stopped at ${stepLabel(failedStep)}${failedStep.error ? `: ${failedStep.error}` : ''} · ${docs}.`
  const running = workflow.steps.find((s) => s.status === 'running')
  if (running) return `${stepLabel(running)} in progress · ${docs}.`
  if (workflow.steps.every((s) => s.status === 'ok')) return `All steps finished · ${docs}.`
  return `Waiting for traces · ${docs}.`
}

function Node({ status, title, children, className }: { status: WorkflowStatus; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-1.5 rounded-md bg-surface p-3 ring-1', STATUS_RING[status], className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{title}</p>
        <StatusBadge status={status} />
      </div>
      {children}
    </div>
  )
}

/** Nodes left to right (top to bottom on narrow screens), joined by arrows. */
function Flow({ label, items }: { label: string; items: { key: string; node: ReactNode }[] }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-2 md:flex-row">
      {items.map(({ key, node }, index) => (
        <Fragment key={key}>
          {index > 0 && (
            <li aria-hidden className="flex items-center justify-center">
              <ChevronRight className="size-4 rotate-90 text-muted md:rotate-0" />
            </li>
          )}
          <li className="flex min-w-0 flex-1">{node}</li>
        </Fragment>
      ))}
    </ol>
  )
}

function StepNode({ step, workflow }: { step: WorkflowStep; workflow: ShardWorkflow }) {
  const { completed, failed, total } = workflow.documents
  return (
    <Node status={step.status} title={stepLabel(step)}>
      <p className="text-xs text-ink-2">{STEP_LABELS[step.key]?.what}</p>
      {step.key === 'discovery' && total !== null && <p className="text-xs text-ink tabular">{formatCount(total)} documents</p>}
      {step.key === 'pipeline' && step.status !== 'pending' && (
        <p className="text-xs text-ink tabular">
          {formatCount(completed)}
          {total !== null && ` / ${formatCount(total)}`} done{failed > 0 && ` · ${formatCount(failed)} failed`}
        </p>
      )}
      {step.duration_ms !== null && <p className="text-xs text-muted tabular">took {formatDuration(step.duration_ms)}</p>}
      {step.error && <p className="text-xs break-words text-critical-text">{step.error}</p>}
    </Node>
  )
}

function StageNode({ stage }: { stage: WorkflowStage }) {
  return (
    <Node status={stage.status} title={STAGE_LABELS[stage.key] ?? stage.key}>
      <p className="text-xs text-ink tabular">
        {formatCount(stage.ok)} ok{stage.failed > 0 && <span className="text-critical-text"> · {formatCount(stage.failed)} failed</span>}
      </p>
      <p className="text-xs text-muted tabular">{stage.avg_ms !== null ? `avg ${formatDuration(stage.avg_ms)}` : '—'}</p>
    </Node>
  )
}

function WorkflowGraph({ workflow }: { workflow: ShardWorkflow }) {
  const pipeline = workflow.steps.find((s) => s.key === 'pipeline')
  return (
    <div className="flex flex-col gap-3">
      <Flow label="Workflow steps" items={workflow.steps.map((step) => ({ key: step.key, node: <StepNode step={step} workflow={workflow} /> }))} />
      {pipeline?.stages && (
        <section aria-label="Document pipeline stages" className="rounded-md bg-surface-2 p-3">
          <p className="mb-2 text-xs text-ink-2">Each document, in parallel · counts cover finished documents</p>
          <Flow label="Stages" items={pipeline.stages.map((stage) => ({ key: stage.key, node: <StageNode stage={stage} /> }))} />
        </section>
      )}
    </div>
  )
}

function RecentDocuments({ documents }: { documents: ShardWorkflow['recent_documents'] }) {
  if (documents.length === 0) return <p className="text-sm text-muted">No finished documents yet.</p>
  return (
    <Table aria-label="Recent documents">
      <thead>
        <tr>
          <Th>Document</Th>
          <Th>Status</Th>
          {Object.values(STAGE_LABELS).map((label) => (
            <Th key={label} className="text-right">
              {label}
            </Th>
          ))}
          <Th className="text-right">Total</Th>
        </tr>
      </thead>
      <tbody>
        {documents.map((doc) => (
          <tr key={doc.trace_id}>
            <Td className="max-w-64 truncate" title={doc.error ?? doc.file ?? undefined}>
              {doc.file ?? doc.trace_id}
              {doc.stage_failed && (
                <span className="block truncate text-xs text-critical-text">
                  {doc.stage_failed}: {doc.error}
                </span>
              )}
            </Td>
            <Td>
              <StatusBadge status={doc.status} />
            </Td>
            {(Object.keys(STAGE_LABELS) as DocumentStageKey[]).map((key) => (
              <Td key={key} className="text-right text-xs text-ink-2 tabular">
                {formatDuration(doc.stages_ms[key] ?? null)}
              </Td>
            ))}
            <Td className="text-right text-xs tabular">{formatDuration(doc.duration_ms)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function ShardWorkflowDialog({
  runId,
  shardIndex,
  live,
  onClose,
}: {
  runId: string
  shardIndex: number | null
  live: boolean
  onClose: () => void
}) {
  const query = useShardWorkflow(runId, shardIndex, live)
  const workflow = query.data
  return (
    <Dialog
      open={shardIndex !== null}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          Shard {shardIndex} workflow
          {workflow?.run_status && <StatusBadge status={workflow.run_status} />}
        </span>
      }
      description={workflow ? `${workflowSummary(workflow)}${workflow.attempts > 1 ? ` Attempt ${workflow.attempts}.` : ''}` : undefined}
      actions={
        workflow?.link && (
          <a href={workflow.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
            MLflow <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )
      }
    >
      {query.error && <Alert tone="critical" title="Cannot load the workflow">{query.error.message}</Alert>}
      {!workflow && !query.error && <p className="text-sm text-ink-2">Loading traces…</p>}
      {workflow && (
        <>
          <WorkflowGraph workflow={workflow} />
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Latest documents</h3>
            <RecentDocuments documents={workflow.recent_documents} />
          </div>
          <p className="text-xs text-muted">
            From the MLflow traces of the shard's latest run. A step's trace is written when it ends, so a running step is inferred from the steps before it.
          </p>
        </>
      )}
    </Dialog>
  )
}
