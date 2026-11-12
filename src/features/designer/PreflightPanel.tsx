import type { Preflight } from '@/api/types'
import { Alert } from '@/components/ui/alert'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Table, Td, Th } from '@/components/ui/table'
import { formatCount } from '@/lib/format'

function fieldLabel(field: string): string {
  const [scope, key] = field.split('.')
  if (!key) return scope ?? field
  return `${scope === 'target' ? 'Target' : 'Setting'} · ${key.replace(/_/g, ' ')}`
}

export function PreflightPanel({ report, stale }: { report: Preflight; stale: boolean }) {
  const c = report.concurrency
  return (
    <Card aria-live="polite">
      <CardHeader
        title="Pre-flight"
        description={
          stale
            ? 'Inputs changed since this check. Validate again to launch.'
            : report.ok
              ? 'Ready to launch.'
              : 'Fix the errors below.'
        }
      />
      <CardBody className="flex flex-col gap-3">
        {report.errors.length > 0 && (
          <Alert tone="critical" title={`${report.errors.length} error${report.errors.length > 1 ? 's' : ''}`}>
            <ul className="mt-1 list-disc pl-4">
              {report.errors.map((e) => (
                <li key={`${e.field}-${e.message}`}>
                  <span className="font-medium text-ink">{fieldLabel(e.field)}:</span> {e.message}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        {report.warnings.length > 0 && (
          <Alert tone="warning" title={`${report.warnings.length} warning${report.warnings.length > 1 ? 's' : ''}`}>
            <ul className="mt-1 list-disc pl-4">
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Alert>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-2">Documents</dt>
          <dd className="text-right text-ink tabular">{formatCount(report.document_count)}</dd>
          <dt className="text-ink-2">Documents in flight</dt>
          <dd className="text-right text-ink tabular">
            {c.total_concurrent_documents === null ? 'automatic' : formatCount(c.total_concurrent_documents)}
          </dd>
          {c.vector_store_write_workers !== null && (
            <>
              <dt className="text-ink-2">Vector store writers</dt>
              <dd className="text-right text-ink tabular">{formatCount(c.vector_store_write_workers)}</dd>
            </>
          )}
        </dl>
        {report.shard_plan.length > 1 && (
          <Table aria-label="Shard plan">
            <thead>
              <tr>
                <Th>Shard</Th>
                <Th className="text-right">Documents</Th>
                <Th>First files</Th>
              </tr>
            </thead>
            <tbody>
              {report.shard_plan.map((s) => (
                <tr key={s.shard_index}>
                  <Td className="tabular">{s.shard_index}</Td>
                  <Td className="text-right tabular">{s.document_count}</Td>
                  <Td className="max-w-48 truncate text-ink-2" title={s.documents.join(', ')}>
                    {s.documents.slice(0, 3).join(', ')}
                    {s.documents.length > 3 ? ', …' : ''}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-2 hover:text-ink">Launch preview</summary>
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-ink-2">
              {report.preview.executor} · {report.preview.image}
              {report.preview.mount && ` · ${report.preview.mount.source} → ${report.preview.mount.target} (read-only)`}
            </p>
            <pre className="max-h-64 overflow-auto rounded-md bg-surface-2 p-2 text-xs text-ink">
              {Object.entries(report.preview.env)
                .map(([k, v]) => `${k}=${v}`)
                .join('\n')}
              {Object.keys(report.preview.secret_env).length > 0 &&
                '\n' +
                  Object.keys(report.preview.secret_env)
                    .map((k) => `${k}=<secret>`)
                    .join('\n')}
            </pre>
          </div>
        </details>
      </CardBody>
    </Card>
  )
}
