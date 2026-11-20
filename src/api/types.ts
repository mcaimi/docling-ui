// Shapes returned by the scheduler API (src/scheduler/api.py).

export type SettingType = 'str' | 'int' | 'bool' | 'json'

export interface SettingSchema {
  key: string
  env: string
  type: SettingType
  default: unknown
  group: string
  description: string
  choices: string[] | null
  sensitive: boolean
  untrusted: boolean
  managed: boolean
  env_fallbacks: string[]
  depends_on: Record<string, string[]>
}

export interface SettingsDefaults {
  values: Record<string, unknown>
  secrets: Record<string, boolean>
}

export type ExecutorName = 'podman' | 'kubernetes'

/** Per-executor entry in /api/targets; the inactive executor is reported unavailable. */
export interface ExecutorAvailability {
  available: boolean
  error?: string
  warning?: string
  // kubernetes: API server version and the namespace run objects go to
  version?: string | null
  namespace?: string
}

/** What pre-flight assumes about where containers run (the scheduler's ExecutorCapabilities). */
export interface ExecutorCapabilities {
  // host loopback endpoints are rewritten to; null for a remote runtime, which rejects them
  host_gateway: string | null
  // host folders can be mounted (source_backend=local)
  local_source: boolean
  // images come from the runtime's local store; otherwise pulled from a registry
  local_images: boolean
}

export interface Targets {
  // capabilities: absent on schedulers that predate them (Podman only)
  executor: { name: ExecutorName; capabilities?: ExecutorCapabilities }
  podman?: ExecutorAvailability
  kubernetes?: ExecutorAvailability
  mlflow: { tracking_uri: string; ui_uri: string | null }
  default_image: string
  [executor: string]: unknown
}

export interface RunTarget {
  // must match the scheduler's executor
  type: ExecutorName
  image?: string | null
  // required for source_backend=local (Podman only), unused (null) for s3
  host_folder?: string | null
  shards: number
  cpus?: number | null
  memory?: string | null
}

export interface RunRequest {
  settings: Record<string, unknown>
  target: RunTarget
}

export interface PreflightError {
  field: string
  message: string
}

export interface ShardPlanEntry {
  shard_index: number
  document_count: number
  documents: string[]
}

export interface Preflight {
  ok: boolean
  errors: PreflightError[]
  warnings: string[]
  document_count: number
  shard_plan: ShardPlanEntry[]
  concurrency: {
    shards: number
    max_concurrency_per_shard: number | null
    total_concurrent_documents: number | null
    vector_store_write_workers: number | null
  }
  preview: {
    executor: string
    image: string
    shards: number
    mount: { source: string; target: string; read_only: boolean } | null
    resources: { cpus: number | null; memory: string | null }
    env: Record<string, string>
    secret_env: Record<string, string>
    settings: Record<string, unknown>
  }
}

export type RunStatus =
  | 'SUBMITTING'
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SUBMIT_FAILED'
  | 'UNKNOWN'

export interface ShardRuntime {
  shard_index: number
  attempt: number
  // Podman: container id; Kubernetes: Job name (name is the pod, once it exists)
  container_id: string | null
  name: string | null
  state: string
  exit_code: number | null
  oom_killed: boolean
  started_at: string | null
  finished_at: string | null
  error: string | null
}

export interface RunRecord {
  id: string
  created_at: number
  target_type: string
  image: string
  shard_count: number
  mlflow_experiment_id: string | null
  mlflow_parent_run_id: string | null
  config: {
    settings?: Record<string, unknown>
    overrides?: Record<string, unknown>
    target?: RunTarget
    warnings?: string[]
    document_count?: number
  }
  status: RunStatus
  final: boolean
  cancelled: boolean
  error: string | null
  finished_at: number | null
}

export interface RunView extends RunRecord {
  runtime_error: string | null
  shards: ShardRuntime[]
  mlflow_link: string | null
}

export type ProgressKey =
  | 'docs_completed'
  | 'docs_failed'
  | 'total_chunks'
  | 'total_embeddings'
  | 'non_null_embeddings'
  | 'vectors_stored'
  | 'vectors_upserted'
  | 'vector_store_retry_count'
  | 'failed_chunk_count'
  | 'error_count'
  | 'vector_store_error_count'

/** [step, value, timestamp_ms] */
export type MetricPoint = [number, number, number]

export interface ShardOverview {
  shard_index: number
  run_id: string | null
  status: string | null
  attempts: number
  start_time?: number
  end_time?: number | null
  document_count?: number | null
  metrics?: Partial<Record<ProgressKey, number | null>>
  link?: string | null
}

export interface MlflowOverview {
  parent: { run_id: string; status: string; start_time: number; end_time: number | null; link: string | null }
  session_id: string
  totals: Record<ProgressKey, number>
  total_document_count: number | null
  progress: number | null
  shards: ShardOverview[]
  history: Record<string, Record<string, MetricPoint[]>>
}

export interface DocumentRow {
  seq: number
  trace_id: string
  file: string | null
  file_format: string | null
  shard_index: number | null
  status: string
  stage_failed: string | null
  error: string | null
  chunk_count: number | null
  stored_count: number | null
  embedding_failed: boolean | null
  started_at_ms: number
  duration_ms: number | null
  stages_ms: Partial<Record<StageName, number>>
}

export type StageName = 'convert_pdf' | 'chunk_doc' | 'embed_doc' | 'store_doc'

export interface DocumentsPage {
  generation: string
  rows: DocumentRow[]
  last_seq: number
  total: number
}

export interface ErrorReport {
  path: string
  error: string
  stage: 'pipeline' | 'embedding' | 'vector_store' | string
  shard_index: number
}

export interface ResourceSample {
  shard_index: number
  timestamp: number
  cpu_percent: number | null
  memory_bytes: number | null
  memory_limit_bytes: number | null
}

export interface RuntimeEvent {
  timestamp: number
  shard_index: number | null
  type: string
  action: string
  message: string
}

export interface RuntimeView {
  error: string | null
  containers: ShardRuntime[]
  events: RuntimeEvent[]
  resources: ResourceSample[]
}

export interface LogEntry {
  ts?: string
  level?: string
  logger?: string
  msg?: string
  file?: string
  stage?: string
  [key: string]: unknown
}

export type WorkflowStatus = 'pending' | 'running' | 'ok' | 'error' | 'skipped'

export type WorkflowStepKey = 'prompt_extraction' | 'discovery' | 'pipeline' | 'aggregation'

export type DocumentStageKey = StageName

export interface WorkflowStage {
  key: DocumentStageKey
  status: WorkflowStatus
  ok: number
  failed: number
  avg_ms: number | null
}

/** One of the agent's top-level steps; a running step has no trace yet, so its state is inferred. */
export interface WorkflowStep {
  key: WorkflowStepKey
  // the agent's span name
  name: string
  status: WorkflowStatus
  started_at_ms: number | null
  duration_ms: number | null
  error: string | null
  // pipeline only: per-document stages, aggregated over finished documents
  stages?: WorkflowStage[]
}

/** /api/runs/{id}/shards/{n}/workflow: the shard's latest MLflow run, rebuilt from its traces. */
export interface ShardWorkflow {
  shard_index: number
  run_id: string | null
  run_status: string | null
  attempts: number
  link: string | null
  documents: { total: number | null; completed: number; failed: number }
  steps: WorkflowStep[]
  // newest first
  recent_documents: {
    trace_id: string
    file: string | null
    status: string | null
    stage_failed: string | null
    error: string | null
    duration_ms: number | null
    stages_ms: Partial<Record<StageName, number>>
  }[]
}
