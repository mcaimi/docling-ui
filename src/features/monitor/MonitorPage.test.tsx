import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setToken } from '@/lib/token'
import { mockApi, renderAt } from '@/test/utils'
import { MonitorPage } from './MonitorPage'

// Recharts measures its container; jsdom has no layout.
vi.mock('recharts', async (original) => ({
  ...(await original<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 200 }}>{children}</div>,
}))

const run = {
  id: 'abc123', created_at: 1_700_000_000, target_type: 'podman', image: 'localhost/docling-agent:latest', shard_count: 2,
  mlflow_experiment_id: '1', mlflow_parent_run_id: 'p', config: { document_count: 5, warnings: ['w1'] },
  status: 'FAILED', final: true, cancelled: false, error: null, finished_at: 1_700_000_090,
  runtime_error: null, mlflow_link: 'http://mlflow/#/runs/p',
  shards: [
    { shard_index: 0, attempt: 0, container_id: 'c0', name: 'n0', state: 'exited', exit_code: 0, oom_killed: false, started_at: null, finished_at: null, error: null },
    { shard_index: 1, attempt: 0, container_id: 'c1', name: 'n1', state: 'exited', exit_code: 137, oom_killed: true, started_at: null, finished_at: null, error: null },
  ],
}
const totals = { docs_completed: 3, docs_failed: 1, total_chunks: 12, total_embeddings: 12, non_null_embeddings: 10, vectors_stored: 0, vectors_upserted: 0, vector_store_retry_count: 0, failed_chunk_count: 0, error_count: 2, vector_store_error_count: 0 }
const overview = {
  parent: { run_id: 'p', status: 'FAILED', start_time: 0, end_time: 1, link: null }, session_id: 'p', totals,
  total_document_count: 5, progress: 0.6,
  shards: [
    { shard_index: 0, run_id: 'r0', status: 'FINISHED', attempts: 1, document_count: 3, metrics: { docs_completed: 3, total_chunks: 12, error_count: 2 }, link: null },
    { shard_index: 1, run_id: 'r1', status: 'FAILED', attempts: 1, document_count: 2, metrics: { docs_completed: 0 }, link: null },
  ],
  history: { '0': { docs_completed: [[1, 1, 1_700_000_010_000], [3, 3, 1_700_000_050_000]] } },
}
const documents = {
  generation: 'g', last_seq: 2, total: 2,
  rows: [
    { seq: 1, trace_id: 't1', file: 'a.md', file_format: '.md', shard_index: 0, status: 'OK', stage_failed: null, error: null, chunk_count: 6, stored_count: 0, embedding_failed: true, started_at_ms: 0, duration_ms: 1200, stages_ms: { convert_pdf: 800, chunk_doc: 100, embed_doc: 300 } },
    { seq: 2, trace_id: 't2', file: 'broken.pdf', file_format: '.pdf', shard_index: 0, status: 'ERROR', stage_failed: 'convert', error: 'bad pdf', chunk_count: null, stored_count: null, embedding_failed: null, started_at_ms: 0, duration_ms: 50, stages_ms: { convert_pdf: 50 } },
  ],
}

describe('MonitorPage', () => {
  it('renders status, KPIs, shards, documents and errors', async () => {
    setToken('t')
    mockApi({
      'GET /api/runs/abc123': run,
      'GET /api/runs/abc123/mlflow': overview,
      'GET /api/runs/abc123/documents': documents,
      'GET /api/runs/abc123/runtime': { error: null, containers: run.shards, events: [], resources: [] },
      'GET /api/runs/abc123/errors': [
        { path: '/d/broken.pdf', error: 'bad pdf', stage: 'pipeline', shard_index: 0 },
        { path: '/d/a.md', error: '1/6 chunks failed', stage: 'embedding', shard_index: 0 },
      ],
    })
    renderAt(<MonitorPage />, { path: '/runs/:runId', route: '/runs/abc123' })

    expect(await screen.findByText('abc123')).toBeInTheDocument()
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0)
    expect(await screen.findByText('60% · 3 of 5 documents')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry failed shards/ })).toBeInTheDocument()

    const shards = screen.getByRole('table', { name: 'Shards' })
    expect(within(shards).getByText('OOM killed')).toBeInTheDocument()
    expect(within(shards).getByText('Exited 0')).toBeInTheDocument()

    const docs = await screen.findByRole('table', { name: 'Documents' })
    expect(within(docs).getByText('broken.pdf')).toBeInTheDocument()
    expect(within(docs).getByText('Partial')).toBeInTheDocument()
    expect(within(docs).getByText('convert: bad pdf')).toBeInTheDocument()
    // 3 completed, 2 traced -> one dropped trace flagged
    expect(screen.getByText(/1 completed document has no trace/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Stage times as numbers' }))
    expect(within(docs).getByText('800 ms')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Errors/ }))
    expect(screen.getByText(/Partial and non-blocking/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Pipeline errors' })).toBeInTheDocument()
  })

  it('opens a shard workflow popup from the shard id', async () => {
    setToken('t')
    const workflow = {
      shard_index: 1, run_id: 'r1', run_status: 'FAILED', attempts: 2, link: 'http://mlflow/#/runs/r1',
      documents: { total: 2, completed: 1, failed: 1 },
      steps: [
        { key: 'prompt_extraction', name: 'NLP prompt extraction', status: 'ok', started_at_ms: 0, duration_ms: 20, error: null },
        { key: 'discovery', name: 'document discovery', status: 'ok', started_at_ms: 0, duration_ms: 40, error: null },
        {
          key: 'pipeline', name: 'Parallel pipeline', status: 'error', started_at_ms: null, duration_ms: null,
          error: 'interrupted: the shard exited before this step finished',
          stages: [
            { key: 'convert_pdf', status: 'error', ok: 1, failed: 1, avg_ms: 900 },
            { key: 'chunk_doc', status: 'ok', ok: 1, failed: 0, avg_ms: 100 },
            { key: 'embed_doc', status: 'ok', ok: 1, failed: 0, avg_ms: 300 },
            { key: 'store_doc', status: 'skipped', ok: 0, failed: 0, avg_ms: null },
          ],
        },
        { key: 'aggregation', name: 'Results aggregation', status: 'pending', started_at_ms: null, duration_ms: null, error: null },
      ],
      recent_documents: [
        { trace_id: 't9', file: 'scan.pdf', status: 'ERROR', stage_failed: 'convert', error: 'bad pdf', duration_ms: 60, stages_ms: { convert_pdf: 60 } },
      ],
    }
    const calls = mockApi({
      'GET /api/runs/abc123': run,
      'GET /api/runs/abc123/mlflow': overview,
      'GET /api/runs/abc123/documents': documents,
      'GET /api/runs/abc123/runtime': { error: null, containers: run.shards, events: [], resources: [] },
      'GET /api/runs/abc123/errors': [],
      'GET /api/runs/abc123/shards/1/workflow': workflow,
    })
    renderAt(<MonitorPage />, { path: '/runs/:runId', route: '/runs/abc123' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Show shard 1 workflow' }))

    const dialog = await screen.findByRole('dialog', { name: /Shard 1 workflow/ })
    expect(calls.some((c) => c.url === '/api/runs/abc123/shards/1/workflow')).toBe(true)
    expect(await within(dialog).findByText(/Stopped at Document pipeline: interrupted/)).toBeInTheDocument()
    const steps = within(dialog).getByRole('list', { name: 'Workflow steps' })
    expect(within(steps).getByText('Document discovery')).toBeInTheDocument()
    expect(within(steps).getByText('2 documents')).toBeInTheDocument()
    const stages = within(dialog).getByRole('list', { name: 'Stages' })
    expect(within(stages).getByText('1 failed', { exact: false })).toBeInTheDocument()
    expect(within(stages).getByText('Skipped')).toBeInTheDocument()
    expect(within(dialog).getByRole('table', { name: 'Recent documents' })).toHaveTextContent('convert: bad pdf')

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
