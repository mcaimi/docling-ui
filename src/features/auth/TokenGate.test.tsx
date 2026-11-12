import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getToken, setToken } from '@/lib/token'
import { mockApi, renderAt } from '@/test/utils'
import { useRuns } from '@/api/queries'
import { TokenGate } from './TokenGate'

function Probe() {
  const runs = useRuns()
  return <p>{runs.data ? `runs: ${runs.data.length}` : 'loading'}</p>
}

describe('TokenGate', () => {
  it('asks for a token, then shows the app', async () => {
    mockApi({ 'GET /api/runs': [] })
    renderAt(<TokenGate><Probe /></TokenGate>, { path: '/', route: '/' })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('API token'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Connect' }))
    expect(await screen.findByText('runs: 0')).toBeInTheDocument()
    expect(getToken()).toBe('secret')
  })

  it('returns to the prompt when the token is rejected', async () => {
    setToken('stale')
    mockApi({ 'GET /api/runs': () => new Response(JSON.stringify({ detail: 'missing or invalid token' }), { status: 401 }) })
    renderAt(<TokenGate><Probe /></TokenGate>, { path: '/', route: '/' })
    expect(await screen.findByText('The scheduler rejected this token')).toBeInTheDocument()
    expect(getToken()).toBeNull()
  })
})
