// Schema-driven run form: visibility, defaults, change detection, validation
// and the overrides payload. Field paths ("settings.<key>", "target.<field>")
// match the scheduler's pre-flight error fields, so server errors attach to
// the right input.
import { z } from 'zod'
import type { ExecutorCapabilities, ExecutorName, RunRequest, RunTarget, SettingSchema, SettingsDefaults } from '@/api/types'

export const GROUP_ORDER = [
  'prompt',
  'source',
  'conversion',
  'chunking',
  'embeddings',
  'llm',
  'vector_store',
  'runtime',
  'tracing',
] as const

export const GROUP_TITLES: Record<string, string> = {
  prompt: 'Prompt',
  source: 'Source',
  conversion: 'Conversion',
  chunking: 'Chunking',
  embeddings: 'Embeddings',
  llm: 'Prompt extraction LLM',
  vector_store: 'Vector store',
  runtime: 'Runtime',
  tracing: 'MLflow',
}

/** Wizard steps that can't be skipped: the source decides where the documents come from. */
export const REQUIRED_GROUPS = new Set(['source'])

/** Values the scheduler forces for managed settings (relevant to depends_on). */
const MANAGED_VALUES: Record<string, string> = { enable_tracing: '1' }

export type SettingValue = string | boolean
export interface TargetValues {
  type: RunTarget['type']
  image: string
  host_folder: string
  shards: string
  cpus: string
  memory: string
}
export interface RunFormValues {
  settings: Record<string, SettingValue>
  target: TargetValues
}

/** The host folder is mounted only for the local source; S3 runs read the bucket. Mirrors the scheduler, which treats anything but "s3" as local. */
export function usesLocalSource(settings: Record<string, SettingValue | undefined>): boolean {
  return settings.source_backend !== 's3'
}

/** Whether the run needs a host folder: local source on an executor that can mount one (others reject the local source instead). */
export function usesHostFolder(
  settings: Record<string, SettingValue | undefined>,
  capabilities: Pick<ExecutorCapabilities, 'local_source'>,
): boolean {
  return usesLocalSource(settings) && capabilities.local_source
}

export function settingLabel(key: string): string {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function editableSettings(schema: SettingSchema[]): SettingSchema[] {
  return schema.filter((s) => !s.managed)
}

export function toFormValue(spec: SettingSchema, value: unknown): SettingValue {
  if (spec.type === 'bool') return Boolean(Number(value ?? 0))
  if (value === null || value === undefined) return ''
  if (spec.type === 'json') {
    if (typeof value === 'object' && Object.keys(value as object).length === 0) return ''
    return typeof value === 'string' ? value : JSON.stringify(value)
  }
  return String(value)
}

export function defaultSettingValues(schema: SettingSchema[], defaults: SettingsDefaults): Record<string, SettingValue> {
  const values: Record<string, SettingValue> = {}
  for (const spec of editableSettings(schema)) {
    values[spec.key] = spec.sensitive ? '' : toFormValue(spec, defaults.values[spec.key])
  }
  return values
}

function effectiveValue(spec: SettingSchema | undefined, key: string, values: Record<string, SettingValue>): string {
  if (key in MANAGED_VALUES) return MANAGED_VALUES[key]!
  const value = values[key]
  if (spec?.type === 'bool') return value ? '1' : '0'
  return value === undefined ? '' : String(value)
}

/** The prompt-extraction LLM only runs when there's a prompt to extract settings from. */
function groupActive(group: string, values: Record<string, SettingValue>): boolean {
  return group !== 'llm' || !('user_prompt' in values) || String(values.user_prompt).trim() !== ''
}

export function isVisible(
  spec: SettingSchema,
  values: Record<string, SettingValue>,
  byKey: Map<string, SettingSchema>,
): boolean {
  return groupActive(spec.group, values) && Object.entries(spec.depends_on).every(([key, allowed]) =>
    allowed.includes(effectiveValue(byKey.get(key), key, values)),
  )
}

export function isChanged(spec: SettingSchema, value: SettingValue | undefined, defaults: SettingsDefaults): boolean {
  if (spec.sensitive) return typeof value === 'string' && value !== ''
  return (value ?? '') !== toFormValue(spec, defaults.values[spec.key])
}

function payloadValue(spec: SettingSchema, value: SettingValue): unknown {
  if (spec.type === 'bool') return Boolean(value)
  if (spec.type === 'int' && typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value)
  return typeof value === 'string' ? value.trim() : value
}

/** Only settings that are visible and differ from the scheduler's defaults. */
export function buildOverrides(
  schema: SettingSchema[],
  values: Record<string, SettingValue>,
  defaults: SettingsDefaults,
): Record<string, unknown> {
  const byKey = new Map(schema.map((s) => [s.key, s]))
  const overrides: Record<string, unknown> = {}
  for (const spec of editableSettings(schema)) {
    const value = values[spec.key]
    if (value === undefined || !isVisible(spec, values, byKey) || !isChanged(spec, value, defaults)) continue
    overrides[spec.key] = payloadValue(spec, value)
  }
  return overrides
}

export function buildRunRequest(
  schema: SettingSchema[],
  values: RunFormValues,
  defaults: SettingsDefaults,
  capabilities: ExecutorCapabilities,
): RunRequest {
  const t = values.target
  return {
    settings: buildOverrides(schema, values.settings, defaults),
    target: {
      type: t.type,
      image: t.image.trim() || null,
      host_folder: usesHostFolder(values.settings, capabilities) ? t.host_folder.trim() || null : null,
      shards: Number(t.shards),
      cpus: t.cpus.trim() ? Number(t.cpus) : null,
      memory: t.memory.trim() || null,
    },
  }
}

/** Form values for re-running a previous run (its overrides on top of defaults). */
export function formValuesFromRun(
  schema: SettingSchema[],
  defaults: SettingsDefaults,
  overrides: Record<string, unknown>,
  target: RunTarget,
  // the scheduler's current executor: a run is always re-launched there
  fallbackType: ExecutorName,
): RunFormValues {
  const settings = defaultSettingValues(schema, defaults)
  for (const spec of editableSettings(schema)) {
    if (spec.key in overrides && !spec.sensitive) settings[spec.key] = toFormValue(spec, overrides[spec.key])
  }
  return {
    settings,
    target: {
      type: fallbackType,
      image: target.image ?? '',
      host_folder: target.host_folder ?? '',
      shards: String(target.shards ?? 1),
      cpus: target.cpus ? String(target.cpus) : '',
      memory: target.memory ?? '',
    },
  }
}

const INT_RE = /^-?\d+$/
const MEMORY_RE = /^\d+(\.\d+)?[bkmg]?$/i

export function buildRunFormSchema(schema: SettingSchema[], capabilities: ExecutorCapabilities, maxShards = 32) {
  const byKey = new Map(schema.map((s) => [s.key, s]))
  const editable = editableSettings(schema)
  const shape: Record<string, z.ZodType<SettingValue>> = {}
  for (const spec of editable) shape[spec.key] = spec.type === 'bool' ? z.boolean() : z.string()

  const settings = z.object(shape).superRefine((values, ctx) => {
    const issue = (key: string, message: string) => ctx.addIssue({ code: 'custom', path: [key], message })
    for (const spec of editable) {
      const value = values[spec.key]
      if (typeof value !== 'string' || value.trim() === '' || !isVisible(spec, values, byKey)) continue
      if (spec.type === 'int' && !INT_RE.test(value.trim())) issue(spec.key, 'Enter a whole number')
      if (spec.type === 'json') {
        try {
          const parsed: unknown = JSON.parse(value)
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) issue(spec.key, 'Enter a JSON object')
        } catch {
          issue(spec.key, 'Invalid JSON')
        }
      }
      if (spec.choices && !spec.choices.includes(value.trim())) issue(spec.key, `One of ${spec.choices.join(', ')}`)
    }
    if (values.chunking_strategy === 'fixed') {
      const size = Number(values.chunk_size)
      const overlap = Number(values.chunk_overlap)
      if (INT_RE.test(String(values.chunk_size)) && size <= 0) issue('chunk_size', 'Must be greater than 0')
      if (INT_RE.test(String(values.chunk_overlap)) && (overlap < 0 || overlap >= size))
        issue('chunk_overlap', 'Must be at least 0 and smaller than the chunk size')
    }
  })

  const target = z.object({
    type: z.enum(['podman', 'kubernetes']),
    image: z.string(),
    host_folder: z.string(),
    shards: z
      .string()
      .refine((v) => INT_RE.test(v.trim()) && Number(v) >= 1 && Number(v) <= maxShards, `Between 1 and ${maxShards}`),
    cpus: z.string().refine((v) => v.trim() === '' || (Number(v) > 0 && Number.isFinite(Number(v))), 'A positive number'),
    memory: z.string().refine((v) => v.trim() === '' || MEMORY_RE.test(v.trim()), 'A size such as 512m or 4g'),
  })

  return z.object({ settings, target }).superRefine((values, ctx) => {
    const image = values.target.image.trim()
    if (!capabilities.local_images && image.startsWith('localhost/')) {
      ctx.addIssue({
        code: 'custom',
        path: ['target', 'image'],
        message: `The ${values.target.type} executor pulls images from a registry; localhost/ images only exist on this machine`,
      })
    }
    if (!usesLocalSource(values.settings)) return
    if (!capabilities.local_source) {
      ctx.addIssue({
        code: 'custom',
        path: ['settings', 'source_backend'],
        message: `The ${values.target.type} executor can't mount host folders; use s3`,
      })
      return
    }
    const folder = values.target.host_folder.trim()
    const message = !folder
      ? 'Choose the folder with the documents'
      : folder.startsWith('/') || folder.startsWith('~')
        ? null
        : 'Use an absolute path'
    if (message) ctx.addIssue({ code: 'custom', path: ['target', 'host_folder'], message })
  })
}

export function groupSettings(schema: SettingSchema[]): { group: string; title: string; settings: SettingSchema[] }[] {
  const editable = editableSettings(schema)
  const groups = [...GROUP_ORDER, ...new Set(editable.map((s) => s.group).filter((g) => !GROUP_ORDER.includes(g as never)))]
  return groups
    .map((group) => ({
      group,
      title: GROUP_TITLES[group] ?? group,
      settings: editable.filter((s) => s.group === group),
    }))
    .filter((g) => g.settings.length > 0)
}

export interface WizardStep {
  group: string
  title: string
  /** Only the currently visible settings. */
  settings: SettingSchema[]
  required: boolean
}

/** One step per group that has visible settings, in display order. */
export function wizardSteps(schema: SettingSchema[], values: Record<string, SettingValue>): WizardStep[] {
  const byKey = new Map(schema.map((s) => [s.key, s]))
  return groupSettings(schema)
    .map(({ group, title, settings }) => ({
      group,
      title,
      settings: settings.filter((s) => isVisible(s, values, byKey)),
      required: REQUIRED_GROUPS.has(group),
    }))
    .filter((step) => step.settings.length > 0)
}

/** Fields checked before leaving a step. The source step also owns the host folder it requires. */
export function stepFieldPaths(
  step: WizardStep,
  values: Record<string, SettingValue>,
  capabilities: Pick<ExecutorCapabilities, 'local_source'>,
): string[] {
  const paths = step.settings.map((s) => `settings.${s.key}`)
  if (step.group === 'source' && usesHostFolder(values, capabilities)) paths.push('target.host_folder')
  return paths
}

/** Default form values of a group's settings, used when its step is skipped. */
export function groupDefaults(
  schema: SettingSchema[],
  defaults: SettingsDefaults,
  group: string,
): Record<string, SettingValue> {
  const all = defaultSettingValues(schema, defaults)
  return Object.fromEntries(
    editableSettings(schema)
      .filter((s) => s.group === group)
      .map((s) => [s.key, all[s.key]!]),
  )
}

/** The group (wizard step) of an error field such as "settings.chunk_size"; target fields have none. */
export function stepForField(schema: SettingSchema[], field: string): string | null {
  if (!field.startsWith('settings.')) return null
  const key = field.slice('settings.'.length)
  return editableSettings(schema).find((s) => s.key === key)?.group ?? null
}
