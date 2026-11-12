import { useFormContext, useWatch } from 'react-hook-form'
import type { Targets } from '@/api/types'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import { executorCapabilities } from '@/lib/executor'
import { usesHostFolder, usesLocalSource, type RunFormValues } from '@/lib/settingsForm'

export function TargetPanel({ targets }: { targets: Targets }) {
  const { register, formState, control } = useFormContext<RunFormValues>()
  const sourceBackend = useWatch({ control, name: 'settings.source_backend' })
  const executor = targets.executor
  const capabilities = executorCapabilities(targets)
  const hostFolder = usesHostFolder({ source_backend: sourceBackend }, capabilities)
  const errors = formState.errors.target
  const availability = targets[executor.name]
  const description =
    executor.name === 'kubernetes'
      ? `Each shard runs as a Kubernetes Job${availability?.namespace ? ` in namespace ${availability.namespace}` : ''}.`
      : 'Each shard runs in its own Podman container.'

  return (
    <Card>
      <CardHeader
        title="Target"
        description={description}
      />
      <CardBody className="flex flex-col gap-4">
        {availability && !availability.available && (
          <Alert tone="critical" title={`${executor.name} unavailable`}>
            {availability.error}
          </Alert>
        )}
        {availability?.warning && <Alert tone="warning">{availability.warning}</Alert>}
        {!capabilities.local_source && usesLocalSource({ source_backend: sourceBackend }) && (
          <Alert tone="warning" title="S3 source required">
            The {executor.name} executor can't mount folders from this machine. Set the source backend to s3.
          </Alert>
        )}
        {hostFolder && (
          <Field
            id="target-host-folder"
            label="Document folder"
            hint="Absolute host path, mounted read-only at /data/in."
            error={errors?.host_folder?.message}
          >
            <Input
              id="target-host-folder"
              placeholder="/home/me/documents"
              aria-invalid={Boolean(errors?.host_folder)}
              {...register('target.host_folder')}
            />
          </Field>
        )}
        <Field id="target-shards" label="Shards" hint="Parallel instances; each processes every N-th document." error={errors?.shards?.message}>
          <Input id="target-shards" inputMode="numeric" aria-invalid={Boolean(errors?.shards)} {...register('target.shards')} />
        </Field>
        <Field
          id="target-image"
          label="Image"
          hint={capabilities.local_images ? undefined : 'Pulled by the cluster from a registry, so it must be reachable from there.'}
          error={errors?.image?.message}
        >
          <Input id="target-image" placeholder={targets.default_image} {...register('target.image')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="target-cpus" label="CPUs" hint="Per shard" error={errors?.cpus?.message}>
            <Input id="target-cpus" inputMode="decimal" placeholder="unlimited" aria-invalid={Boolean(errors?.cpus)} {...register('target.cpus')} />
          </Field>
          <Field id="target-memory" label="Memory" hint="e.g. 4g" error={errors?.memory?.message}>
            <Input id="target-memory" placeholder="unlimited" aria-invalid={Boolean(errors?.memory)} {...register('target.memory')} />
          </Field>
        </div>
      </CardBody>
    </Card>
  )
}
