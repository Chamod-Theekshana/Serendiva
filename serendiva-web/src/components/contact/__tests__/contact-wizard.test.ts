import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicEnv } from '@/lib/env'
import {
  defaultTravelWindow,
  interestIdFor,
  travelWindowForMonth,
  travelWindowOptions,
} from '@/components/contact/wizard-config'
import {
  DRAFT_KEY,
  STEP_FIELDS,
  combineWhatsApp,
  initialWizardState,
  mapServerErrors,
  prefillSignature,
  restoreDraft,
  sendInquiry,
  stepOfField,
  toInquiryBody,
  wizardSchema,
  type InquiryContext,
  type WizardValues,
} from '@/components/contact/wizard-model'

const TODAY = '2026-10-05'
const windows = travelWindowOptions(TODAY)

const labels: InquiryContext['labels'] = {
  travelWindow: (v) => `window:${v}`,
  flexibility: (v) => `flex:${v}`,
  duration: (v) => `duration:${v}`,
  pace: (v) => `pace:${v}`,
  stay: (v) => `stay:${v}`,
  interest: (v) => `interest:${v}`,
}

const filled = (): WizardValues => ({
  ...initialWizardState({}, windows, TODAY, 'en').values,
  name: '  Ada Lovelace ',
  email: 'ada@example.com',
  whatsappCode: '+44',
  whatsappNumber: '07700 900123',
  country: '',
  message: '  ',
  interests: ['safaris', 'Ramayana trail'],
})

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('contact wizard — travel windows', () => {
  it('generates seasons for the next 18 months from today (never hard-coded years)', () => {
    expect(windows.map((w) => w.value)).toEqual([
      'immediate',
      'season-2026-12',
      'season-2027-03',
      'season-2027-06',
      'season-2027-09',
      'season-2027-12',
      'season-2028-03',
      'later',
    ])
    expect(defaultTravelWindow(windows)).toBe('season-2026-12')
    expect(travelWindowOptions('2031-01-20')[1]).toMatchObject({ value: 'season-2031-03', season: 'mar' })
  })

  it('maps a prefilled month onto the generated options', () => {
    expect(travelWindowForMonth('2027-04', TODAY, windows)).toBe('season-2027-03')
    expect(travelWindowForMonth('2027-01', TODAY, windows)).toBe('season-2026-12')
    expect(travelWindowForMonth('2026-11', TODAY, windows)).toBe('immediate')
    expect(travelWindowForMonth('2030-01', TODAY, windows)).toBe('later')
    expect(travelWindowForMonth('2025-01', TODAY, windows)).toBeNull()
    expect(travelWindowForMonth('flexible', TODAY, windows)).toBeNull()
  })
})

describe('contact wizard — prefill', () => {
  it('applies party, guests, month, interests and message from the /contact query', () => {
    const { values, extraInterests } = initialWizardState(
      {
        party: 'family',
        adults: 3,
        children: 2,
        month: '2027-03',
        interests: ['wildlife-safari', 'Tea country', 'ramayana-trail'],
        message: 'Hi',
      },
      windows,
      TODAY,
      'de',
    )
    expect(values).toMatchObject({
      partyType: 'family',
      adults: 3,
      children: 2,
      travelWindow: 'season-2027-03',
      interests: ['safaris', 'tea_estates', 'ramayana-trail'],
      message: 'Hi',
      whatsappCode: '+49',
    })
    expect(extraInterests).toEqual(['ramayana-trail'])
  })

  it('uses Stitch defaults without prefill and one adult for solo travellers', () => {
    expect(initialWizardState({}, windows, TODAY, 'en').values).toMatchObject({
      partyType: 'couple',
      adults: 2,
      travelWindow: 'season-2026-12',
      durationPreference: 'indepth',
      pace: 'balanced',
      stayStyle: 'bungalows',
      flexibility: 'days',
    })
    expect(initialWizardState({ party: 'solo' }, windows, TODAY, 'en').values.adults).toBe(1)
    expect(initialWizardState({ month: 'flexible' }, windows, TODAY, 'en').values.flexibility).toBe('completely')
    expect(interestIdFor('Pristine Beaches')).toBe('coast_whales')
  })
})

describe('contact wizard — validation per step', () => {
  it('lists every schema field in exactly one step', () => {
    const stepFields = STEP_FIELDS.flat()
    const schemaFields = Object.keys(wizardSchema.shape).filter((k) => k !== 'website' && k !== 'turnstileToken')
    expect([...stepFields].sort()).toEqual(schemaFields.sort())
    expect(stepOfField('partyType')).toBe(0)
    expect(stepOfField('pace')).toBe(1)
    expect(stepOfField('stayStyle')).toBe(2)
    expect(stepOfField('whatsappNumber')).toBe(3)
  })

  it('requires name, email and a WhatsApp number on step 4', () => {
    const result = wizardSchema.safeParse({ ...filled(), name: 'A', email: 'nope', whatsappNumber: 'abc' })
    expect(result.success).toBe(false)
    const issues = Object.fromEntries((result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))
    expect(issues).toMatchObject({ name: 'nameTooShort', email: 'email', whatsappNumber: 'phone' })
    expect(wizardSchema.safeParse(filled()).success).toBe(true)
  })
})

describe('contact wizard — API body', () => {
  it('maps the values to the InquiryBody contract', () => {
    const body = toInquiryBody(filled(), {
      locale: 'en',
      labels,
      tourSlug: 'cultural-odyssey',
      source: 'tour-detail',
    })
    expect(body).toEqual({
      partyType: 'couple',
      adults: 2,
      children: 0,
      travelWindow: 'window:season-2026-12',
      flexibility: 'flex:days',
      durationPreference: 'duration:indepth',
      pace: 'pace:balanced',
      interests: ['interest:safaris', 'interest:Ramayana trail'],
      stayStyle: 'stay:bungalows',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      whatsapp: '+44 7700 900123',
      country: undefined,
      message: undefined,
      tourSlug: 'cultural-odyssey',
      destinationSlug: undefined,
      sourcePage: '/contact?source=tour-detail',
      locale: 'en',
      website: '',
    })
  })

  it('combines the calling code with the number', () => {
    expect(combineWhatsApp('+94', '077 123 4567')).toBe('+94 77 123 4567')
    expect(combineWhatsApp('+44', '+44 7700 900123')).toBe('+44 7700 900123')
    expect(combineWhatsApp('other', '+353 85 123 4567')).toBe('+353 85 123 4567')
    expect(combineWhatsApp('+1', '   ')).toBe('')
  })
})

describe('contact wizard — server errors', () => {
  it('routes API field errors to the earliest step and keeps unknown fields form-level', () => {
    expect(mapServerErrors({ whatsapp: 'Bad number', partyType: 'Invalid option', tourSlug: 'Unknown tour' })).toEqual({
      fields: [
        { field: 'partyType', message: 'Invalid option' },
        { field: 'whatsappNumber', message: 'Bad number' },
      ],
      form: ['Unknown tour'],
      step: 0,
    })
    expect(mapServerErrors({ locale: 'Nope' })).toEqual({ fields: [], form: ['Nope'], step: 3 })
  })
})

describe('contact wizard — submission outcomes (mocked fetch)', () => {
  const context: InquiryContext = { locale: 'en', labels }

  it('returns the reference on 201 and POSTs the mapped body', async () => {
    const fetchMock = vi.fn(async () => json(201, { reference: 'SRD-2026-0042', message: 'Thanks' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendInquiry(filled(), context)).resolves.toEqual({ kind: 'success', reference: 'SRD-2026-0042' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${publicEnv.apiUrl}/api/v1/inquiries`)
    expect(JSON.parse(String(init.body))).toMatchObject({ name: 'Ada Lovelace', whatsapp: '+44 7700 900123' })
  })

  it('reports 429 as rate limited with the Retry-After seconds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(429, { error: { code: 'RATE_LIMITED', message: 'Slow down' } }, { 'retry-after': '37' })),
    )
    await expect(sendInquiry(filled(), context)).resolves.toEqual({
      kind: 'failed',
      failure: { ok: false, kind: 'rate_limited', retryAfterSeconds: 37 },
    })
  })

  it('reports network failures and 5xx without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(sendInquiry(filled(), context)).resolves.toEqual({
      kind: 'failed',
      failure: { ok: false, kind: 'network' },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(503, { error: { code: 'DOWN', message: 'Maintenance' } })),
    )
    await expect(sendInquiry(filled(), context)).resolves.toMatchObject({ kind: 'failed', failure: { kind: 'server' } })
  })

  it('routes 400 VALIDATION_ERROR details back to the wizard steps', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Some fields are invalid',
            details: [{ path: 'email', message: 'Please enter a valid email address' }],
          },
        }),
      ),
    )
    const outcome = await sendInquiry(filled(), context)
    expect(outcome).toMatchObject({
      kind: 'invalid',
      errors: { step: 3, fields: [{ field: 'email', message: 'Please enter a valid email address' }] },
    })
  })
})

describe('contact wizard — sessionStorage draft', () => {
  const initial = initialWizardState({}, windows, TODAY, 'en')
  const values = windows.map((w) => w.value)

  it('restores a matching draft and type-checks every field', () => {
    const restored = restoreDraft(
      {
        v: 1,
        context: '{}',
        step: 3,
        aboutDismissed: true,
        extraInterests: ['honeymoon'],
        values: { ...filled(), adults: 999, travelWindow: 'season-2019-12', pace: 'sprint', name: 'Grace' },
      },
      initial,
      '{}',
      values,
    )
    expect(restored).toMatchObject({ step: 3, aboutDismissed: true, extraInterests: ['honeymoon'] })
    expect(restored?.values).toMatchObject({
      name: 'Grace',
      adults: 2,
      travelWindow: 'season-2026-12',
      pace: 'balanced',
    })
  })

  it('ignores drafts started for another tour and garbage', () => {
    const tourContext = prefillSignature({ tour: 'cultural-odyssey' })
    const draft = { v: 1, context: tourContext, step: 1, aboutDismissed: false, extraInterests: [], values: filled() }
    expect(restoreDraft(draft, initial, prefillSignature({ tour: 'grand-ceylon-odyssey' }), values)).toBeNull()
    expect(restoreDraft(draft, initial, tourContext, values)).not.toBeNull()
    expect(restoreDraft('nope', initial, '{}', values)).toBeNull()
    expect(restoreDraft({ v: 2, values: {} }, initial, '{}', values)).toBeNull()
    expect(DRAFT_KEY).toMatch(/contact-draft/)
  })
})
