'use client'

import type { ReactNode, RefObject } from 'react'
import { useController, useWatch, type UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Honeypot } from '@/components/forms/Honeypot'
import { Turnstile } from '@/components/forms/Turnstile'
import { Field, Input, Select, Textarea, useFieldErrorText } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import {
  CALLING_CODES,
  DURATION_IDS,
  FLEXIBILITY_IDS,
  INTEREST_OPTIONS,
  PACE_IDS,
  PARTY_OPTIONS,
  STAY_OPTIONS,
  extraInterestLabel,
  type TravelWindowOption,
} from './wizard-config'
import type { WizardValues } from './wizard-model'
import {
  BackButton,
  GroupLegend,
  InterestChip,
  NextButton,
  OptionCard,
  PartyCard,
  StayCard,
  StepHeader,
  Stepper,
} from './WizardControls'

/* The four panels of the /contact wizard (only the current one is mounted; react-hook-form keeps the values). */

// The resolver output equals the input shape (strings are only trimmed), so one type serves both generics.
export type WizardForm = UseFormReturn<WizardValues, unknown, WizardValues>

interface StepProps {
  form: WizardForm
  headingId: string
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Error / status message rendered above the action bar. */
  status?: ReactNode
}

/** Stitch white-on-sand controls: sand-low fill, xl radius, roomy padding. */
const fieldControl = 'rounded-xl bg-surface-container-low px-space-md py-space-md shadow-none'

const ACTIONS = 'flex items-center pt-space-md'

// ------------------------------------------------------------------------------------------------ step 1

export function StepParty({ form, headingId, headingRef, status, onNext }: StepProps & { onNext: () => void }) {
  const t = useTranslations('contact.wizard.party')
  const {
    control,
    register,
    formState: { errors },
  } = form
  const adults = useController({ control, name: 'adults' })
  const children = useController({ control, name: 'children' })
  const partyError = errors.partyType?.message
  const guestsError = errors.adults?.message ?? errors.children?.message

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-space-xl">
      <StepHeader id={headingId} headingRef={headingRef} eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')} />

      <div>
        <div
          role="radiogroup"
          aria-labelledby={headingId}
          aria-describedby={partyError ? 'wizard-party-error' : undefined}
          className="grid grid-cols-1 gap-space-md sm:grid-cols-2 md:grid-cols-3"
        >
          {PARTY_OPTIONS.map((option) => (
            <PartyCard
              key={option.id}
              icon={option.icon}
              title={t(`options.${option.id}.title`)}
              body={t(`options.${option.id}.body`)}
              className={option.wide ? 'sm:col-span-2 md:col-span-2' : undefined}
              input={{ value: option.id, ...register('partyType') }}
            />
          ))}
        </div>
        {partyError && <FieldError id="wizard-party-error" message={partyError} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-space-lg rounded-xl bg-surface-container-low p-space-lg">
        <div className="flex min-w-[12rem] flex-1 flex-col">
          <span className="font-headline-sm text-headline-sm text-primary">{t('guestsTitle')}</span>
          <span className="font-caption text-caption text-on-surface-variant">{t('guestsBody')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-space-md sm:gap-space-lg">
          <Stepper
            id="wizard-adults"
            label={t('adults')}
            value={adults.field.value}
            min={1}
            max={50}
            onChange={adults.field.onChange}
          />
          <Stepper
            id="wizard-children"
            label={t('children')}
            value={children.field.value}
            min={0}
            max={50}
            onChange={children.field.onChange}
          />
        </div>
        {guestsError && <FieldError id="wizard-guests-error" message={guestsError} className="mt-0 w-full" />}
      </div>

      {status}
      <div className={cn(ACTIONS, 'justify-end')}>
        <NextButton onClick={onNext}>{t('next')}</NextButton>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------------------------------------ step 2

export function StepDates({
  form,
  headingId,
  headingRef,
  status,
  onNext,
  onBack,
  windows,
  windowLabel,
}: StepProps & {
  onNext: () => void
  onBack: () => void
  windows: readonly TravelWindowOption[]
  windowLabel: (value: string) => string
}) {
  const t = useTranslations('contact.wizard.dates')
  const tw = useTranslations('contact.wizard')
  const {
    register,
    formState: { errors },
  } = form
  const durationError = errors.durationPreference?.message
  const paceError = errors.pace?.message

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-space-xl">
      <StepHeader id={headingId} headingRef={headingRef} eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')} />

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        <Field label={t('windowLabel')} error={errors.travelWindow?.message} id="wizard-travel-window">
          <div className="relative">
            <Select variant="muted" className={cn(fieldControl, 'appearance-none pr-12')} {...register('travelWindow')}>
              {windows.map((w) => (
                <option key={w.value} value={w.value}>
                  {windowLabel(w.value)}
                </option>
              ))}
            </Select>
            <Icon
              name="calendar_month"
              className="pointer-events-none absolute right-space-md top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
          </div>
        </Field>
        <Field label={t('flexibilityLabel')} error={errors.flexibility?.message} id="wizard-flexibility">
          <div className="relative">
            <Select variant="muted" className={cn(fieldControl, 'appearance-none pr-12')} {...register('flexibility')}>
              {FLEXIBILITY_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`flexibility.${id}`)}
                </option>
              ))}
            </Select>
            <Icon
              name="sync_alt"
              className="pointer-events-none absolute right-space-md top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
          </div>
        </Field>
      </div>

      <fieldset aria-describedby={durationError ? 'wizard-duration-error' : undefined}>
        <GroupLegend>{t('durationLabel')}</GroupLegend>
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 lg:grid-cols-3">
          {DURATION_IDS.map((id) => (
            <OptionCard
              key={id}
              title={t(`durations.${id}.title`)}
              body={t(`durations.${id}.body`)}
              className={id === 'flexible' ? 'sm:col-span-2 lg:col-span-2' : undefined}
              input={{ value: id, ...register('durationPreference') }}
            />
          ))}
        </div>
        {durationError && <FieldError id="wizard-duration-error" message={durationError} />}
      </fieldset>

      <fieldset aria-describedby={paceError ? 'wizard-pace-error' : undefined}>
        <GroupLegend>{t('paceLabel')}</GroupLegend>
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
          {PACE_IDS.map((id) => (
            <OptionCard
              key={id}
              tone="accent"
              title={t(`paces.${id}.title`)}
              body={t(`paces.${id}.body`)}
              input={{ value: id, ...register('pace') }}
            />
          ))}
        </div>
        {paceError && <FieldError id="wizard-pace-error" message={paceError} />}
      </fieldset>

      {status}
      <div className={cn(ACTIONS, 'justify-between gap-space-md')}>
        <BackButton onClick={onBack}>{tw('back')}</BackButton>
        <NextButton onClick={onNext}>{t('next')}</NextButton>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------------------------------------ step 3

export function StepPassions({
  form,
  headingId,
  headingRef,
  status,
  onNext,
  onBack,
  extraInterests,
}: StepProps & { onNext: () => void; onBack: () => void; extraInterests: readonly string[] }) {
  const t = useTranslations('contact.wizard.passions')
  const tw = useTranslations('contact.wizard')
  const {
    register,
    formState: { errors },
  } = form
  const interestsError = errors.interests?.message ?? errors.interests?.root?.message
  const stayError = errors.stayStyle?.message

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-space-xl">
      <StepHeader id={headingId} headingRef={headingRef} eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')} />

      <fieldset aria-describedby={interestsError ? 'wizard-interests-error' : undefined}>
        <legend className="sr-only">{t('interestsLabel')}</legend>
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 md:grid-cols-3">
          {INTEREST_OPTIONS.map((option) => (
            <InterestChip
              key={option.id}
              icon={option.icon}
              label={t(`interests.${option.id}`)}
              input={{ value: option.id, ...register('interests') }}
            />
          ))}
          {extraInterests.map((value) => (
            <InterestChip
              key={value}
              icon="star"
              label={extraInterestLabel(value)}
              input={{ value, ...register('interests') }}
            />
          ))}
        </div>
        {interestsError && <FieldError id="wizard-interests-error" message={interestsError} />}
      </fieldset>

      <fieldset aria-describedby={stayError ? 'wizard-stay-error' : undefined}>
        <GroupLegend>{t('stayLabel')}</GroupLegend>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          {STAY_OPTIONS.map((option) => (
            <StayCard
              key={option.id}
              icon={option.icon}
              title={t(`stays.${option.id}.title`)}
              body={t(`stays.${option.id}.body`)}
              input={{ value: option.id, ...register('stayStyle') }}
            />
          ))}
        </div>
        {stayError && <FieldError id="wizard-stay-error" message={stayError} />}
      </fieldset>

      {status}
      <div className={cn(ACTIONS, 'justify-between gap-space-md')}>
        <BackButton onClick={onBack}>{tw('back')}</BackButton>
        <NextButton onClick={onNext}>{t('next')}</NextButton>
      </div>
    </section>
  )
}

/** Error line under a card group (translated validation key or the API's message). */
function FieldError({ id, message, className }: { id: string; message: string; className?: string }) {
  const text = useFieldErrorText(message)
  return (
    <p id={id} className={cn('mt-space-sm flex items-center gap-1 font-caption text-caption text-error', className)}>
      <Icon name="error" className="text-sm" />
      {text}
    </p>
  )
}

// ------------------------------------------------------------------------------------------------ step 4

export function StepDetails({
  form,
  headingId,
  headingRef,
  status,
  onBack,
  submitting,
}: StepProps & { onBack: () => void; submitting: boolean }) {
  const t = useTranslations('contact.wizard.details')
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = form
  const code = useWatch({ control, name: 'whatsappCode' })

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-space-xl">
      <StepHeader id={headingId} headingRef={headingRef} eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')} />

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        <Field label={t('name')} required error={errors.name?.message} id="wizard-name">
          <Input
            variant="muted"
            className={fieldControl}
            autoComplete="name"
            placeholder={t('namePlaceholder')}
            {...register('name')}
          />
        </Field>
        <Field label={t('email')} required error={errors.email?.message} id="wizard-email">
          <Input
            variant="muted"
            className={fieldControl}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            {...register('email')}
          />
        </Field>
        <Field
          label={t('whatsapp')}
          required
          error={errors.whatsappNumber?.message ?? errors.whatsappCode?.message}
          hint={code === 'other' ? t('whatsappOtherHint') : undefined}
          id="wizard-whatsapp"
        >
          <div className="flex items-center gap-space-xs">
            <select
              aria-label={t('whatsappCode')}
              autoComplete="tel-country-code"
              className="w-24 shrink-0 cursor-pointer rounded-xl bg-surface-container-low px-space-sm py-space-md font-body-md text-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              {...register('whatsappCode')}
            >
              {CALLING_CODES.map((c) => (
                <option key={c.key} value={c.code}>
                  {t(`codes.${c.key}`)}
                </option>
              ))}
            </select>
            <Input
              variant="muted"
              className={fieldControl}
              type="tel"
              inputMode="tel"
              autoComplete={code === 'other' ? 'tel' : 'tel-national'}
              placeholder={code === 'other' ? '+353 85 123 4567' : t('whatsappPlaceholder')}
              {...register('whatsappNumber')}
            />
          </div>
        </Field>
        <Field label={t('country')} error={errors.country?.message} id="wizard-country">
          <Input
            variant="muted"
            className={fieldControl}
            autoComplete="country-name"
            placeholder={t('countryPlaceholder')}
            {...register('country')}
          />
        </Field>
      </div>

      <Field label={t('message')} error={errors.message?.message} id="wizard-message">
        <Textarea
          variant="muted"
          rows={4}
          className={cn(fieldControl, 'resize-none p-space-md')}
          placeholder={t('messagePlaceholder')}
          {...register('message')}
        />
      </Field>

      <div className="flex items-start gap-space-sm rounded-xl bg-surface-container p-space-md">
        <Icon name="lock" className="mt-0.5 shrink-0 text-secondary" />
        <div className="flex flex-col">
          <span className="font-body-md text-body-md font-semibold text-primary">{t('guaranteeTitle')}</span>
          <span className="mt-0.5 font-caption text-caption text-on-surface-variant">{t('guaranteeBody')}</span>
        </div>
      </div>

      <Honeypot {...register('website')} />
      <Turnstile action="inquiry" onToken={(token) => setValue('turnstileToken', token)} />

      {status}
      <div className="flex flex-col items-center justify-between gap-space-md pt-space-sm sm:flex-row">
        <BackButton onClick={onBack} className="order-2 sm:order-1">
          {t('back')}
        </BackButton>
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting || undefined}
          className="order-1 inline-flex w-full items-center justify-center gap-space-sm rounded-xl bg-secondary px-space-xl py-space-md text-center font-headline-sm text-headline-sm text-on-secondary shadow-xl transition-all hover:bg-on-secondary-fixed-variant hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-80 sm:order-2 sm:w-auto"
        >
          <Icon name={submitting ? 'progress_activity' : 'send'} className={cn(submitting && 'animate-spin')} />
          <span>{submitting ? t('submitting') : t('submit')}</span>
        </button>
      </div>
    </section>
  )
}
