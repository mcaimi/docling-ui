import type { ShardRuntime } from '@/api/types'

/** Short form of a runtime error: Kubernetes reports "Reason: message". */
function errorReason(error: string): string {
  return error.split(':', 1)[0]!.trim() || error
}

/**
 * Map a container/process state onto the shared status vocabulary. `detail` is
 * the runtime's full error, when it has one (e.g. a pod that can't be
 * scheduled, or a Job cancelled or past its deadline, which have no exit code).
 */
export function shardStatus(shard: ShardRuntime | undefined): { status: string; label: string; detail?: string } {
  if (!shard) return { status: 'PENDING', label: 'Not started' }
  const detail = shard.error ?? undefined
  switch (shard.state) {
    case 'running':
      return { status: 'RUNNING', label: 'Running', detail }
    case 'created':
      return { status: 'PENDING', label: detail ? errorReason(detail) : 'Starting', detail }
    case 'exited':
      if (shard.exit_code === 0) return { status: 'SUCCEEDED', label: 'Exited 0', detail }
      if (shard.oom_killed) return { status: 'FAILED', label: 'OOM killed', detail }
      if (shard.exit_code === null && detail) {
        if (detail === 'cancelled') return { status: 'CANCELLED', label: 'Cancelled', detail }
        return { status: 'FAILED', label: errorReason(detail), detail }
      }
      return { status: 'FAILED', label: `Exit ${shard.exit_code ?? '?'}`, detail }
    case 'missing':
      return { status: 'UNKNOWN', label: 'Removed', detail }
    default:
      return { status: 'UNKNOWN', label: shard.state, detail }
  }
}
