import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/api/client'
import type { DocumentsPage } from '@/api/types'
import { emptyDocuments, mergeDocuments, type DocumentsState } from '@/lib/progress'

/** Incremental per-document rows: polls with the server's discovery cursor. */
export function useDocuments(runId: string, live: boolean, intervalMs = 3000) {
  const [state, setState] = useState<DocumentsState>(emptyDocuments)
  const [error, setError] = useState<Error | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const fetchPage = useCallback(async () => {
    const current = stateRef.current
    const params = new URLSearchParams({ after: String(current.lastSeq) })
    if (current.generation) params.set('generation', current.generation)
    try {
      const page = await apiFetch<DocumentsPage>(`/api/runs/${encodeURIComponent(runId)}/documents?${params}`)
      setState((s) => mergeDocuments(s, page))
      setError(null)
    } catch (e) {
      setError(e as Error)
    }
  }, [runId])

  useEffect(() => {
    setState(emptyDocuments)
    stateRef.current = emptyDocuments
  }, [runId])

  useEffect(() => {
    void fetchPage()
    if (!live) return
    const timer = setInterval(() => void fetchPage(), intervalMs)
    return () => clearInterval(timer)
  }, [fetchPage, live, intervalMs])

  return { rows: state.rows, error, refresh: fetchPage }
}
