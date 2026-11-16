import { describe, expect, it } from 'vitest'
import type { ExecutorCapabilities, SettingSchema, SettingsDefaults } from '@/api/types'
import {
  buildOverrides,
  buildRunFormSchema,
  buildRunRequest,
  defaultSettingValues,
  formValuesFromRun,
  groupDefaults,
  groupSettings,
  isVisible,
  stepFieldPaths,
  stepForField,
  wizardSteps,
} from './settingsForm'

function spec(key: string, extra: Partial<SettingSchema> = {}): SettingSchema {
  return {
    key, env: key.toUpperCase(), type: 'str', default: null, group: 'chunking', description: '',
    choices: null, sensitive: false, untrusted: false, managed: false, env_fallbacks: [], depends_on: {},
    ...extra,
  }
}

const podman: ExecutorCapabilities = { host_gateway: 'host.containers.internal', local_source: true, local_images: true }
const kubernetes: ExecutorCapabilities = { host_gateway: null, local_source: false, local_images: false }

const schema: SettingSchema[] = [
  spec('chunking_strategy', { choices: ['fixed', 'hybrid'] }),
  spec('chunk_size', { type: 'int', depends_on: { chunking_strategy: ['fixed'] } }),
  spec('chunk_overlap', { type: 'int', depends_on: { chunking_strategy: ['fixed'] } }),
  spec('embedding_api_key', { group: 'embeddings', sensitive: true }),
  spec('vlm_api_params', { group: 'conversion', type: 'json', sensitive: true }),
  spec('milvus_index_params', { group: 'vector_store', type: 'json' }),
  spec('chroma_allow_reset', { group: 'vector_store', type: 'bool' }),
  spec('mlflow_experiment_name', { group: 'tracing', depends_on: { enable_tracing: ['1'] } }),
  spec('folder_path', { group: 'source', managed: true }),
  spec('source_backend', { group: 'source', choices: ['local', 's3'] }),
  spec('s3_bucket', { group: 'source', depends_on: { source_backend: ['s3'] } }),
  spec('enable_tracing', { group: 'tracing', type: 'bool', managed: true }),
]
const byKey = new Map(schema.map((s) => [s.key, s]))
const defaults: SettingsDefaults = {
  values: {
    chunking_strategy: 'fixed', chunk_size: 1000, chunk_overlap: 100, milvus_index_params: {},
    chroma_allow_reset: 0, mlflow_experiment_name: 'Docling Agent', folder_path: './pdfs',
    source_backend: 'local',
  },
  secrets: { embedding_api_key: true, vlm_api_params: false },
}

describe('defaults and visibility', () => {
  it('hides managed settings and blanks secrets', () => {
    const values = defaultSettingValues(schema, defaults)
    expect(values).not.toHaveProperty('folder_path')
    expect(values).not.toHaveProperty('enable_tracing')
    expect(values.embedding_api_key).toBe('')
    expect(values.chunk_size).toBe('1000')
    expect(values.milvus_index_params).toBe('')
    expect(values.chroma_allow_reset).toBe(false)
  })

  it('follows depends_on, treating managed tracing as enabled', () => {
    const values = defaultSettingValues(schema, defaults)
    expect(isVisible(byKey.get('chunk_size')!, values, byKey)).toBe(true)
    expect(isVisible(byKey.get('chunk_size')!, { ...values, chunking_strategy: 'hybrid' }, byKey)).toBe(false)
    expect(isVisible(byKey.get('mlflow_experiment_name')!, values, byKey)).toBe(true)
  })

  it('groups editable settings in display order', () => {
    expect(groupSettings(schema).map((g) => g.group)).toEqual(['source', 'conversion', 'chunking', 'embeddings', 'vector_store', 'tracing'])
  })
})

describe('overrides', () => {
  it('sends only visible changed values, typed', () => {
    const values = {
      ...defaultSettingValues(schema, defaults),
      chunk_size: '500',
      embedding_api_key: 'sk-new',
      chroma_allow_reset: true,
    }
    expect(buildOverrides(schema, values, defaults)).toEqual({
      chunk_size: 500, embedding_api_key: 'sk-new', chroma_allow_reset: true,
    })
  })

  it('drops values of hidden fields', () => {
    const values = { ...defaultSettingValues(schema, defaults), chunking_strategy: 'hybrid', chunk_size: '500' }
    expect(buildOverrides(schema, values, defaults)).toEqual({ chunking_strategy: 'hybrid' })
  })

  it('builds the run request target', () => {
    const request = buildRunRequest(schema, {
      settings: defaultSettingValues(schema, defaults),
      target: { type: 'podman', image: ' ', host_folder: ' /data ', shards: '2', cpus: '4', memory: '2g' },
    }, defaults, podman)
    expect(request.target).toEqual({ type: 'podman', image: null, host_folder: '/data', shards: 2, cpus: 4, memory: '2g' })
  })

  it('sends no host folder for an S3 source', () => {
    const request = buildRunRequest(schema, {
      settings: { ...defaultSettingValues(schema, defaults), source_backend: 's3', s3_bucket: 'docs' },
      target: { type: 'podman', image: '', host_folder: '/data', shards: '1', cpus: '', memory: '' },
    }, defaults, podman)
    expect(request.settings).toEqual({ source_backend: 's3', s3_bucket: 'docs' })
    expect(request.target.host_folder).toBeNull()
  })

  it('never sends a host folder to kubernetes', () => {
    const request = buildRunRequest(schema, {
      settings: defaultSettingValues(schema, defaults),
      target: { type: 'kubernetes', image: 'quay.io/x/agent:1', host_folder: '/data', shards: '1', cpus: '', memory: '' },
    }, defaults, kubernetes)
    expect(request.target).toMatchObject({ type: 'kubernetes', image: 'quay.io/x/agent:1', host_folder: null })
  })

  it('restores a previous run without secrets', () => {
    const values = formValuesFromRun(schema, defaults, { chunk_size: 300, embedding_api_key: 'x' },
      { type: 'podman', host_folder: '/d', shards: 3, cpus: 2, memory: '1g', image: null }, 'podman')
    expect(values.settings.chunk_size).toBe('300')
    expect(values.settings.embedding_api_key).toBe('')
    expect(values.target).toMatchObject({ host_folder: '/d', shards: '3', cpus: '2', memory: '1g', image: '' })
  })
})

describe('validation', () => {
  const target = { type: 'podman' as const, image: '', host_folder: '/docs', shards: '2', cpus: '', memory: '' }

  function errors(settings: Record<string, unknown>, targetOverrides = {}, capabilities = podman) {
    const result = buildRunFormSchema(schema, capabilities, 8).safeParse({
      settings: { ...defaultSettingValues(schema, defaults), ...settings },
      target: { ...target, ...targetOverrides },
    })
    return result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
  }

  it('accepts defaults', () => expect(errors({})).toEqual([]))

  it('checks types and cross-field rules on visible fields', () => {
    expect(errors({ chunk_size: 'abc' })).toContain('settings.chunk_size')
    expect(errors({ chunk_overlap: '1000' })).toContain('settings.chunk_overlap')
    expect(errors({ milvus_index_params: '[1]' })).toContain('settings.milvus_index_params')
    expect(errors({ chunking_strategy: 'hybrid', chunk_size: 'abc' })).toEqual([])
  })

  it('checks the target', () => {
    expect(errors({}, { host_folder: 'relative' })).toContain('target.host_folder')
    expect(errors({}, { shards: '9' })).toContain('target.shards')
    expect(errors({}, { memory: 'lots' })).toContain('target.memory')
    expect(errors({}, { cpus: '-1' })).toContain('target.cpus')
  })

  it('requires the host folder only for the local source', () => {
    expect(errors({}, { host_folder: '' })).toContain('target.host_folder')
    expect(errors({ source_backend: 's3' }, { host_folder: '' })).toEqual([])
    expect(errors({ source_backend: 's3' }, { host_folder: 'relative' })).toEqual([])
  })

  it('requires an S3 source and a registry image without local capabilities', () => {
    const k8s = { type: 'kubernetes', host_folder: '' }
    expect(errors({}, k8s, kubernetes)).toEqual(['settings.source_backend'])
    expect(errors({ source_backend: 's3' }, k8s, kubernetes)).toEqual([])
    expect(errors({ source_backend: 's3' }, { ...k8s, image: 'localhost/docling-agent:latest' }, kubernetes)).toEqual(['target.image'])
    expect(errors({}, { image: 'localhost/docling-agent:latest' })).toEqual([])
  })

  it('reports the host folder alongside other errors', () => {
    expect(errors({ chunk_size: 'abc' }, { host_folder: '', shards: '9' })).toEqual(
      expect.arrayContaining(['settings.chunk_size', 'target.shards', 'target.host_folder']),
    )
  })
})

describe('wizard steps', () => {
  const withPrompt = [...schema, spec('user_prompt', { group: 'prompt' }), spec('llm_model', { group: 'llm' })]

  it('has one step per group with visible settings, source required', () => {
    const values = defaultSettingValues(schema, defaults)
    const steps = wizardSteps(schema, values)
    expect(steps.map((s) => s.group)).toEqual(['source', 'conversion', 'chunking', 'embeddings', 'vector_store', 'tracing'])
    expect(steps.filter((s) => s.required).map((s) => s.group)).toEqual(['source'])
    expect(steps.find((s) => s.group === 'source')!.settings.map((s) => s.key)).toEqual(['source_backend'])
  })

  it('drops the extraction LLM without a prompt, and stops sending its settings', () => {
    const values = { ...defaultSettingValues(withPrompt, defaults), llm_model: 'granite' }
    expect(wizardSteps(withPrompt, values).map((s) => s.group)).not.toContain('llm')
    expect(buildOverrides(withPrompt, values, defaults)).not.toHaveProperty('llm_model')

    const prompted = { ...values, user_prompt: 'use hybrid chunking' }
    expect(wizardSteps(withPrompt, prompted).map((s) => s.group)).toContain('llm')
    expect(buildOverrides(withPrompt, prompted, defaults)).toMatchObject({ llm_model: 'granite' })
  })

  it('checks the host folder with the source step only when it is used', () => {
    const values = defaultSettingValues(schema, defaults)
    const source = wizardSteps(schema, values).find((s) => s.group === 'source')!
    expect(stepFieldPaths(source, values, podman)).toEqual(['settings.source_backend', 'target.host_folder'])
    expect(stepFieldPaths(source, values, kubernetes)).toEqual(['settings.source_backend'])
    const chunking = wizardSteps(schema, values).find((s) => s.group === 'chunking')!
    expect(stepFieldPaths(chunking, values, podman)).toEqual(['settings.chunking_strategy', 'settings.chunk_size', 'settings.chunk_overlap'])
  })

  it('resets a group to its defaults, hidden settings included', () => {
    expect(groupDefaults(schema, defaults, 'chunking')).toEqual({ chunking_strategy: 'fixed', chunk_size: '1000', chunk_overlap: '100' })
    expect(groupDefaults(schema, defaults, 'embeddings')).toEqual({ embedding_api_key: '' })
  })

  it('maps error fields to their step', () => {
    expect(stepForField(schema, 'settings.chunk_size')).toBe('chunking')
    expect(stepForField(schema, 'settings.folder_path')).toBeNull()
    expect(stepForField(schema, 'target.host_folder')).toBeNull()
  })
})
