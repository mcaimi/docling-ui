import type { DocumentRow, DocumentsPage, MetricPoint, MlflowOverview, ResourceSample } from '@/api/types'

export interface SeriesPoint {
  t: number // epoch ms
  value: number
}

/**
 * Total of a cumulative metric across shards over time.
 *
 * Steps are per shard (step = that shard's docs_completed), so shards can't be
 * aligned by step: at every timestamp where any shard reported, the total is
 * the sum of each shard's latest value so far.
 */
export function totalOverTime(overview: MlflowOverview | undefined, metric: string): SeriesPoint[] {
  if (!overview) return []
  const perShard: MetricPoint[][] = Object.values(overview.history)
    .map((byMetric) => [...(byMetric[metric] ?? [])].sort((a, b) => a[2] - b[2]))
    .filter((points) => points.length > 0)
  const timestamps = [...new Set(perShard.flatMap((points) => points.map((p) => p[2])))].sort((a, b) => a - b)
  const cursor = perShard.map(() => -1)
  return timestamps.map((t) => {
    let total = 0
    perShard.forEach((points, i) => {
      while (cursor[i]! + 1 < points.length && points[cursor[i]! + 1]![2] <= t) cursor[i]!++
      if (cursor[i]! >= 0) total += points[cursor[i]!]![1]
    })
    return { t, value: total }
  })
}

/** Prepend a zero point at the run start so the area grows from the baseline. */
export function withOrigin(series: SeriesPoint[], startMs: number | undefined): SeriesPoint[] {
  if (!series.length || startMs === undefined || series[0]!.t <= startMs) return series
  return [{ t: startMs, value: 0 }, ...series]
}

export interface DocumentsState {
  generation: string | null
  lastSeq: number
  rows: DocumentRow[]
}

export const emptyDocuments: DocumentsState = { generation: null, lastSeq: 0, rows: [] }

/** Merge an incremental page; a new generation (scheduler restart) replaces everything. */
export function mergeDocuments(state: DocumentsState, page: DocumentsPage): DocumentsState {
  const restarted = state.generation !== null && state.generation !== page.generation
  const base = restarted || state.generation === null ? [] : state.rows
  const seen = new Set(base.map((r) => r.seq))
  const rows = [...base, ...page.rows.filter((r) => !seen.has(r.seq))]
  return { generation: page.generation, lastSeq: page.last_seq, rows }
}

/** Rolling per-shard buffer of resource samples for sparklines. */
export function appendSamples(
  buffer: Record<number, ResourceSample[]>,
  samples: ResourceSample[],
  limit = 30,
): Record<number, ResourceSample[]> {
  const next = { ...buffer }
  for (const sample of samples) {
    const series = next[sample.shard_index] ?? []
    if (series.length && series[series.length - 1]!.timestamp === sample.timestamp) continue
    next[sample.shard_index] = [...series, sample].slice(-limit)
  }
  return next
}
