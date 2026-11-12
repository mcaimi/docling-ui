import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { onUnauthorized } from '@/api/client'
import { getToken, setToken } from '@/lib/token'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'

/** Asks for the API token printed by `python -m src.scheduler` when none is stored or it was rejected. */
export function TokenGate({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState(() => Boolean(getToken()))
  const [rejected, setRejected] = useState(false)
  const [value, setValue] = useState('')
  const queryClient = useQueryClient()

  useEffect(
    () =>
      onUnauthorized(() => {
        setRejected(true)
        setHasToken(false)
      }),
    [],
  )

  if (hasToken) return <>{children}</>

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    setToken(value)
    setRejected(false)
    setHasToken(true)
    queryClient.resetQueries()
  }

  return (
    <div className="mx-auto mt-24 max-w-md px-4">
      <Card>
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-ink-2" aria-hidden />
              <h1 className="text-base font-semibold">Connect to the scheduler</h1>
            </div>
            <p className="text-sm text-ink-2">
              Open the URL printed by <code className="rounded bg-surface-2 px-1">python -m src.scheduler</code>, or paste
              its token here.
            </p>
            <Field id="token" label="API token" error={rejected ? 'The scheduler rejected this token' : undefined}>
              <Input
                id="token"
                type="password"
                autoComplete="off"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={rejected}
              />
            </Field>
            <Button type="submit" variant="primary">
              Connect
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
