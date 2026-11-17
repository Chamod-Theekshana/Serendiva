'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/lib/api/types'
import type { ContactPrefill } from '@/lib/prefill'
import { cn } from '@/lib/utils'
import { FormStatus, useFormFailureMessage } from '@/components/forms/FormStatus'
import { Icon } from '@/components/ui/Icon'
import { INTEREST_IDS, WIZARD_STEPS, extraInterestLabel, travelWindowOptions, type InterestId } from './wizard-config'
import {
  STEP_COUNT,
  STEP_FIELDS,
  draftStorage,
  initialWizardState,
  prefillSignature,
  restoreDraft,
  sendInquiry,
  stepOfField,
  wizardSchema,
  type WizardField,
  type WizardLabels,
  type WizardValues,
} from './wizard-model'
import { StepDates, StepDetails, StepParty, StepPassions } from './WizardSteps'
import { WizardSuccess } from './WizardSuccess'

export interface WizardAbout {
  kind: 'tour' | 'destination'
  title: string
}

export interface InquiryWizardProps {
  /** Sanitised /contact query (parseContactPrefill). */
  prefill: ContactPrefill
  /** 'YYYY-MM-DD' from the server, so the generated travel windows match between SSR and hydration. */
  today: string
  /** Title of the prefilled tour/destination for the "About: …" chip (null when none / not found). */
  about: WizardAbout | null
  /** Guide's name (settings) for the WhatsApp message on the success panel. */
  guideName: string
}

type FocusTarget = WizardField | 'heading'

/** Fields without a focusable input of their own (guest steppers, hidden fields) → focus the step heading. */
const UNFOCUSABLE: ReadonlySet<WizardField> = new Set<WizardField>(['adults', 'children', 'website', 'turnstileToken'])

const isInterestId = (value: string): value is InterestId => (INTEREST_IDS as readonly string[]).includes(value)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The /contact "Plan My Trip" wizard (Stitch: plan_my_trip_bespoke_inquiry). Four steps with per-step Zod
 * validation, step tabs + progress bar, screen-reader step announcements, a sessionStorage draft, server
 * error routing back to the right step, and the success panel with the inquiry reference.
 */
export function InquiryWizard({ prefill, today, about, guideName }: InquiryWizardProps) {
  const t = useTranslations('contact.wizard')
  const locale = useLocale() as Locale
  const failureMessage = useFormFailureMessage()

  const windows = useMemo(() => travelWindowOptions(today), [today])
  const initial = useMemo(() => initialWizardState(prefill, windows, today, locale), [prefill, windows, today, locale])
  const context = useMemo(() => prefillSignature(prefill), [prefill])

  const form = useForm<WizardValues, unknown, WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: initial.values,
    mode: 'onTouched',
    shouldFocusError: false,
  })

  const [step, setStep] = useState(0)
  const [reference, setReference] = useState<string | null>(null)
  const [extraInterests, setExtraInterests] = useState<string[]>(initial.extraInterests)
  const [aboutDismissed, setAboutDismissed] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [restored, setRestored] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const pendingFocus = useRef<FocusTarget | null>(null)
  const draftReady = useRef(false)

  // ---------------------------------------------------------------------------------------------- labels

  const windowLabel = useCallback(
    (value: string) => {
      const option = windows.find((w) => w.value === value)
      if (!option) return value
      const monthName = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
      const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      const date = (index: number) => new Date(Date.UTC(Math.floor(index / 12), index % 12, 15))
      switch (option.kind) {
        case 'immediate':
          return t('dates.windows.immediate')
        case 'season': {
          const sameYear = Math.floor(option.start / 12) === Math.floor(option.end / 12)
          const from = (sameYear ? monthName : monthYear).format(date(option.start))
          const range = `${from} – ${monthYear.format(date(option.end))}`
          return t('dates.windows.season', { range, note: t(`dates.windows.notes.${option.season}`) })
        }
        case 'later':
          return t('dates.windows.later', { month: monthYear.format(date(option.from)) })
        default:
          return option.label
      }
    },
    [windows, locale, t],
  )

  const labels: WizardLabels = useMemo(
    () => ({
      travelWindow: windowLabel,
      flexibility: (id) => t(`dates.flexibility.${id}`),
      duration: (id) => t(`dates.durations.${id}.title`),
      pace: (id) => t(`dates.paces.${id}.title`),
      stay: (id) => t(`passions.stays.${id}.title`),
      interest: (value) => (isInterestId(value) ? t(`passions.interests.${value}`) : extraInterestLabel(value)),
    }),
    [windowLabel, t],
  )

  // ---------------------------------------------------------------------------------------------- draft

  // Restore a draft from this browser tab (after hydration, so server and client render the same first frame).
  useEffect(() => {
    const draft = restoreDraft(
      draftStorage.read(),
      initial,
      context,
      windows.map((w) => w.value),
    )
    const frame = window.requestAnimationFrame(() => {
      if (draft) {
        form.reset(draft.values)
        setExtraInterests(draft.extraInterests)
        setAboutDismissed(draft.aboutDismissed)
        setStep(draft.step)
        setRestored(true)
      }
      draftReady.current = true
    })
    return () => window.cancelAnimationFrame(frame)
  }, [form, initial, context, windows])

  const saveDraft = useCallback(() => {
    if (!draftReady.current || reference) return
    const { website: _website, turnstileToken: _token, ...values } = form.getValues()
    draftStorage.write({ v: 1, context, step, aboutDismissed, extraInterests, values })
  }, [form, context, step, aboutDismissed, extraInterests, reference])

  useEffect(() => {
    saveDraft()
    return form.subscribe({ formState: { values: true }, callback: saveDraft })
  }, [form, saveDraft])

  // ---------------------------------------------------------------------------------------------- navigation

  // Move focus (step heading or a field with a server error) once the new step has rendered.
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    const card = cardRef.current
    if (card && card.getBoundingClientRect().top < 0) {
      card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    }
    if (target === 'heading' || UNFOCUSABLE.has(target)) headingRef.current?.focus({ preventScroll: true })
    else form.setFocus(target)
  }, [step, reference, form])

  const goTo = (target: number, focus: FocusTarget = 'heading') => {
    pendingFocus.current = focus
    setStep(target)
    setAnnouncement(
      t('announceStep', { current: target + 1, total: STEP_COUNT, title: t(`steps.${WIZARD_STEPS[target]!}`) }),
    )
  }

  const focusField = (field: WizardField) => {
    if (UNFOCUSABLE.has(field)) headingRef.current?.focus()
    else form.setFocus(field)
  }

  const firstInvalidField = (index: number): WizardField | undefined =>
    STEP_FIELDS[index]!.find((field) => form.getFieldState(field).invalid)

  const next = async () => {
    setFormError(null)
    const valid = await form.trigger([...STEP_FIELDS[step]!], { shouldFocus: true })
    if (valid) goTo(step + 1)
  }

  const back = () => {
    setFormError(null)
    goTo(Math.max(0, step - 1))
  }

  /** Step tabs: going back is free; going forward validates every step on the way. */
  const jumpTo = async (target: number) => {
    if (target === step) return
    if (target < step) return goTo(target)
    for (let index = step; index < target; index++) {
      const valid = await form.trigger([...STEP_FIELDS[index]!], { shouldFocus: index === step })
      if (!valid) {
        if (index !== step) goTo(index, firstInvalidField(index) ?? 'heading')
        return
      }
    }
    goTo(target)
  }

  // ---------------------------------------------------------------------------------------------- submit

  const onValid = async (values: WizardValues) => {
    setFormError(null)
    setSubmitting(true)
    const outcome = await sendInquiry(values, {
      locale,
      labels,
      tourSlug: aboutDismissed ? undefined : prefill.tour,
      destinationSlug: aboutDismissed ? undefined : prefill.destination,
      source: prefill.source,
    })
    setSubmitting(false)

    if (outcome.kind === 'success') {
      draftStorage.clear()
      draftReady.current = false
      pendingFocus.current = 'heading'
      setReference(outcome.reference)
      setAnnouncement('')
      return
    }
    if (outcome.kind === 'invalid') {
      const { fields, form: formMessages, step: target } = outcome.errors
      for (const { field, message } of fields) form.setError(field, { type: 'server', message })
      setFormError(formMessages.length > 0 ? formMessages.join(' ') : failureMessage(outcome.failure))
      const firstField = fields[0]?.field
      if (target !== step) goTo(target, firstField ?? 'heading')
      else if (firstField) focusField(firstField)
      return
    }
    setFormError(failureMessage(outcome.failure))
  }

  /** Client validation failed on submit (e.g. a restored draft): open the first step with an error. */
  const onInvalid = (errors: FieldErrors<WizardValues>) => {
    const fields = Object.keys(errors) as WizardField[]
    if (fields.length === 0) return
    const target = Math.min(...fields.map(stepOfField))
    const field = STEP_FIELDS[target]!.find((f) => fields.includes(f))
    if (target !== step) goTo(target, field ?? 'heading')
    else if (field) focusField(field)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // Enter inside a field on steps 1–3 means "continue", never "send".
    if (step < STEP_COUNT - 1) {
      event.preventDefault()
      void next()
      return
    }
    void form.handleSubmit(onValid, onInvalid)(event)
  }

  const restart = () => {
    draftStorage.clear()
    form.reset(initial.values)
    setExtraInterests(initial.extraInterests)
    setAboutDismissed(false)
    setReference(null)
    setRestored(false)
    draftReady.current = true
    goTo(0)
  }

  // ---------------------------------------------------------------------------------------------- render

  const done = reference !== null
  const progress = done ? 100 : ((step + 1) / STEP_COUNT) * 100
  const status = formError ? <FormStatus state={{ kind: 'error', message: formError }} /> : null
  const showAbout = about && !aboutDismissed && !done
  const stepProps = { form, headingRef, status, headingId: `wizard-step-${step + 1}-title` }

  return (
    <div
      ref={cardRef}
      id="plan-my-trip"
      className="relative scroll-mt-24 overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-xl md:p-space-xl"
    >
      <div className="w-full border-b border-surface-container pb-space-lg">
        {showAbout && (
          <div className="mb-space-md flex">
            <span className="inline-flex max-w-full items-center gap-space-xs rounded-full bg-secondary-fixed/60 py-space-xs pl-space-md pr-space-xs font-label-md text-label-md text-on-secondary-fixed-variant">
              <Icon name={about.kind === 'tour' ? 'route' : 'location_on'} className="shrink-0 text-sm" />
              <span className="truncate">{t('about', { title: about.title })}</span>
              <button
                type="button"
                onClick={() => setAboutDismissed(true)}
                aria-label={t('aboutRemove', { title: about.title })}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-secondary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon name="close" className="text-sm" />
              </button>
            </span>
          </div>
        )}

        <ol aria-label={t('stepsLabel')} className="grid grid-cols-2 gap-space-sm md:grid-cols-4">
          {WIZARD_STEPS.map((id, index) => {
            const active = index === step && !done
            const completed = done || index < step
            return (
              <li key={id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => void jumpTo(index)}
                  disabled={done}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-space-xs rounded-lg p-space-sm text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default',
                    active ? 'bg-surface-container' : 'hover:bg-surface-container/60 disabled:hover:bg-transparent',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-label-md text-label-md',
                      active ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        'font-label-md text-label-md uppercase tracking-wider',
                        active ? 'text-on-surface-variant' : 'text-on-surface-variant',
                      )}
                    >
                      {t('stepLabel', { number: index + 1 })}
                      {completed && <span className="sr-only"> ({t('stepCompleted')})</span>}
                    </span>
                    <span
                      className={cn(
                        'truncate font-body-md text-body-md',
                        active ? 'font-semibold text-primary' : 'text-on-surface-variant',
                      )}
                    >
                      {t(`steps.${id}`)}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>

        <div
          role="progressbar"
          aria-label={t('progressLabel')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-valuetext={t('progressValue', { current: done ? STEP_COUNT : step + 1, total: STEP_COUNT })}
          className="mt-space-md h-1.5 w-full overflow-hidden rounded-full bg-surface-container"
        >
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {restored && !done && (
          <p
            role="status"
            className="mt-space-sm flex items-center gap-1 font-caption text-caption text-on-surface-variant"
          >
            <Icon name="history" className="text-sm text-tertiary" />
            {t('draftRestored')}
          </p>
        )}
      </div>

      <form noValidate aria-label={t('formLabel')} onSubmit={onSubmit} className="pt-space-lg">
        {done ? (
          <WizardSuccess reference={reference} guideName={guideName} headingRef={headingRef} onRestart={restart} />
        ) : step === 0 ? (
          <StepParty {...stepProps} onNext={() => void next()} />
        ) : step === 1 ? (
          <StepDates
            {...stepProps}
            onNext={() => void next()}
            onBack={back}
            windows={windows}
            windowLabel={windowLabel}
          />
        ) : step === 2 ? (
          <StepPassions {...stepProps} onNext={() => void next()} onBack={back} extraInterests={extraInterests} />
        ) : (
          <StepDetails {...stepProps} onBack={back} submitting={submitting} />
        )}
      </form>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
