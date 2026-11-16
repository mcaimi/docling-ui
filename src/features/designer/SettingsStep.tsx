import type { Ref } from 'react'
import type { SettingsDefaults } from '@/api/types'
import { Card, CardBody } from '@/components/ui/card'
import type { WizardStep } from '@/lib/settingsForm'
import { SettingField } from './SettingField'

export function SettingsStep({
  step,
  defaults,
  changed,
  headingRef,
}: {
  step: WizardStep
  defaults: SettingsDefaults
  changed: number
  headingRef: Ref<HTMLHeadingElement>
}) {
  return (
    <Card>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-grid px-4 py-3">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold text-ink focus:outline-none">
            {step.title}
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {step.required ? 'Required.' : "Optional: skip it to keep the scheduler's defaults."}
          </p>
        </div>
        {changed > 0 && <span className="text-xs text-ink-2">{changed} changed</span>}
      </header>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {step.settings.map((spec) => (
          <div key={spec.key} className={spec.type === 'json' || spec.key === 'user_prompt' ? 'sm:col-span-2' : undefined}>
            <SettingField spec={spec} defaults={defaults} />
          </div>
        ))}
      </CardBody>
    </Card>
  )
}
