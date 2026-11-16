import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FormProvider, useForm, useWatch, type Path, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Rocket, ShieldCheck, SkipForward } from 'lucide-react'
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
  groupDefaults,
  groupSettings,
  isChanged,
  stepFieldPaths,
  stepForField,
  wizardSteps,
  type RunFormValues,
} from '@/lib/settingsForm'
import { executorCapabilities } from '@/lib/executor'
import { PreflightPanel } from './PreflightPanel'
import { SettingsStep } from './SettingsStep'
import { Stepper, type StepStatus } from './Stepper'
import { SummaryStep, type FieldIssue } from './SummaryStep'
import { TargetPanel } from './TargetPanel'

const SUMMARY = 'summary'

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
  const settings = values.settings ?? {}
  const currentRequest = JSON.stringify(buildRunRequest(schema, values, defaults, capabilities))
  const stale = report !== null && validatedRequest !== currentRequest
  const byKey = useMemo(() => new Map(schema.map((s) => [s.key, s])), [schema])
  const groupOrder = useMemo(() => groupSettings(schema).map((g) => g.group), [schema])

  // wizard: one step per visible settings group, then the summary
  const steps = wizardSteps(schema, settings)
  const order = [...steps.map((s) => s.group), SUMMARY]
  const [active, setActive] = useState(order[0]!)
  const index = Math.max(0, order.indexOf(active))
  const activeKey = order[index]!
  const step = steps[index]
  const [direction, setDirection] = useState<'next' | 'back'>('next')
  // a re-run starts from a complete configuration, so every step is reachable
  const [visited, setVisited] = useState<Set<string>>(() => new Set(source ? order : [order[0]!]))
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set())
  const [blocked, setBlocked] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)

  const goTo = (key: string) => {
    setDirection(order.indexOf(key) < index ? 'back' : 'next')
    setActive(key)
    setVisited((v) => new Set(v).add(key))
    setBlocked(false)
  }

  // the step after `group`, from the settings as they are now (they decide which steps exist)
  const stepAfter = (group: string) => {
    const position = groupOrder.indexOf(group)
    return wizardSteps(schema, form.getValues('settings')).find((s) => groupOrder.indexOf(s.group) > position)?.group ?? SUMMARY
  }

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    headingRef.current?.focus()
  }, [activeKey])

  const issues: FieldIssue[] = [
    ...Object.entries(form.formState.errors.settings ?? {}).map(([key, e]) => ({
      field: `settings.${key}`,
      message: String(e?.message ?? 'Invalid value'),
      step: steps.find((s) => s.group === byKey.get(key)?.group) ?? null,
    })),
    ...Object.entries(form.formState.errors.target ?? {}).map(([key, e]) => ({
      field: `target.${key}`,
      message: String((e as { message?: string } | undefined)?.message ?? 'Invalid value'),
      step: null,
    })),
  ]
  const statuses: StepStatus[] = [
    ...steps.map((s) => ({
      key: s.group,
      title: s.title,
      visited: visited.has(s.group),
      skipped: skipped.has(s.group),
      changed: s.settings.filter((spec) => isChanged(spec, settings[spec.key], defaults)).length,
      errors: issues.filter((i) => i.step?.group === s.group).length,
    })),
    { key: SUMMARY, title: 'Summary', visited: visited.has(SUMMARY), skipped: false, changed: 0, errors: 0 },
  ]

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

  // arriving at the summary runs the pre-flight checks, unless they're current
  useEffect(() => {
    if (activeKey === SUMMARY && (report === null || stale)) void onValidate()
  }, [activeKey])

  const onNext = async () => {
    if (!step) return
    const ok = await form.trigger(stepFieldPaths(step, settings, capabilities) as Path<RunFormValues>[])
    if (!ok) {
      setBlocked(true)
      return
    }
    goTo(stepAfter(step.group))
  }

  const onSkip = () => {
    if (!step) return
    const reset = groupDefaults(schema, defaults, step.group)
    for (const [key, value] of Object.entries(reset)) {
      form.setValue(`settings.${key}`, value, { shouldDirty: true })
    }
    form.clearErrors(Object.keys(reset).map((key) => `settings.${key}` as const))
    setSkipped((s) => new Set(s).add(step.group))
    goTo(stepAfter(step.group))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void (step ? onNext() : onValidate())
  }

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

  const stepOfField = (field: string) => {
    const group = stepForField(schema, field)
    return steps.find((s) => s.group === group) ?? null
  }

  const failure = validate.error ?? (launch.error instanceof ApiError && launch.error.status === 400 ? null : launch.error)
  const status = validate.isPending
    ? 'Running the pre-flight checks…'
    : !report
      ? null
      : stale
        ? 'The configuration changed since the last check: validate again in the side panel.'
        : report.ok
          ? 'Pre-flight checks passed. Launch when ready.'
          : 'Pre-flight checks failed: see the side panel.'

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,4fr)]" noValidate>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <TargetPanel targets={targets} />
          <Button variant="secondary" onClick={() => void onValidate()} disabled={validate.isPending}>
            <ShieldCheck className="size-4" aria-hidden />
            {validate.isPending ? 'Validating…' : 'Validate'}
          </Button>
          {failure && (
            <Alert tone="critical" title="Request failed">
              {failure.message}
            </Alert>
          )}
          {report && (
            <PreflightPanel
              report={report}
              stale={stale}
              stepTitle={(field) => stepOfField(field)?.title ?? null}
              onSelect={(field) => {
                const target = stepOfField(field)
                if (target) goTo(target.group)
              }}
            />
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold">New run</h1>
            <p className="text-sm text-ink-2">
              {source ? `Based on run ${source.id}. ` : ''}Defaults come from the scheduler's .env; only changed settings
              are sent.
            </p>
          </div>
          <Stepper steps={statuses} active={activeKey} onSelect={goTo} />
          {/* clips the sliding step; the padding keeps the card's ring visible */}
          <div className="overflow-x-clip p-px">
            <div key={activeKey} className={direction === 'next' ? 'animate-step-next' : 'animate-step-back'}>
              {step ? (
                <SettingsStep
                  step={step}
                  defaults={defaults}
                  changed={statuses[index]!.changed}
                  headingRef={headingRef}
                />
              ) : (
                <SummaryStep
                  steps={steps}
                  schema={schema}
                  defaults={defaults}
                  values={values}
                  targets={targets}
                  capabilities={capabilities}
                  skipped={skipped}
                  issues={issues}
                  status={status}
                  onEdit={goTo}
                  headingRef={headingRef}
                />
              )}
            </div>
          </div>
          <footer className="flex flex-wrap items-center gap-2 border-t border-grid pt-4">
            <Button onClick={() => goTo(order[index - 1]!)} disabled={index === 0}>
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Button>
            {blocked && (
              <p role="alert" className="text-sm text-critical-text">
                Fix the highlighted fields to continue.
              </p>
            )}
            <div className="ml-auto flex gap-2">
              {step && !step.required && (
                <Button variant="ghost" onClick={onSkip} title="Reset this step to the scheduler's defaults and continue">
                  <SkipForward className="size-4" aria-hidden />
                  Skip
                </Button>
              )}
              {step ? (
                <Button type="submit" variant="primary">
                  {index === steps.length - 1 ? 'Review' : 'Next'}
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              ) : (
                <Button variant="primary" onClick={onLaunch} disabled={!report?.ok || stale || launch.isPending}>
                  <Rocket className="size-4" aria-hidden />
                  {launch.isPending ? 'Launching…' : 'Launch'}
                </Button>
              )}
            </div>
          </footer>
        </div>
      </form>
    </FormProvider>
  )
}
