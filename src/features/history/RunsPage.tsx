import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useRuns } from '@/api/queries'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { StatusBadge } from '@/components/StatusBadge'
import { Table, Td, Th } from '@/components/ui/table'
import { formatCount, formatDuration, formatTime } from '@/lib/format'

const STATUSES = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SUBMIT_FAILED', 'UNKNOWN']

export function RunsPage() {
  const [status, setStatus] = useState('')
  const runs = useRuns(status || undefined)
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Runs</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-2">
          Status
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace('_', ' ')}
              </option>
            ))}
          </Select>
        </label>
        <Link to="/runs/new">
          <Button variant="primary" tabIndex={-1}>
            <Plus className="size-4" aria-hidden />
            New run
          </Button>
        </Link>
      </div>
      {runs.error && <Alert tone="critical" title="Cannot load runs">{runs.error.message}</Alert>}
      <Card>
        {runs.data && runs.data.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-2">
            No runs yet. <Link to="/runs/new" className="text-ink underline">Start one</Link>.
          </p>
        ) : (
          <Table aria-label="Runs">
            <thead>
              <tr>
                <Th>Run</Th>
                <Th>Started</Th>
                <Th>Status</Th>
                <Th>Executor</Th>
                <Th className="text-right">Shards</Th>
                <Th className="text-right">Documents</Th>
                <Th className="text-right">Duration</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {(runs.data ?? []).map((run) => (
                <tr key={run.id} className="hover:bg-surface-2">
                  <Td>
                    <Link to={`/runs/${run.id}`} className="font-mono font-medium text-ink hover:underline">
                      {run.id}
                    </Link>
                  </Td>
                  <Td className="text-ink-2">{formatTime(run.created_at * 1000)}</Td>
                  <Td>
                    <StatusBadge status={run.status} />
                  </Td>
                  <Td className="text-ink-2">{run.target_type}</Td>
                  <Td className="text-right tabular">{run.shard_count}</Td>
                  <Td className="text-right tabular">{formatCount(run.config.document_count ?? null)}</Td>
                  <Td className="text-right tabular">
                    {run.finished_at ? formatDuration((run.finished_at - run.created_at) * 1000) : '—'}
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/runs/new?from=${run.id}`)}>
                      Re-run
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
