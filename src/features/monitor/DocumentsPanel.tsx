import { useMemo, useState } from 'react'
import type { DocumentRow } from '@/api/types'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { StageBar, StageLegend, STAGES } from '@/components/StageBar'
import { StatusBadge } from '@/components/StatusBadge'
import { Table, Td, Th } from '@/components/ui/table'
import { formatCount, formatDuration } from '@/lib/format'

type Filter = 'all' | 'errors' | 'partial'
const PAGE = 200

function rowStatus(row: DocumentRow): string {
  if (row.status === 'ERROR') return 'ERROR'
  if (row.embedding_failed) return 'PARTIAL'
  return row.status
}

export function DocumentsPanel({
  rows,
  completed,
  final,
  error,
}: {
  rows: DocumentRow[]
  completed: number
  final: boolean
  error: Error | null
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [numbers, setNumbers] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  const filtered = useMemo(() => {
    const newestFirst = [...rows].reverse()
    if (filter === 'errors') return newestFirst.filter((r) => r.status === 'ERROR')
    if (filter === 'partial') return newestFirst.filter((r) => r.embedding_failed)
    return newestFirst
  }, [rows, filter])
  const scaleMs = useMemo(() => Math.max(0, ...rows.map((r) => r.duration_ms ?? 0)), [rows])
  const missing = final ? completed - rows.length : 0

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="critical" title="Cannot load documents">{error.message}</Alert>}
      {missing > 0 && (
        <Alert tone="warning" title={`${missing} completed document${missing > 1 ? 's have' : ' has'} no trace`}>
          MLflow dropped their traces, so they are counted in the totals but missing here.
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Show
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="w-40">
            <option value="all">All documents</option>
            <option value="errors">Errors</option>
            <option value="partial">Partial embeddings</option>
          </Select>
        </label>
        <StageLegend className="ml-auto" />
        <Button size="sm" variant="ghost" onClick={() => setNumbers((v) => !v)} aria-pressed={numbers}>
          {numbers ? 'Stage bars' : 'Stage times as numbers'}
        </Button>
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-2">
          {rows.length === 0 ? 'Documents appear here as they finish.' : 'No documents match this filter.'}
        </p>
      ) : (
        <Table aria-label="Documents">
          <thead>
            <tr>
              <Th>File</Th>
              <Th className="text-right">Shard</Th>
              <Th>Status</Th>
              <Th className="text-right">Chunks</Th>
              <Th className="text-right">Stored</Th>
              <Th className="text-right">Duration</Th>
              {numbers ? (
                STAGES.map((s) => (
                  <Th key={s.key} className="text-right">
                    {s.label}
                  </Th>
                ))
              ) : (
                <Th>Stages</Th>
              )}
              <Th>Error</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((row) => (
              <tr key={row.seq}>
                <Td className="max-w-56 truncate font-medium" title={row.file ?? undefined}>
                  {row.file ?? '—'}
                </Td>
                <Td className="text-right tabular">{row.shard_index ?? '—'}</Td>
                <Td>
                  <StatusBadge status={rowStatus(row)} />
                </Td>
                <Td className="text-right tabular">{formatCount(row.chunk_count)}</Td>
                <Td className="text-right tabular">{formatCount(row.stored_count)}</Td>
                <Td className="text-right tabular">{formatDuration(row.duration_ms)}</Td>
                {numbers ? (
                  STAGES.map((s) => (
                    <Td key={s.key} className="text-right tabular">
                      {formatDuration(row.stages_ms[s.key])}
                    </Td>
                  ))
                ) : (
                  <Td>
                    <StageBar stages={row.stages_ms} scaleMs={scaleMs} />
                  </Td>
                )}
                <Td className="max-w-72 truncate text-ink-2" title={row.error ?? undefined}>
                  {row.stage_failed ? `${row.stage_failed}: ` : ''}
                  {row.error ?? ''}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {filtered.length > limit && (
        <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)} className="self-center">
          Show {Math.min(PAGE, filtered.length - limit)} more
        </Button>
      )}
    </div>
  )
}
