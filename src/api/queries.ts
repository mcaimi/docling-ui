import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type {
  ErrorReport,
  MlflowOverview,
  Preflight,
  RunRecord,
  RunRequest,
  RunView,
  RuntimeView,
  SettingSchema,
  SettingsDefaults,
  Targets,
} from './types'

const POLL_MS = 3000

export function useSettingsSchema() {
  return useQuery({
    queryKey: ['settings-schema'],
    queryFn: () => apiFetch<SettingSchema[]>('/api/settings/schema'),
    staleTime: Infinity,
  })
}

export function useSettingsDefaults() {
  return useQuery({
    queryKey: ['settings-defaults'],
    queryFn: () => apiFetch<SettingsDefaults>('/api/settings/defaults'),
  })
}

export function useTargets() {
  return useQuery({
    queryKey: ['targets'],
    queryFn: () => apiFetch<Targets>('/api/targets'),
    refetchInterval: 30_000,
  })
}

export function useRuns(status?: string) {
  return useQuery({
    queryKey: ['runs', status ?? ''],
    queryFn: () => apiFetch<RunRecord[]>(`/api/runs${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    refetchInterval: 5000,
  })
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: ['run', runId],
    queryFn: () => apiFetch<RunView>(`/api/runs/${encodeURIComponent(runId)}`),
    refetchInterval: (query) => (query.state.data?.final ? false : POLL_MS),
  })
}

export function useMlflowOverview(runId: string, live: boolean) {
  return useQuery({
    queryKey: ['run', runId, 'mlflow'],
    queryFn: () => apiFetch<MlflowOverview>(`/api/runs/${encodeURIComponent(runId)}/mlflow`),
    refetchInterval: live ? POLL_MS : false,
    placeholderData: (previous) => previous,
  })
}

export function useRuntime(runId: string, live: boolean) {
  return useQuery({
    queryKey: ['run', runId, 'runtime'],
    queryFn: () => apiFetch<RuntimeView>(`/api/runs/${encodeURIComponent(runId)}/runtime`),
    refetchInterval: live ? 5000 : false,
    placeholderData: (previous) => previous,
  })
}

export function useErrorReports(runId: string, live: boolean) {
  return useQuery({
    queryKey: ['run', runId, 'errors'],
    queryFn: () => apiFetch<ErrorReport[]>(`/api/runs/${encodeURIComponent(runId)}/errors`),
    refetchInterval: live ? 10_000 : false,
    placeholderData: (previous) => previous,
  })
}

export function useValidate() {
  return useMutation({
    mutationFn: (request: RunRequest) => apiFetch<Preflight>('/api/runs/validate', { method: 'POST', body: request }),
  })
}

export function useLaunch() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: RunRequest) => apiFetch<RunRecord>('/api/runs', { method: 'POST', body: request }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['runs'] }),
  })
}

function useRunAction(action: 'cancel' | 'retry-failed') {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) =>
      apiFetch<RunView>(`/api/runs/${encodeURIComponent(runId)}/${action}`, { method: 'POST' }),
    onSuccess: (view) => {
      client.setQueryData(['run', view.id], view)
      client.invalidateQueries({ queryKey: ['run', view.id] })
      client.invalidateQueries({ queryKey: ['runs'] })
    },
  })
}

export const useCancelRun = () => useRunAction('cancel')
export const useRetryFailed = () => useRunAction('retry-failed')

export function useDeleteRun() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => apiFetch<void>(`/api/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['runs'] }),
  })
}
