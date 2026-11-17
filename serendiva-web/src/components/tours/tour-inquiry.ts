import { z } from 'zod'
import type { InquiryBody, Locale, PartyType } from '@/lib/api/types'
import { emailSchema, honeypot, optionalText, requiredPhone, requiredText } from '@/lib/validation/shared'

/*
 * Tour sidebar inquiry form (Stitch "Bespoke Inquiry for This Tour"): name, email, WhatsApp, estimated month,
 * guests and free-text preferences. Validated with Zod on the client (same limits as the API's InquiryBody) and
 * mapped to POST /inquiries with the tour slug and the page it was sent from.
 */

export const GUEST_OPTIONS = ['couple', 'solo', 'family', 'group'] as const
export type GuestOption = (typeof GUEST_OPTIONS)[number]

/** Stitch guest choices → API party type + (minimum) number of adults. */
export const GUEST_PARTY: Record<GuestOption, { partyType: PartyType; adults: number }> = {
  couple: { partyType: 'couple', adults: 2 },
  solo: { partyType: 'solo', adults: 1 },
  family: { partyType: 'family', adults: 3 },
  group: { partyType: 'group', adults: 5 },
}

/** Month select value for "I am flexible". Other values are 'YYYY-MM'. */
export const FLEXIBLE_MONTH = 'flexible'
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export const tourInquirySchema = z.object({
  name: requiredText(120, 2, 'nameTooShort'),
  email: emailSchema,
  whatsapp: requiredPhone(5, 40),
  month: z
    .string()
    .trim()
    .refine((v) => v === '' || v === FLEXIBLE_MONTH || MONTH.test(v), 'month'),
  guests: z.enum(GUEST_OPTIONS, { error: 'required' }),
  message: optionalText(5000),
  website: honeypot,
  turnstileToken: z.string().max(4096).optional(),
})

export type TourInquiryFormValues = z.input<typeof tourInquirySchema>
export type TourInquiryValues = z.output<typeof tourInquirySchema>
export type TourInquiryField = 'name' | 'email' | 'whatsapp' | 'month' | 'guests' | 'message'

export const TOUR_INQUIRY_FIELDS: readonly TourInquiryField[] = [
  'name',
  'email',
  'whatsapp',
  'month',
  'guests',
  'message',
]

export const tourInquiryDefaults = (): TourInquiryFormValues => ({
  name: '',
  email: '',
  whatsapp: '',
  month: '',
  guests: 'couple',
  message: '',
  website: '',
})

export interface MonthOption {
  /** 'YYYY-MM' */
  value: string
  /** Localised label, e.g. "March 2027" (sent as `travelWindow`). */
  label: string
}

/** The next `count` months starting with the month after `from` (UTC), formatted for `locale`. */
export function upcomingMonths(from: Date, locale: string, count = 18): MonthOption[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1 + i, 1, 12))
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    return { value, label: formatter.format(date) }
  })
}

export interface TourInquiryContext {
  tourSlug: string
  locale: Locale
  /** Path the form was sent from, e.g. "/tours/cultural-odyssey". */
  sourcePage?: string
  /** Label of the chosen month (from the select). */
  monthLabel?: string
  /** Label stored as travel window when the guest is flexible. */
  flexibleLabel: string
}

/** Parsed form values → API body (POST /inquiries). */
export function toTourInquiryBody(values: TourInquiryValues, ctx: TourInquiryContext): InquiryBody {
  const party = GUEST_PARTY[values.guests]
  const flexible = values.month === FLEXIBLE_MONTH
  const body: InquiryBody = {
    name: values.name,
    email: values.email,
    whatsapp: values.whatsapp,
    partyType: party.partyType,
    adults: party.adults,
    children: 0,
    interests: [],
    tourSlug: ctx.tourSlug,
    locale: ctx.locale,
    website: values.website ?? '',
  }
  if (flexible) {
    body.flexibleDates = true
    body.travelWindow = ctx.flexibleLabel.slice(0, 120)
  } else if (values.month) {
    body.travelWindow = (ctx.monthLabel || values.month).slice(0, 120)
  }
  if (values.message) body.message = values.message
  if (ctx.sourcePage) body.sourcePage = ctx.sourcePage.slice(0, 300)
  if (values.turnstileToken) body.turnstileToken = values.turnstileToken
  return body
}

/** API field paths → form fields (travel window / party details are entered through month & guests). */
export function mapInquiryFieldErrors(fieldErrors: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [path, message] of Object.entries(fieldErrors)) {
    const field =
      path === 'travelWindow' || path === 'travelStart' || path === 'flexibleDates'
        ? 'month'
        : path === 'partyType' || path === 'adults' || path === 'children'
          ? 'guests'
          : path
    mapped[field] ??= message
  }
  return mapped
}
