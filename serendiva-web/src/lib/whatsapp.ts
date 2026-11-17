import { publicEnv } from './env'

/** Message templates — pass `t.raw('whatsapp')` / the `common.whatsapp` messages so the text is localised. */
export interface WhatsAppTemplates {
  default: string
  page: string
  tour: string
  destination: string
  corporate: string
}

/** Strips everything but digits ("+94 77 123 4567" → "94771234567"). */
export function normalizeWhatsAppNumber(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** The number to use: settings.contact.whatsapp, falling back to NEXT_PUBLIC_WHATSAPP_NUMBER. */
export function resolveWhatsAppNumber(settingsNumber?: string | null): string {
  return normalizeWhatsAppNumber(settingsNumber) || publicEnv.whatsappNumber
}

/**
 * Builds a wa.me deep link. Without a number (none configured) WhatsApp opens the share sheet with the text.
 * @example waLink('+94 77 123 4567', 'Hello') → 'https://wa.me/94771234567?text=Hello'
 */
export function waLink(number: string | null | undefined, message?: string): string {
  const digits = resolveWhatsAppNumber(number)
  const text = message?.trim()
  const query = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${digits}${query}`
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

export interface WhatsAppMessageOptions {
  templates: WhatsAppTemplates
  /** Human page name, e.g. "Destinations" → "I'm on your “Destinations” page…" */
  page?: string
  /** Tour title (takes precedence over destination/page). */
  tourTitle?: string
  /** Destination name. */
  destinationName?: string
  /** Corporate / group context. */
  corporate?: boolean
}

/** Pre-filled WhatsApp message: tour → destination → corporate → page → default. */
export function buildWhatsAppMessage({
  templates,
  page,
  tourTitle,
  destinationName,
  corporate,
}: WhatsAppMessageOptions): string {
  if (tourTitle) return fill(templates.tour, { tour: tourTitle })
  if (destinationName) return fill(templates.destination, { destination: destinationName })
  if (corporate) return templates.corporate
  if (page) return fill(templates.page, { page })
  return templates.default
}
