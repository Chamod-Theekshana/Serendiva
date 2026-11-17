'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { Icon } from '@/components/ui/Icon'
import { useWhatsAppHref } from './SiteSettingsProvider'
import { usePageName } from './usePageName'

/** Sticky bottom bar on phones: WhatsApp + Inquire (replaces the floating button below md). */
export function MobileActionBar() {
  const t = useTranslations('common')
  const pathname = usePathname()
  const href = useWhatsAppHref({ page: usePageName() })
  const onContact = pathname === '/contact'
  return (
    <div
      role="region"
      aria-label={t('floating.mobileBarLabel')}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-space-sm bg-surface/95 px-margin pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl md:hidden"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-tertiary-container py-3 font-label-lg text-label-lg uppercase tracking-wider text-on-tertiary transition-colors hover:bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Icon name="chat" className="text-[18px]" />
        {t('floating.mobileWhatsApp')}
        <span className="sr-only"> {t('a11y.opensInNewTab')}</span>
      </a>
      <Link
        href={onContact ? { pathname: '/contact', hash: 'inquiry' } : '/contact'}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-secondary py-3 font-label-lg text-label-lg uppercase tracking-wider text-on-secondary shadow-[0_4px_16px_rgba(156,68,30,0.2)] transition-colors hover:bg-on-secondary-fixed-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Icon name="edit_calendar" className="text-[18px]" />
        {t('floating.mobileInquire')}
      </Link>
    </div>
  )
}
