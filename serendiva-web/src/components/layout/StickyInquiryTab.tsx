'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { Icon } from '@/components/ui/Icon'

/** Vertical "Inquire" tab on the right edge (md+). Hidden on /contact itself. */
export function StickyInquiryTab() {
  const t = useTranslations('common.floating')
  const pathname = usePathname()
  if (pathname === '/contact' || pathname.startsWith('/contact/')) return null
  return (
    <div className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 md:block">
      <Link
        href="/contact"
        aria-label={t('inquireLabel')}
        className="flex rotate-180 items-center gap-space-xs rounded-l-lg bg-primary px-space-md py-space-sm font-label-lg text-label-lg uppercase tracking-widest text-on-primary shadow-[0_8px_24px_rgba(0,52,65,0.25)] transition-all [writing-mode:vertical-rl] hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      >
        <Icon name="edit_calendar" className="rotate-90 text-sm" />
        <span>{t('inquire')}</span>
      </Link>
    </div>
  )
}
