'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { AvailabilityCalendar as AvailabilityCalendarDto } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'
import { dayStatus, isoDay, monthIndex, type DayStatus } from '@/lib/availability'

const STATUS_CLASS: Record<DayStatus, string> = {
  available: 'bg-tertiary-fixed text-on-tertiary-fixed font-semibold',
  busy: 'bg-surface-container-highest text-on-surface-variant line-through',
  onRequest: 'bg-surface text-on-surface',
  past: 'text-outline/50',
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export interface AvailabilityCalendarProps {
  /** GET /availability (from `getAvailability()`); `from` is treated as "today" so server and client agree. */
  calendar: AvailabilityCalendarDto
  /** Months side by side (1 on mobile-first layouts, 2 on wide cards). */
  monthsToShow?: 1 | 2
  /** Heading shown above the grid. */
  title?: string
  className?: string
}

/** Read-only availability calendar (prev/next month, legend, screen-reader status per day). */
export function AvailabilityCalendar({ calendar, monthsToShow = 1, title, className }: AvailabilityCalendarProps) {
  const t = useTranslations('common.a11y.calendar')
  const locale = useLocale()
  const today = calendar.from
  const first = monthIndex(calendar.from)
  const last = Math.max(first, monthIndex(calendar.to) - (monthsToShow - 1))
  const [start, setStart] = useState(first)

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [locale],
  )
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
    [locale],
  )
  const statusLabel: Record<DayStatus, string> = {
    available: t('available'),
    busy: t('busy'),
    onRequest: t('onRequest'),
    past: t('past'),
  }

  const months = Array.from({ length: monthsToShow }, (_, i) => start + i)

  return (
    <div
      className={cn(
        'flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-md shadow-sm md:p-space-lg',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-space-sm">
        <button
          type="button"
          onClick={() => setStart((s) => Math.max(first, s - 1))}
          disabled={start <= first}
          aria-label={t('previousMonth')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-primary shadow-sm transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
        >
          <Icon name="chevron_left" className="text-xl" />
        </button>
        <h3 className="font-headline-sm text-headline-sm text-primary" aria-live="polite">
          {title ?? t('label')}
        </h3>
        <button
          type="button"
          onClick={() => setStart((s) => Math.min(last, s + 1))}
          disabled={start >= last}
          aria-label={t('nextMonth')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-primary shadow-sm transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
        >
          <Icon name="chevron_right" className="text-xl" />
        </button>
      </div>

      <div className={cn('grid gap-space-lg', monthsToShow === 2 && 'md:grid-cols-2')}>
        {months.map((mi) => {
          const year = Math.floor(mi / 12)
          const month = mi % 12
          const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
          const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7 // Monday first
          const cells: (number | null)[] = [
            ...Array<null>(offset).fill(null),
            ...Array.from({ length: daysInMonth }, (_, d) => d + 1),
          ]
          while (cells.length % 7) cells.push(null)
          const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
          const label = monthFormatter.format(new Date(Date.UTC(year, month, 1, 12)))
          return (
            <table key={mi} className="w-full table-fixed border-separate border-spacing-1">
              <caption
                className="pb-space-sm text-left font-label-lg text-label-lg uppercase tracking-wider text-primary"
                aria-live="polite"
              >
                {label}
              </caption>
              <thead>
                <tr>
                  {WEEKDAYS.map((wd) => (
                    <th
                      key={wd}
                      scope="col"
                      className="pb-1 text-center font-label-md text-label-md text-on-surface-variant"
                    >
                      {t(`weekdays.${wd}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => {
                      if (day === null) return <td key={di} aria-hidden="true" />
                      const iso = isoDay(year, month, day)
                      const status = dayStatus(iso, today, calendar.ranges)
                      const isToday = iso === today
                      return (
                        <td key={di} className="p-0">
                          <div
                            className={cn(
                              'flex h-9 items-center justify-center rounded-lg font-body-md text-body-md',
                              STATUS_CLASS[status],
                              isToday && 'ring-2 ring-inset ring-secondary',
                            )}
                          >
                            <span aria-hidden="true">{day}</span>
                            <span className="sr-only">
                              {t('dayStatus', {
                                date: dayFormatter.format(new Date(Date.UTC(year, month, day, 12))),
                                status: statusLabel[status],
                              })}
                              {isToday ? `, ${t('today')}` : ''}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })}
      </div>

      <div className="flex flex-col gap-space-sm border-t border-surface-container-high pt-space-md">
        <ul
          aria-label={t('legend')}
          className="flex flex-wrap gap-space-md font-caption text-caption text-on-surface-variant"
        >
          {(['available', 'busy', 'onRequest'] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  'h-3.5 w-3.5 rounded',
                  STATUS_CLASS[s],
                  s === 'onRequest' && 'ring-1 ring-outline-variant',
                )}
              />
              {statusLabel[s]}
            </li>
          ))}
        </ul>
        <p className="font-caption text-caption text-on-surface-variant">{t('note')}</p>
      </div>
    </div>
  )
}
