import type { Ref } from 'react'
import { Pencil } from 'lucide-react'
import type { ExecutorCapabilities, SettingSchema, SettingsDefaults, Targets } from '@/api/types'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { buildOverrides, settingLabel, usesHostFolder, type RunFormValues, type WizardStep } from '@/lib/settingsForm'

export interface FieldIssue {
  field: string
  message: string
  /** Step to fix it in; target fields are fixed in the side panel. */
  step: WizardStep | null
}

function display(spec: SettingSchema | undefined, value: unknown): string {
  if (spec?.sensitive) return '<secret>'
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-2">{label}</dt>
      <dd className="min-w-0 truncate text-ink" title={value}>
        {value}
      </dd>
    </>
  )
}

export function SummaryStep({
  steps,
  schema,
  defaults,
  values,
  targets,
  capabilities,
  skipped,
  issues,
  status,
  onEdit,
  headingRef,
}: {
  steps: WizardStep[]
  schema: SettingSchema[]
  defaults: SettingsDefaults
  values: RunFormValues
  targets: Targets
  capabilities: ExecutorCapabilities
  skipped: Set<string>
  issues: FieldIssue[]
  status: string | null
  onEdit: (group: string) => void
  headingRef: Ref<HTMLHeadingElement>
}) {
  const byKey = new Map(schema.map((s) => [s.key, s]))
  const overrides = Object.entries(buildOverrides(schema, values.settings, defaults))
  const t = values.target

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold text-ink focus:outline-none">
          Summary
        </h2>
        <p className="mt-0.5 text-sm text-ink-2">Review the job before launching it.</p>
      </div>

      {issues.length > 0 && (
        <Alert tone="critical" title={`${issues.length} field${issues.length > 1 ? 's' : ''} to fix`}>
          <ul className="mt-1 list-disc pl-4">
            {issues.map((issue) => (
              <li key={issue.field}>
                <span className="font-medium text-ink">{settingLabel(issue.field.split('.')[1] ?? issue.field)}:</span>{' '}
                {issue.message}
                {issue.step ? (
                  <button
                    type="button"
                    className="ml-1 text-accent hover:underline"
                    onClick={() => onEdit(issue.step!.group)}
                  >
                    Go to {issue.step.title}
                  </button>
                ) : (
                  issue.field.startsWith('target.') && ' (Target panel)'
                )}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {status && (
        <p className="text-sm text-ink-2" aria-live="polite">
          {status}
        </p>
      )}

      <Card>
        <CardHeader title="Target" description={`Runs on the ${targets.executor.name} executor.`} />
        <CardBody>
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1 text-sm">
            <Row label="Image" value={t.image.trim() || `${targets.default_image} (default)`} />
            {usesHostFolder(values.settings, capabilities) && (
              <Row label="Document folder" value={t.host_folder.trim() || 'not set'} />
            )}
            <Row label="Shards" value={t.shards} />
            <Row label="CPUs per shard" value={t.cpus.trim() || 'unlimited'} />
            <Row label="Memory per shard" value={t.memory.trim() || 'unlimited'} />
          </dl>
        </CardBody>
      </Card>

      {steps.map((step) => {
        const changed = overrides.filter(([key]) => byKey.get(key)?.group === step.group)
        return (
          <Card key={step.group} aria-label={step.title}>
            <CardHeader
              title={step.title}
              description={
                changed.length
                  ? `${changed.length} changed`
                  : skipped.has(step.group)
                    ? "Skipped: the scheduler's defaults"
                    : "The scheduler's defaults"
              }
              actions={
                <Button size="sm" variant="ghost" onClick={() => onEdit(step.group)} aria-label={`Edit ${step.title}`}>
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Button>
              }
              className={changed.length ? undefined : 'pb-4'}
            />
            {changed.length > 0 && (
              <CardBody>
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1 text-sm">
                  {changed.map(([key, value]) => (
                    <Row key={key} label={settingLabel(key)} value={display(byKey.get(key), value)} />
                  ))}
                </dl>
              </CardBody>
            )}
          </Card>
        )
      })}
    </div>
  )
}
