import { describe, expect, it } from 'vitest'
import type { DocumentRow, MlflowOverview } from '@/api/types'
import { appendSamples, emptyDocuments, mergeDocuments, totalOverTime, withOrigin } from './progress'

function overview(history: MlflowOverview['history']): MlflowOverview {
  return { history } as MlflowOverview
}

describe('totalOverTime', () => {
  it('sums each shard latest value at every timestamp', () => {
    const series = totalOverTime(
      overview({
        '0': { docs_completed: [[1, 1, 100], [2, 2, 300]] },
        '1': { docs_completed: [[2, 2, 200], [3, 3, 400]] },
      }),
      'docs_completed',
    )
    expect(series).toEqual([
      { t: 100, value: 1 },
      { t: 200, value: 3 },
      { t: 300, value: 4 },
      { t: 400, value: 5 },
    ])
  })

  it('handles missing metrics and unsorted points', () => {
    expect(totalOverTime(undefined, 'x')).toEqual([])
    expect(totalOverTime(overview({ '0': {} }), 'docs_completed')).toEqual([])
    expect(totalOverTime(overview({ '0': { m: [[2, 5, 20], [1, 1, 10]] } }), 'm')).toEqual([
      { t: 10, value: 1 },
      { t: 20, value: 5 },
    ])
  })

  it('adds an origin point', () => {
    expect(withOrigin([{ t: 10, value: 1 }], 5)).toEqual([{ t: 5, value: 0 }, { t: 10, value: 1 }])
    expect(withOrigin([], 5)).toEqual([])
  })
})

const row = (seq: number) => ({ seq, trace_id: `t${seq}` }) as DocumentRow

describe('mergeDocuments', () => {
  it('appends new rows and dedupes', () => {
    let state = mergeDocuments(emptyDocuments, { generation: 'g', rows: [row(1), row(2)], last_seq: 2, total: 2 })
    state = mergeDocuments(state, { generation: 'g', rows: [row(2), row(3)], last_seq: 3, total: 3 })
    expect(state.rows.map((r) => r.seq)).toEqual([1, 2, 3])
    expect(state.lastSeq).toBe(3)
  })

  it('starts over when the generation changes', () => {
    let state = mergeDocuments(emptyDocuments, { generation: 'g1', rows: [row(1), row(2)], last_seq: 2, total: 2 })
    state = mergeDocuments(state, { generation: 'g2', rows: [row(1)], last_seq: 1, total: 1 })
    expect(state.rows.map((r) => r.seq)).toEqual([1])
    expect(state.generation).toBe('g2')
  })
})

describe('appendSamples', () => {
  it('keeps a bounded per-shard window', () => {
    const s = (shard: number, ts: number) => ({ shard_index: shard, timestamp: ts, cpu_percent: ts, memory_bytes: 1, memory_limit_bytes: 2 })
    let buffer = appendSamples({}, [s(0, 1), s(1, 1)], 2)
    buffer = appendSamples(buffer, [s(0, 1), s(0, 2), s(0, 3)], 2)
    expect(buffer[0]!.map((x) => x.timestamp)).toEqual([2, 3])
    expect(buffer[1]!.map((x) => x.timestamp)).toEqual([1])
  })
})
