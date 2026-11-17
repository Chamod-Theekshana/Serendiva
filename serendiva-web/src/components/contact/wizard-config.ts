import type { PartyType } from '@/lib/api/types'

/*
 * Static option sets of the /contact inquiry wizard (ids → icons). Labels live in messages/en/contact.json
 * (`wizard.*`). Kept free of React so the pure helpers in wizard-model.ts can be unit-tested.
 */

export const WIZARD_STEPS = ['party', 'dates', 'passions', 'details'] as const
export type WizardStepId = (typeof WIZARD_STEPS)[number]

export interface PartyOption {
  id: PartyType
  icon: string
  /** Corporate spans two columns like the Stitch card. */
  wide?: boolean
}

export const PARTY_OPTIONS: readonly PartyOption[] = [
  { id: 'solo', icon: 'person' },
  { id: 'couple', icon: 'favorite' },
  { id: 'family', icon: 'family_restroom' },
  { id: 'group', icon: 'groups' },
  { id: 'corporate', icon: 'business_center', wide: true },
]

export const FLEXIBILITY_IDS = ['completely', 'days', 'fixed'] as const
export type FlexibilityId = (typeof FLEXIBILITY_IDS)[number]

export const DURATION_IDS = ['short', 'essential', 'indepth', 'grand', 'flexible'] as const
export type DurationId = (typeof DURATION_IDS)[number]

export const PACE_IDS = ['relaxed', 'balanced', 'active'] as const
export type PaceId = (typeof PACE_IDS)[number]

export const INTEREST_OPTIONS = [
  { id: 'citadels', icon: 'castle' },
  { id: 'safaris', icon: 'pets' },
  { id: 'tea_estates', icon: 'emoji_food_beverage' },
  { id: 'trains', icon: 'train' },
  { id: 'coast_whales', icon: 'sailing' },
  { id: 'ayurveda', icon: 'spa' },
  { id: 'culinary', icon: 'restaurant' },
  { id: 'hiking', icon: 'hiking' },
  { id: 'photography', icon: 'photo_camera' },
] as const
export type InterestId = (typeof INTEREST_OPTIONS)[number]['id']
export const INTEREST_IDS: readonly InterestId[] = INTEREST_OPTIONS.map((o) => o.id)

export const STAY_OPTIONS = [
  { id: 'bungalows', icon: 'villa' },
  { id: 'safari_pavilions', icon: 'cabin' },
  { id: 'ocean_resorts', icon: 'pool' },
  { id: 'blend', icon: 'auto_awesome' },
] as const
export type StayId = (typeof STAY_OPTIONS)[number]['id']
export const STAY_IDS = STAY_OPTIONS.map((o) => o.id) as [StayId, ...StayId[]]

/** Calling codes offered next to the WhatsApp number (message key → dial prefix). `other` = type the full number. */
export const CALLING_CODES = [
  { key: 'gb', code: '+44' },
  { key: 'us', code: '+1' },
  { key: 'au', code: '+61' },
  { key: 'de', code: '+49' },
  { key: 'fr', code: '+33' },
  { key: 'ch', code: '+41' },
  { key: 'nl', code: '+31' },
  { key: 'cn', code: '+86' },
  { key: 'ae', code: '+971' },
  { key: 'sg', code: '+65' },
  { key: 'in', code: '+91' },
  { key: 'lk', code: '+94' },
  { key: 'other', code: 'other' },
] as const
export type CallingCodeKey = (typeof CALLING_CODES)[number]['key']
export const CALLING_CODE_VALUES = CALLING_CODES.map((c) => c.code) as [string, ...string[]]

/** Sensible default calling code per UI locale. */
export const DEFAULT_CALLING_CODE: Record<'en' | 'zh' | 'de', string> = { en: '+44', zh: '+86', de: '+49' }

/**
 * Prefill aliases (`/contact?interests=…` from tour/destination pages, the trip quiz or the hero bar):
 * category slugs and common words → interest chip ids. Anything unknown is kept as an extra, pre-checked chip.
 */
const INTEREST_ALIASES: Record<string, InterestId> = {
  citadels: 'citadels',
  'cultural-heritage': 'citadels',
  culture: 'citadels',
  heritage: 'citadels',
  'ancient-cities': 'citadels',
  'sacred-heritage': 'citadels',
  safaris: 'safaris',
  safari: 'safaris',
  'wildlife-safari': 'safaris',
  wildlife: 'safaris',
  'tea-estates': 'tea_estates',
  tea: 'tea_estates',
  'hill-country': 'tea_estates',
  'tea-country': 'tea_estates',
  trains: 'trains',
  train: 'trains',
  rail: 'trains',
  'tea-country-rail': 'trains',
  'coast-whales': 'coast_whales',
  'pristine-beaches': 'coast_whales',
  beaches: 'coast_whales',
  beach: 'coast_whales',
  coast: 'coast_whales',
  whales: 'coast_whales',
  ayurveda: 'ayurveda',
  'ayurveda-wellness': 'ayurveda',
  wellness: 'ayurveda',
  culinary: 'culinary',
  gastronomy: 'culinary',
  food: 'culinary',
  cooking: 'culinary',
  hiking: 'hiking',
  'trekking-adventure': 'hiking',
  trekking: 'hiking',
  adventure: 'hiking',
  photography: 'photography',
  birding: 'photography',
}

const normaliseInterest = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')

/** Maps one prefill interest to a chip id (or null when it is not one of the nine chips). */
export function interestIdFor(raw: string): InterestId | null {
  return INTEREST_ALIASES[normaliseInterest(raw)] ?? null
}

/** Human label for an extra (unknown) interest: "ramayana-trail" → "Ramayana trail". */
export function extraInterestLabel(raw: string): string {
  const text = raw.trim().replace(/[-_]+/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// ------------------------------------------------------------------------------------------------ travel windows

export type SeasonKey = 'dec' | 'mar' | 'jun' | 'sep'

/** Sri Lankan planning seasons by 0-based start month. */
const SEASON_BY_START_MONTH: Partial<Record<number, SeasonKey>> = { 11: 'dec', 2: 'mar', 5: 'jun', 8: 'sep' }

export type TravelWindowOption =
  | { value: 'immediate'; kind: 'immediate' }
  | {
      value: string
      kind: 'season'
      season: SeasonKey
      /** Absolute month index (year * 12 + month) of the first and last month. */
      start: number
      end: number
    }
  | { value: 'later'; kind: 'later'; /** First month after the last listed season. */ from: number }
  | { value: 'custom'; kind: 'custom'; label: string }

const pad = (n: number) => String(n).padStart(2, '0')
/** Absolute month index → 'YYYY-MM'. */
export const monthIso = (index: number) => `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`
const monthIndexOf = (iso: string) => {
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : NaN
}

/**
 * Travel-window choices generated from "today" (never hard-coded years): "Immediate (next 30–60 days)", every
 * season that starts within the next `monthsAhead` months, then "From <month> onwards". `today` is 'YYYY-MM-DD'
 * (passed from the server so SSR and hydration agree).
 */
export function travelWindowOptions(today: string, monthsAhead = 18): TravelWindowOption[] {
  const current = monthIndexOf(today)
  const options: TravelWindowOption[] = [{ value: 'immediate', kind: 'immediate' }]
  let lastEnd = current + 2
  for (let index = current + 1; index <= current + monthsAhead; index++) {
    const season = SEASON_BY_START_MONTH[index % 12]
    if (!season) continue
    options.push({ value: `season-${monthIso(index)}`, kind: 'season', season, start: index, end: index + 2 })
    lastEnd = index + 2
  }
  options.push({ value: 'later', kind: 'later', from: lastEnd + 1 })
  return options
}

/** Default selection: the next peak dry season (Dec–Feb), like the Stitch design. */
export function defaultTravelWindow(options: readonly TravelWindowOption[]): string {
  const dec = options.find((o) => o.kind === 'season' && o.season === 'dec')
  return (dec ?? options[1] ?? options[0])?.value ?? 'immediate'
}

/**
 * Maps a prefilled `month` ('YYYY-MM' or a free label) onto the generated options:
 * within the next ~2 months → immediate · inside a season → that season · beyond → later · past → null.
 * Free labels (e.g. "flexible") return null; the caller decides what to do with them.
 */
export function travelWindowForMonth(month: string, today: string, options: readonly TravelWindowOption[]) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const index = monthIndexOf(month)
  const current = monthIndexOf(today)
  if (!Number.isFinite(index) || index < current) return null
  const season = options.find((o) => o.kind === 'season' && index >= o.start && index <= o.end)
  if (season) return season.value
  const later = options.find((o) => o.kind === 'later')
  if (later && later.kind === 'later' && index >= later.from) return later.value
  return 'immediate'
}
