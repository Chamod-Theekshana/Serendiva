import { expect, test } from '@playwright/test'
import { hydrated } from './hydration'

// Home hero quick-inquiry bar → /contact pre-filled (party, adults, interest, travel window).

test('hero quick-inquiry bar opens a pre-filled inquiry', async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.clear())
  await page.goto('/')
  const bar = page.locator('form').filter({ has: page.getByRole('button', { name: /Get My Plan/i }) })
  const selects = bar.locator('select')
  await expect(selects).toHaveCount(3)
  await hydrated(bar.getByRole('button', { name: /Get My Plan/i }))

  await selects.nth(0).selectOption('wildlife-safari')
  // Second travel window: its value is the first month ('YYYY-MM') so /contact can pre-select it.
  const windowValue = await selects.nth(1).locator('option').nth(1).getAttribute('value')
  expect(windowValue).toMatch(/^\d{4}-\d{2}$/)
  await selects.nth(1).selectOption(windowValue!)
  await selects.nth(2).selectOption('family')
  await bar.getByRole('button', { name: /Get My Plan/i }).click()

  await expect(page).toHaveURL(/\/contact\?/, { timeout: 30_000 })
  const url = new URL(page.url())
  expect(url.searchParams.get('interests')).toBe('wildlife-safari')
  expect(url.searchParams.get('month')).toBe(windowValue)
  expect(url.searchParams.get('party')).toBe('family')
  expect(url.searchParams.get('source')).toBe('home-hero')

  const wizard = page.getByRole('form', { name: 'Bespoke trip inquiry' })
  await expect(wizard.locator('input[name=partyType][value=family]')).toBeChecked()
  await page.getByRole('button', { name: 'Continue to Dates & Pace' }).click()
  // The travel-window select shows a season that contains the chosen month.
  const [year, month] = windowValue!.split('-').map(Number)
  const monthName = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year!, month! - 1, 1)),
  )
  const selected = await wizard.locator('select[name=travelWindow] option:checked').textContent()
  expect(selected).toBeTruthy()
  // e.g. "December 2026 – February 2027 (…)" contains February; the season is at most 3 months long.
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, i, 1))),
  )
  const first = months.findIndex((m) => selected!.startsWith(m))
  expect(first).toBeGreaterThanOrEqual(0)
  const within = [0, 1, 2].map((d) => months[(first + d) % 12])
  expect(within).toContain(monthName)
  await page.getByRole('button', { name: 'Continue to Passions & Stays' }).click()
  await expect(wizard.locator('input[name=interests]:checked')).toHaveCount(1)
})
