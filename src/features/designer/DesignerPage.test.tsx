import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Preflight, SettingSchema } from '@/api/types'
import { setToken } from '@/lib/token'
import { mockApi, renderAt } from '@/test/utils'
import { DesignerPage } from './DesignerPage'

function spec(key: string, extra: Partial<SettingSchema> = {}): SettingSchema {
  return {
    key, env: key.toUpperCase(), type: 'str', default: null, group: 'chunking', description: `About ${key}`,
    choices: null, sensitive: false, untrusted: false, managed: false, env_fallbacks: [], depends_on: {}, ...extra,
  }
}

const schema = [
  spec('chunking_strategy', { choices: ['fixed', 'hybrid'] }),
  spec('chunk_size', { type: 'int', depends_on: { chunking_strategy: ['fixed'] } }),
  spec('embedding_api_key', { group: 'embeddings', sensitive: true }),
  spec('folder_path', { group: 'source', managed: true }),
  spec('source_backend', { group: 'source', choices: ['local', 's3'] }),
  spec('s3_bucket', { group: 'source', depends_on: { source_backend: ['s3'] } }),
]
const defaults = { values: { chunking_strategy: 'fixed', chunk_size: 1000, source_backend: 'local' }, secrets: { embedding_api_key: true } }
const targets = {
  executor: { name: 'podman', capabilities: { host_gateway: 'host.containers.internal', local_source: true, local_images: true } },
  podman: { available: true },
  kubernetes: { available: false }, mlflow: { tracking_uri: 'http://m', ui_uri: null }, default_image: 'localhost/docling-agent:latest',
}

function preflight(overrides: Partial<Preflight> = {}): Preflight {
  return {
    ok: true, errors: [], warnings: [], document_count: 3,
    shard_plan: [{ shard_index: 0, document_count: 3, documents: ['a.md', 'b.md', 'c.md'] }],
    concurrency: { shards: 1, max_concurrency_per_shard: 2, total_concurrent_documents: 2, vector_store_write_workers: null },
    preview: { executor: 'podman', image: 'img', shards: 1, mount: null, resources: { cpus: null, memory: null }, env: { CHUNK_SIZE: '500' }, secret_env: { EMBEDDING_API_KEY: '<secret>' }, settings: {} },
    ...overrides,
  }
}

function setup(validateResponse: () => unknown, targetsResponse: object = targets) {
  setToken('t')
  const calls = mockApi({
    'GET /api/settings/schema': schema,
    'GET /api/settings/defaults': defaults,
    'GET /api/targets': targetsResponse,
    'POST /api/runs/validate': validateResponse,
    'POST /api/runs': { id: 'run123' },
  })
  renderAt(<DesignerPage />, { path: '/runs/new', route: '/runs/new' })
  return calls
}

describe('DesignerPage', () => {
  it('validates, sends only changed settings, and launches', async () => {
    const user = userEvent.setup()
    const calls = setup(() => preflight())
    const size = await screen.findByLabelText(/Chunk size/)
    expect(screen.queryByLabelText(/Folder path/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Embedding api key/)).toHaveAttribute('type', 'password')

    await user.clear(size)
    await user.type(size, '500')
    expect(screen.getByText('changed')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Document folder'), '/home/me/docs')
    const launch = screen.getByRole('button', { name: /Launch/ })
    expect(launch).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Validate/ }))
    await screen.findByText('Ready to launch.')
    const validateCall = calls.find((c) => c.method === 'POST' && c.url === '/api/runs/validate')!
    expect(validateCall.body).toEqual({
      settings: { chunk_size: 500 },
      target: { type: 'podman', image: null, host_folder: '/home/me/docs', shards: 1, cpus: null, memory: null },
    })
    expect(screen.getByText(/EMBEDDING_API_KEY=<secret>/)).toBeInTheDocument()

    await user.click(launch)
    await screen.findByText('navigated')
    expect(calls.find((c) => c.method === 'POST' && c.url === '/api/runs')!.body).toEqual(validateCall.body)
  })

  it('requires re-validation after a change', async () => {
    const user = userEvent.setup()
    setup(() => preflight())
    await user.type(await screen.findByLabelText('Document folder'), '/docs')
    await user.click(screen.getByRole('button', { name: /Validate/ }))
    await screen.findByText('Ready to launch.')
    expect(screen.getByRole('button', { name: /Launch/ })).toBeEnabled()
    await user.type(screen.getByLabelText('Shards'), '2')
    expect(await screen.findByText(/Inputs changed since this check/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Launch/ })).toBeDisabled()
  })

  it('shows client and server errors on the fields', async () => {
    const user = userEvent.setup()
    setup(() => preflight({ ok: false, errors: [{ field: 'target.host_folder', message: 'folder does not exist' }] }))
    const size = await screen.findByLabelText(/Chunk size/)
    await user.clear(size)
    await user.type(size, 'abc')
    expect(await screen.findByText('Enter a whole number')).toBeInTheDocument()
    await user.clear(size)
    await user.type(size, '800')

    await user.type(screen.getByLabelText('Document folder'), '/missing')
    await user.click(screen.getByRole('button', { name: /Validate/ }))
    expect(await screen.findByText('folder does not exist', { selector: '[role=alert]' })).toBeInTheDocument()
    expect(screen.getByLabelText('Document folder')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: /Launch/ })).toBeDisabled()
  })

  it('hides dependent fields', async () => {
    const user = userEvent.setup()
    setup(() => preflight())
    await user.selectOptions(await screen.findByLabelText(/Chunking strategy/), 'hybrid')
    await waitFor(() => expect(screen.queryByLabelText(/Chunk size/)).not.toBeInTheDocument())
  })

  it('drops the document folder for an S3 source', async () => {
    const user = userEvent.setup()
    const calls = setup(() => preflight())
    await user.type(await screen.findByLabelText('Document folder'), '/docs')
    await user.selectOptions(screen.getByLabelText(/Source backend/), 's3')
    await waitFor(() => expect(screen.queryByLabelText('Document folder')).not.toBeInTheDocument())
    await user.type(screen.getByLabelText(/S3 bucket/), 'docs')

    await user.click(screen.getByRole('button', { name: /Validate/ }))
    await screen.findByText('Ready to launch.')
    expect(calls.find((c) => c.method === 'POST' && c.url === '/api/runs/validate')!.body).toEqual({
      settings: { source_backend: 's3', s3_bucket: 'docs' },
      target: { type: 'podman', image: null, host_folder: null, shards: 1, cpus: null, memory: null },
    })
  })

  it('targets kubernetes with an S3 source and no document folder', async () => {
    const user = userEvent.setup()
    const calls = setup(() => preflight(), {
      ...targets,
      executor: { name: 'kubernetes', capabilities: { host_gateway: null, local_source: false, local_images: false } },
      podman: { available: false, error: 'this scheduler runs the kubernetes executor' },
      kubernetes: { available: true, version: 'v1.31.0', namespace: 'docling' },
    })
    expect(await screen.findByText('Each shard runs as a Kubernetes Job in namespace docling.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Document folder')).not.toBeInTheDocument()
    expect(screen.getByText('S3 source required')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Source backend/), 's3')
    await waitFor(() => expect(screen.queryByText('S3 source required')).not.toBeInTheDocument())
    await user.type(screen.getByLabelText(/S3 bucket/), 'docs')
    await user.type(screen.getByLabelText('Image'), 'quay.io/me/docling-agent:1')

    await user.click(screen.getByRole('button', { name: /Validate/ }))
    await screen.findByText('Ready to launch.')
    expect(calls.find((c) => c.method === 'POST' && c.url === '/api/runs/validate')!.body).toEqual({
      settings: { source_backend: 's3', s3_bucket: 'docs' },
      target: { type: 'kubernetes', image: 'quay.io/me/docling-agent:1', host_folder: null, shards: 1, cpus: null, memory: null },
    })
  })

  it('assumes Podman when the scheduler predates capabilities', async () => {
    setup(() => preflight(), { ...targets, executor: { name: 'podman' } })
    expect(await screen.findByLabelText('Document folder')).toBeInTheDocument()
  })
})
