import { describe, expect, it } from 'vitest'
import type { ShardRuntime } from '@/api/types'
import { shardStatus } from './runtimeStatus'

function shard(extra: Partial<ShardRuntime>): ShardRuntime {
  return {
    shard_index: 0, attempt: 0, container_id: 'job-0', name: 'job-0-abc', state: 'exited', exit_code: null,
    oom_killed: false, started_at: null, finished_at: null, error: null, ...extra,
  }
}

describe('shardStatus', () => {
  it('maps exit codes', () => {
    expect(shardStatus(shard({ exit_code: 0 }))).toMatchObject({ status: 'SUCCEEDED', label: 'Exited 0' })
    expect(shardStatus(shard({ exit_code: 137, oom_killed: true, error: 'OOMKilled' }))).toMatchObject({ status: 'FAILED', label: 'OOM killed' })
    expect(shardStatus(shard({ exit_code: 1 }))).toMatchObject({ status: 'FAILED', label: 'Exit 1' })
  })

  it('uses the runtime error when there is no exit code', () => {
    expect(shardStatus(shard({ error: 'cancelled' }))).toMatchObject({ status: 'CANCELLED', label: 'Cancelled' })
    expect(shardStatus(shard({ error: 'DeadlineExceeded: Job was active longer than specified deadline' }))).toEqual({
      status: 'FAILED',
      label: 'DeadlineExceeded',
      detail: 'DeadlineExceeded: Job was active longer than specified deadline',
    })
  })

  it('shows why a pending pod is stuck', () => {
    expect(shardStatus(shard({ state: 'created' }))).toMatchObject({ status: 'PENDING', label: 'Starting' })
    expect(shardStatus(shard({ state: 'created', error: 'Unschedulable: 0/3 nodes are available' }))).toMatchObject({
      status: 'PENDING',
      label: 'Unschedulable',
    })
  })
})
