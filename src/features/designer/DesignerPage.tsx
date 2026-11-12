import { useEffect, useMemo, useState } from 'react'
import { FormProvider, useForm, useWatch, type Path, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Rocket, ShieldCheck } from 'lucide-react'
import { ApiError, apiFetch } from '@/api/client'
import { useLaunch, useSettingsDefaults, useSettingsSchema, useTargets, useValidate } from '@/api/queries'
import type { Preflight, RunRecord, RunRequest, SettingSchema, SettingsDefaults, Targets } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import {
  buildRunFormSchema,
  buildRunRequest,
  defaultSettingValues,
  formValuesFromRun,
  groupSettings,
  isChanged,
  isVisible,
  type RunFormValues,
} from '@/lib/settingsForm'
import { executorCapabilities } from '@/lib/executor'
import { PreflightPanel } from './PreflightPanel'
import { SettingField } from './SettingField'
import { TargetPanel } from './TargetPanel'

const OPEN_GROUPS = new Set(['prompt', 'chunking', 'embeddings', 'vector_store'])

export function DesignerPage() {
  const schema = useSettingsSchema()
  const defaults = useSettingsDefaults()
  const targets = useTargets()
  const [params] = useSearchParams()
  const fromRun = params.get('from')
  const [source, setSource] = useState<RunRecord | null | undefined>(fromRun ? undefined : null)

  useEffect(() => {
    if (!fromRun) return
    apiFetch<RunRecord>(`/api/runs/${encodeURIComponent(fromRun)}`)
      .then(setSource)
      .catch(() => setSource(null))
  }, [fromRun])

  const error = schema.error ?? defaults.error ?? targets.error
  if (error) return <Alert tone="critical" title="Cannot load the run designer">{error.message}</Alert>
  if (!schema.data || !defaults.data || !targets.data || source === undefined) {
    return <p className="text-sm text-ink-2">Loading…</p>
  }
  return <DesignerForm schema={schema.data} defaults={defaults.data} targets={targets.data} source={source} />
}

function DesignerForm({
  schema,
  defaults,
  targets,
  source,
}: {
  schema: SettingSchema[]
  defaults: SettingsDefaults
  targets: Targets
  source: RunRecord | null
}) {
  const navigate = useNavigate()
  const executorType = targets.executor.name
  const capabilities = executorCapabilities(targets)
  const initial = useMemo<RunFormValues>(
    () =>
      source?.config.target
        ? formValuesFromRun(schema, defaults, source.config.overrides ?? {}, source.config.target, executorType)
        : {
            settings: defaultSettingValues(schema, defaults),
            target: { type: executorType, image: '', host_folder: '', shards: '1', cpus: '', memory: '' },
          },
    [schema, defaults, source, executorType],
  )
  const form = useForm<RunFormValues>({
    defaultValues: initial,
    // the zod schema is built from the runtime settings schema, so its inferred
    // type is looser than RunFormValues
    resolver: zodResolver(buildRunFormSchema(schema, capabilities)) as unknown as Resolver<RunFormValues>,
    mode: 'onChange',
  })
  const validate = useValidate()
  const launch = useLaunch()
  const [report, setReport] = useState<Preflight | null>(null)
  const [validatedRequest, setValidatedRequest] = useState<string | null>(null)
  const values = useWatch({ control: form.control }) as RunFormValues
  const currentRequest = JSON.stringify(buildRunRequest(schema, values, defaults, capabilities))
  const stale = report !== null && validatedRequest !== currentRequest
  const byKey = useMemo(() => new Map(schema.map((s) => [s.key, s])), [schema])
  const groups = useMemo(() => groupSettings(schema), [schema])

  const applyServerErrors = (preflight: Preflight) => {
    for (const e of preflight.errors) {
      if (e.field.startsWith('settings.') || e.field.startsWith('target.')) {
        form.setError(e.field as Path<RunFormValues>, { type: 'server', message: e.message })
      }
    }
  }

  const onValidate = form.handleSubmit(async (formValues) => {
    const request: RunRequest = buildRunRequest(schema, formValues, defaults, capabilities)
    const result = await validate.mutateAsync(request)
    setReport(result)
    setValidatedRequest(JSON.stringify(request))
    applyServerErrors(result)
  })

  const onLaunch = async () => {
    if (!validatedRequest) return
    try {
      const run = await launch.mutateAsync(JSON.parse(validatedRequest) as RunRequest)
      navigate(`/runs/${run.id}`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.body && typeof e.body === 'object' && 'errors' in e.body) {
        const preflight = e.body as Preflight
        setReport(preflight)
        applyServerErrors(preflight)
      }
    }
  }

  const failure = validate.error ?? (launch.error instanceof ApiError && launch.error.status === 400 ? null : launch.error)

  return (
    <FormProvider {...form}>
      <form onSubmit={onValidate} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" noValidate>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold">New run</h1>
            <p className="text-sm text-ink-2">
              {source ? `Based on run ${source.id}. ` : ''}Defaults come from the scheduler's .env; only changed settings
              are sent.
            </p>
          </div>
          {groups.map(({ group, title, settings }) => {
            const visible = settings.filter((s) => isVisible(s, values.settings ?? {}, byKey))
            if (!visible.length) return null
            const changed = visible.filter((s) => isChanged(s, values.settings?.[s.key], defaults)).length
            return (
              <details key={group} open={OPEN_GROUPS.has(group) || changed > 0} className="group rounded-lg bg-surface ring-1 ring-line">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
                  {title}
                  {changed > 0 && <span className="text-xs font-normal text-ink-2">{changed} changed</span>}
                </summary>
                <div className="grid gap-4 border-t border-grid p-4 sm:grid-cols-2">
                  {visible.map((spec) => (
                    <div key={spec.key} className={spec.type === 'json' || spec.key === 'user_prompt' ? 'sm:col-span-2' : undefined}>
                      <SettingField spec={spec} defaults={defaults} />
                    </div>
                  ))}
                </div>
              </details>
            )
          })}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <TargetPanel targets={targets} />
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" className="flex-1" disabled={validate.isPending}>
              <ShieldCheck className="size-4" aria-hidden />
              {validate.isPending ? 'Validating…' : 'Validate'}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={onLaunch}
              disabled={!report?.ok || stale || launch.isPending}
            >
              <Rocket className="size-4" aria-hidden />
              {launch.isPending ? 'Launching…' : 'Launch'}
            </Button>
          </div>
          {failure && (
            <Alert tone="critical" title="Request failed">
              {failure.message}
            </Alert>
          )}
          {report && <PreflightPanel report={report} stale={stale} />}
        </aside>
      </form>
    </FormProvider>
  )
}
