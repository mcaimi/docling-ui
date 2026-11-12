import { useFormContext } from 'react-hook-form'
import type { SettingSchema, SettingsDefaults } from '@/api/types'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { isChanged, toFormValue, type RunFormValues } from '@/lib/settingsForm'

function label(key: string): string {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function SettingField({ spec, defaults }: { spec: SettingSchema; defaults: SettingsDefaults }) {
  const { register, watch, formState } = useFormContext<RunFormValues>()
  const name = `settings.${spec.key}` as const
  const id = `setting-${spec.key}`
  const value = watch(name)
  const error = formState.errors.settings?.[spec.key]?.message
  const changed = isChanged(spec, value, defaults)
  const badge = changed ? (
    <span className="rounded-full bg-accent-track px-1.5 text-[11px] font-medium text-ink">changed</span>
  ) : null
  const describedBy = error ? `${id}-error` : undefined

  let hint: string = spec.description
  if (spec.sensitive) {
    hint = `${spec.description}. ${defaults.secrets[spec.key] ? 'Set in .env' : 'Not set in .env'}; leave empty to keep it.`
  } else if (spec.key === 'max_concurrency') {
    hint = `${spec.description}. Unchanged = automatic (CPU limit for containers).`
  } else if (spec.untrusted) {
    hint = `${spec.description}. Treated as untrusted: it can never set endpoints, credentials or paths.`
  }

  if (spec.type === 'bool') {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-ink">
          <input id={id} type="checkbox" className="size-4 accent-[var(--accent)]" {...register(name)} />
          {label(spec.key)}
          {badge}
        </label>
        <p className="text-xs text-ink-2">{hint}</p>
      </div>
    )
  }

  let control
  if (spec.choices) {
    control = (
      <Select id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...register(name)}>
        {spec.choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </Select>
    )
  } else if (spec.type === 'json' || spec.key === 'user_prompt') {
    control = (
      <Textarea
        id={id}
        spellCheck={spec.key === 'user_prompt'}
        className={spec.type === 'json' ? 'font-mono text-xs' : undefined}
        placeholder={spec.type === 'json' ? (spec.sensitive ? '{"…": "…"}' : '{}') : 'e.g. use hybrid chunking'}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...register(name)}
      />
    )
  } else {
    const defaultText = toFormValue(spec, defaults.values[spec.key])
    control = (
      <Input
        id={id}
        type={spec.sensitive ? 'password' : 'text'}
        inputMode={spec.type === 'int' ? 'numeric' : undefined}
        autoComplete="off"
        placeholder={spec.sensitive ? (defaults.secrets[spec.key] ? '•••••••• (from .env)' : 'not set') : String(defaultText || '')}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...register(name)}
      />
    )
  }

  return (
    <Field id={id} label={label(spec.key)} hint={hint} error={error} badge={badge}>
      {control}
    </Field>
  )
}
