import { clearToken, getToken } from '@/lib/token'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown = null,
  ) {
    super(message)
  }
}

type Listener = () => void
const unauthorizedListeners = new Set<Listener>()

/** Called when the API rejects the token (the app shows the token prompt). */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (response.status === 204) return undefined as T
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (response.status === 401) {
    clearToken()
    unauthorizedListeners.forEach((l) => l())
  }
  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `HTTP ${response.status}`
    throw new ApiError(response.status, detail, body)
  }
  return body as T
}

/** EventSource can't send headers; the log endpoint accepts ?token=. */
export function logStreamUrl(runId: string, params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const token = getToken()
  if (token) query.set('token', token)
  return `/api/runs/${encodeURIComponent(runId)}/logs?${query.toString()}`
}
