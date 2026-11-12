import { useEffect, useRef, useState } from 'react'
import { logStreamUrl } from '@/api/client'
import type { LogEntry } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { cn } from '@/lib/utils'

const MAX_LINES = 2000
const LEVEL_INK: Record<string, string> = {
  ERROR: 'text-critical-text font-semibold',
  CRITICAL: 'text-critical-text font-semibold',
  WARNING: 'text-ink font-semibold',
}

export function LogViewer({ runId, shardCount, live }: { runId: string; shardCount: number; live: boolean }) {
  const [shard, setShard] = useState(0)
  const [level, setLevel] = useState('')
  const [file, setFile] = useState('')
  const [appliedFile, setAppliedFile] = useState('')
  const [lines, setLines] = useState<LogEntry[]>([])
  const [state, setState] = useState<'connecting' | 'streaming' | 'ended' | 'error'>('connecting')
  const [detail, setDetail] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  useEffect(() => {
    setLines([])
    setState('connecting')
    setDetail(null)
    const source = new EventSource(
      logStreamUrl(runId, { shard, level, file: appliedFile, follow: live, tail: live ? 500 : undefined }),
    )
    let buffer: LogEntry[] = []
    const flush = setInterval(() => {
      if (!buffer.length) return
      const batch = buffer
      buffer = []
      setLines((current) => [...current, ...batch].slice(-MAX_LINES))
    }, 250)
    source.onopen = () => setState('streaming')
    source.onmessage = (event) => {
      try {
        buffer.push(JSON.parse(event.data) as LogEntry)
      } catch {
        buffer.push({ msg: String(event.data) })
      }
    }
    source.addEventListener('end', () => {
      setState('ended')
      source.close()
    })
    source.addEventListener('error', (event) => {
      const data = (event as MessageEvent).data
      if (data) {
        try {
          setDetail((JSON.parse(data) as { detail?: string }).detail ?? null)
        } catch {
          /* not a server-sent error event */
        }
      }
      if (source.readyState === EventSource.CLOSED || data) {
        setState('error')
        source.close()
      }
    })
    return () => {
      clearInterval(flush)
      source.close()
    }
  }, [runId, shard, level, appliedFile, live])

  useEffect(() => {
    if (pinned.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [lines])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Shard
          <Select value={shard} onChange={(e) => setShard(Number(e.target.value))} className="w-24">
            {Array.from({ length: shardCount }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Level
          <Select value={level} onChange={(e) => setLevel(e.target.value)} className="w-32">
            <option value="">All</option>
            <option value="DEBUG">Debug</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
          </Select>
        </label>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setAppliedFile(file.trim())
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-ink-2">
            File
            <Input value={file} onChange={(e) => setFile(e.target.value)} placeholder="exact file name" className="w-56" />
          </label>
          <Button type="submit" size="sm">
            Filter
          </Button>
        </form>
        <span className="ml-auto text-xs text-ink-2" aria-live="polite">
          {state === 'connecting' && 'Connecting…'}
          {state === 'streaming' && (live ? 'Live' : 'Loading…')}
          {state === 'ended' && `${lines.length} lines`}
          {state === 'error' && (detail ?? 'Log stream unavailable')}
        </span>
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
        className="h-96 overflow-auto rounded-md bg-surface-2 p-2 font-mono text-xs leading-5"
        role="log"
        aria-label={`Logs of shard ${shard}`}
      >
        {lines.length === 0 ? (
          <p className="p-2 text-ink-2">{state === 'ended' ? 'No log lines.' : 'Waiting for log lines…'}</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex gap-2 whitespace-pre-wrap">
              {line.ts && <span className="shrink-0 text-muted">{line.ts.slice(11, 19)}</span>}
              {line.level && <span className={cn('w-14 shrink-0 text-ink-2', LEVEL_INK[line.level])}>{line.level}</span>}
              <span className="min-w-0 text-ink">{line.msg}</span>
              {line.file && <span className="shrink-0 text-ink-2">[{line.file}{line.stage ? ` · ${line.stage}` : ''}]</span>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
