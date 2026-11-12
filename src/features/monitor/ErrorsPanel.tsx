import type { ErrorReport } from '@/api/types'
import { Table, Td, Th } from '@/components/ui/table'
import { basename } from '@/lib/format'

const STAGES: { key: string; title: string; note?: string }[] = [
  { key: 'pipeline', title: 'Pipeline', note: 'Nothing was stored for these documents.' },
  { key: 'vector_store', title: 'Vector store', note: 'Chunks were embedded but not stored.' },
  { key: 'embedding', title: 'Embedding', note: 'Partial and non-blocking: the other chunks were embedded and stored.' },
]

export function ErrorsPanel({ reports }: { reports: ErrorReport[] | undefined }) {
  if (!reports) return <p className="text-sm text-ink-2">Loading…</p>
  if (reports.length === 0) return <p className="py-8 text-center text-sm text-ink-2">No errors reported.</p>
  const known = new Set(STAGES.map((s) => s.key))
  const groups = [...STAGES, ...[...new Set(reports.map((r) => r.stage))].filter((s) => !known.has(s)).map((key) => ({ key, title: key, note: undefined }))]
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const items = reports.filter((r) => r.stage === group.key)
        if (!items.length) return null
        return (
          <section key={group.key}>
            <h3 className="text-sm font-semibold">
              {group.title} <span className="font-normal text-ink-2">({items.length})</span>
            </h3>
            {group.note && <p className="mb-2 text-xs text-ink-2">{group.note}</p>}
            <Table aria-label={`${group.title} errors`}>
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th className="text-right">Shard</Th>
                  <Th>Error</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={`${r.path}-${i}`}>
                    <Td className="font-medium" title={r.path}>
                      {basename(r.path)}
                    </Td>
                    <Td className="text-right tabular">{r.shard_index}</Td>
                    <Td className="text-ink-2">{r.error}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        )
      })}
    </div>
  )
}
