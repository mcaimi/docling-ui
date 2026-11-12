import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

type Handler = (init: RequestInit & { url: string }) => unknown

/** fetch mock routed by "METHOD /path" (query string ignored); returns the recorded calls. */
export function mockApi(routes: Record<string, Handler | unknown>) {
  const calls: { method: string; url: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      const path = input.split('?')[0]
      const body = init.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ method, url: input, body })
      const key = `${method} ${path}`
      if (!(key in routes)) return new Response(JSON.stringify({ detail: `no mock for ${key}` }), { status: 404 })
      const route = routes[key]
      const result = typeof route === 'function' ? (route as Handler)({ ...init, url: input }) : route
      if (result instanceof Response) return result
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
  return calls
}

export function renderAt(ui: ReactElement, { path, route }: { path: string; route: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<p>navigated</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
