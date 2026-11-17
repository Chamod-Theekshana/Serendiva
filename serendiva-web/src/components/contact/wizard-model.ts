import { z } from 'zod'
import { submitInquiry, type FormFailure, type FormResult } from '@/lib/api/forms'
import type { InquiryBody, InquiryResult, Locale, PartyType } from '@/lib/api/types'
import type { ContactPrefill } from '@/lib/prefill'
import { msg } from '@/lib/validation/messages'
import { emailSchema, honeypot, requiredText, TRAVELLER_TYPES } from '@/lib/validation/shared'
import {
  CALLING_CODE_VALUES,
  DEFAULT_CALLING_CODE,
  DURATION_IDS,
  FLEXIBILITY_IDS,
  PACE_IDS,
  STAY_IDS,
  defaultTravelWindow,
  interestIdFor,
  travelWindowForMonth,
  type DurationId,
  type FlexibilityId,
  type PaceId,
  type StayId,
  type TravelWindowOption,
} from './wizard-config'

/*
 * Form model of the /contact wizard: Zod schema (per-step validation via STEP_FIELDS), defaults from the
 * /contact prefill, mapping to the API's InquiryBody, server-error → step routing and the sessionStorage draft.
 * Pure TypeScript (no React) so it is unit-tested in src/components/contact/__tests__/contact-wizard.test.ts.
 */

const PHONE_RE = /^\+?[\d\s().-]{5,}$/

export const wizardSchema = z.object({
  partyType: z.enum(TRAVELLER_TYPES, { error: 'required' }),
  adults: z.number({ error: 'required' }).int('integer').min(1, msg('min', 1)).max(50, msg('max', 50)),
  children: z.number({ error: 'required' }).int('integer').min(0, msg('min', 0)).max(50, msg('max', 50)),
  travelWindow: z.string({ error: 'required' }).min(1, 'required').max(60, msg('tooLong', 60)),
  flexibility: z.enum(FLEXIBILITY_IDS, { error: 'required' }),
  durationPreference: z.enum(DURATION_IDS, { error: 'required' }),
  pace: z.enum(PACE_IDS, { error: 'required' }),
  interests: z.array(z.string().trim().min(1).max(60, msg('tooLong', 60))).max(20, msg('tooMany', 20)),
  stayStyle: z.enum(STAY_IDS, { error: 'required' }),
  name: requiredText(120, 2, 'nameTooShort'),
  email: emailSchema,
  whatsappCode: z.enum(CALLING_CODE_VALUES),
  whatsappNumber: z
    .string({ error: 'required' })
    .trim()
    .min(1, 'required')
    .max(32, msg('tooLong', 32))
    .regex(PHONE_RE, 'phone'),
  country: z.string().trim().max(80, msg('tooLong', 80)),
  message: z.string().trim().max(5000, msg('tooLong', 5000)),
  website: honeypot,
  turnstileToken: z.string().max(4096).optional(),
})

export type WizardValues = z.input<typeof wizardSchema>
export type WizardField = keyof WizardValues

/** Fields validated before leaving each step (index = step - 1). */
export const STEP_FIELDS = [
  ['partyType', 'adults', 'children'],
  ['travelWindow', 'flexibility', 'durationPreference', 'pace'],
  ['interests', 'stayStyle'],
  ['name', 'email', 'whatsappCode', 'whatsappNumber', 'country', 'message'],
] as const satisfies readonly (readonly WizardField[])[]

export const STEP_COUNT = STEP_FIELDS.length

/** 0-based step that contains a form field (unknown fields → last step, where the submit button lives). */
export function stepOfField(field: string): number {
  const index = STEP_FIELDS.findIndex((fields) => (fields as readonly string[]).includes(field))
  return index === -1 ? STEP_COUNT - 1 : index
}

/** API field names (InquiryBody) → wizard field names. Fields not in the form go to the form-level error. */
const API_TO_FORM: Record<string, WizardField> = {
  whatsapp: 'whatsappNumber',
  partyType: 'partyType',
  adults: 'adults',
  children: 'children',
  travelWindow: 'travelWindow',
  flexibility: 'flexibility',
  durationPreference: 'durationPreference',
  pace: 'pace',
  interests: 'interests',
  stayStyle: 'stayStyle',
  name: 'name',
  email: 'email',
  country: 'country',
  message: 'message',
}

export interface MappedServerErrors {
  /** Errors on wizard fields, in step order. */
  fields: { field: WizardField; message: string }[]
  /** Messages for API fields the visitor can't edit (tourSlug, locale…). */
  form: string[]
  /** 0-based step to show (first step with an error; last step when only form-level errors). */
  step: number
}

/** Routes API validation errors (`{ email: '…', whatsapp: '…' }`) to wizard fields and the step to jump to. */
export function mapServerErrors(fieldErrors: Record<string, string>): MappedServerErrors {
  const fields: MappedServerErrors['fields'] = []
  const form: string[] = []
  for (const [apiField, message] of Object.entries(fieldErrors)) {
    const field = API_TO_FORM[apiField]
    if (field) fields.push({ field, message })
    else form.push(message)
  }
  fields.sort((a, b) => stepOfField(a.field) - stepOfField(b.field))
  const step = fields.length > 0 ? stepOfField(fields[0]!.field) : STEP_COUNT - 1
  return { fields, form, step }
}

// ------------------------------------------------------------------------------------------------ defaults

export interface WizardInitialState {
  values: WizardValues
  /** Prefilled interests that are not one of the nine chips (rendered as extra chips). */
  extraInterests: string[]
}

/** Initial values: Stitch defaults, overridden by the /contact query prefill. */
export function initialWizardState(
  prefill: ContactPrefill,
  options: readonly TravelWindowOption[],
  today: string,
  locale: Locale,
): WizardInitialState {
  const party: PartyType = prefill.party ?? 'couple'
  const interests: string[] = []
  const extraInterests: string[] = []
  for (const raw of prefill.interests ?? []) {
    const id = interestIdFor(raw)
    const value = id ?? raw.trim()
    if (!value || interests.includes(value)) continue
    interests.push(value)
    if (!id) extraInterests.push(value)
  }
  const month = prefill.month?.trim()
  const fromMonth = month ? travelWindowForMonth(month, today, options) : null
  const flexibleLabel = month !== undefined && /^(flexible|any|anytime|not sure)$/i.test(month)

  return {
    extraInterests,
    values: {
      partyType: party,
      adults: prefill.adults ?? (party === 'solo' ? 1 : 2),
      children: prefill.children ?? 0,
      travelWindow: fromMonth ?? defaultTravelWindow(options),
      flexibility: flexibleLabel ? 'completely' : 'days',
      durationPreference: 'indepth',
      pace: 'balanced',
      interests: interests.slice(0, 20),
      stayStyle: 'bungalows',
      name: '',
      email: '',
      whatsappCode: DEFAULT_CALLING_CODE[locale],
      whatsappNumber: '',
      country: '',
      message: prefill.message ?? '',
      website: '',
    },
  }
}

// ------------------------------------------------------------------------------------------------ API body

/** Localised, human-readable labels sent to the API (the guide reads them in the admin and the email). */
export interface WizardLabels {
  travelWindow: (value: string) => string
  flexibility: (id: FlexibilityId) => string
  duration: (id: DurationId) => string
  pace: (id: PaceId) => string
  stay: (id: StayId) => string
  /** Chip id → label; extra (prefilled) interests are passed through. */
  interest: (value: string) => string
}

export interface InquiryContext {
  locale: Locale
  labels: WizardLabels
  tourSlug?: string
  destinationSlug?: string
  /** Where the visitor came from (prefill `source`), e.g. 'tour-detail'. */
  source?: string
}

/** "+44" + "7700 900123" → "+44 7700 900123"; "Other" keeps the number as typed. */
export function combineWhatsApp(code: string, number: string): string {
  const n = number.trim()
  if (!n) return ''
  if (code === 'other' || n.startsWith('+')) return n
  return `${code} ${n.replace(/^0+/, '')}`
}

const blankToUndefined = (value: string | undefined) => {
  const v = value?.trim()
  return v ? v : undefined
}

/** Wizard values → POST /inquiries body (InquiryBody contract). */
export function toInquiryBody(values: WizardValues, context: InquiryContext): InquiryBody {
  const { labels } = context
  const interests = [...new Set(values.interests.map((v) => labels.interest(v).trim()).filter(Boolean))].slice(0, 20)
  return {
    partyType: values.partyType,
    adults: values.adults,
    children: values.children,
    travelWindow: labels.travelWindow(values.travelWindow),
    flexibility: labels.flexibility(values.flexibility),
    durationPreference: labels.duration(values.durationPreference),
    pace: labels.pace(values.pace),
    interests,
    stayStyle: labels.stay(values.stayStyle),
    name: values.name.trim(),
    email: values.email.trim(),
    whatsapp: blankToUndefined(combineWhatsApp(values.whatsappCode, values.whatsappNumber)),
    country: blankToUndefined(values.country),
    message: blankToUndefined(values.message),
    tourSlug: context.tourSlug,
    destinationSlug: context.destinationSlug,
    sourcePage: context.source ? `/contact?source=${context.source}`.slice(0, 300) : '/contact',
    locale: context.locale,
    website: values.website ?? '',
    ...(values.turnstileToken ? { turnstileToken: values.turnstileToken } : {}),
  }
}

// ------------------------------------------------------------------------------------------------ submit

export type WizardSubmitOutcome =
  | { kind: 'success'; reference: string }
  /** 400/422: field errors routed to their steps (+ the generic failure for the status message). */
  | { kind: 'invalid'; errors: MappedServerErrors; failure: FormFailure }
  /** 429 / network / server — shown as a friendly message on the current step. */
  | { kind: 'failed'; failure: FormFailure }

/** Interprets the POST /inquiries result for the wizard UI. */
export function submitOutcome(result: FormResult<InquiryResult>): WizardSubmitOutcome {
  if (result.ok) return { kind: 'success', reference: result.data.reference }
  if (result.kind === 'validation')
    return { kind: 'invalid', errors: mapServerErrors(result.fieldErrors), failure: result }
  return { kind: 'failed', failure: result }
}

/** Maps the wizard values to the API body, POSTs them and interprets the answer (never throws). */
export async function sendInquiry(values: WizardValues, context: InquiryContext): Promise<WizardSubmitOutcome> {
  return submitOutcome(await submitInquiry(toInquiryBody(values, context)))
}

// ------------------------------------------------------------------------------------------------ draft

export const DRAFT_KEY = 'serendiva.contact-draft.v1'

export interface WizardDraft {
  v: 1
  /** Prefill signature the draft was started with (a different tour/destination starts afresh). */
  context: string
  step: number
  aboutDismissed: boolean
  extraInterests: string[]
  values: Omit<WizardValues, 'website' | 'turnstileToken'>
}

/** Stable signature of the prefill (parseContactPrefill output is already key-ordered). */
export const prefillSignature = (prefill: ContactPrefill) => JSON.stringify(prefill)

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
const int = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined
const oneOf = <T extends string>(v: unknown, list: readonly T[]) =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : undefined
const strings = (v: unknown, maxItems: number, maxLength: number) =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= maxLength).slice(0, maxItems)
    : undefined

/**
 * Merges a stored draft over the initial state. Every field is type-checked; anything stale (e.g. a travel
 * window from a season that has passed) falls back to the initial value. Returns null for foreign/invalid drafts.
 */
export function restoreDraft(
  raw: unknown,
  initial: WizardInitialState,
  context: string,
  travelWindowValues: readonly string[],
): (WizardInitialState & { step: number; aboutDismissed: boolean }) | null {
  if (!isRecord(raw) || raw.v !== 1 || !isRecord(raw.values)) return null
  const emptyPrefill = context === '{}'
  if (raw.context !== context && !emptyPrefill) return null
  const d = raw.values
  const base = initial.values
  const values: WizardValues = {
    ...base,
    partyType: oneOf(d.partyType, TRAVELLER_TYPES) ?? base.partyType,
    adults: int(d.adults, 1, 50) ?? base.adults,
    children: int(d.children, 0, 50) ?? base.children,
    travelWindow: oneOf(d.travelWindow, travelWindowValues) ?? base.travelWindow,
    flexibility: oneOf(d.flexibility, FLEXIBILITY_IDS) ?? base.flexibility,
    durationPreference: oneOf(d.durationPreference, DURATION_IDS) ?? base.durationPreference,
    pace: oneOf(d.pace, PACE_IDS) ?? base.pace,
    interests: strings(d.interests, 20, 60) ?? base.interests,
    stayStyle: oneOf(d.stayStyle, STAY_IDS) ?? base.stayStyle,
    name: str(d.name, 120) ?? base.name,
    email: str(d.email, 200) ?? base.email,
    whatsappCode: oneOf(d.whatsappCode, CALLING_CODE_VALUES) ?? base.whatsappCode,
    whatsappNumber: str(d.whatsappNumber, 32) ?? base.whatsappNumber,
    country: str(d.country, 80) ?? base.country,
    message: str(d.message, 5000) ?? base.message,
  }
  const extras = [...new Set([...initial.extraInterests, ...(strings(raw.extraInterests, 20, 60) ?? [])])]
  return {
    values,
    extraInterests: extras,
    step: int(raw.step, 0, STEP_COUNT - 1) ?? 0,
    aboutDismissed: raw.aboutDismissed === true,
  }
}

/** sessionStorage access that never throws (private mode, blocked storage, SSR). */
export const draftStorage = {
  read(): unknown {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY)
      return raw ? (JSON.parse(raw) as unknown) : null
    } catch {
      return null
    }
  },
  write(draft: WizardDraft): void {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // storage full or blocked — the draft is a convenience only
    }
  },
  clear(): void {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      // ignore
    }
  },
}
