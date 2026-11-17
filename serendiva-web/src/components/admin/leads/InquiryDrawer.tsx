'use client'

import { useTranslations } from 'next-intl'
import { DetailList, DetailSection } from '@/components/admin/kit/DetailList'
import { Icon } from '@/components/ui/Icon'
import { inquiriesApi } from '@/lib/admin/leads'
import type { AdminInquiry } from '@/lib/api/types'
import { ChipList, ContactValue, LeadDrawer } from './LeadDrawer'
import { useLeadFormat } from './useLeadFormat'

/** Inquiry detail drawer (`?id=`) — used by /admin/inquiries and the dashboard's latest inquiries. */
export function InquiryDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <LeadDrawer<AdminInquiry>
      kind="inquiries"
      id={id}
      onClose={onClose}
      api={inquiriesApi}
      title={(lead) => lead.name}
      replyName={(lead) => lead.name}
      replyPhone={(lead) => lead.whatsapp}
      renderDetails={(lead) => <InquiryDetails lead={lead} />}
    />
  )
}

function InquiryDetails({ lead }: { lead: AdminInquiry }) {
  const t = useTranslations('admin.leads')
  const f = useLeadFormat()
  const travel = f.travel(lead)
  return (
    <>
      <DetailSection title={t('sections.trip')} icon="luggage">
        <DetailList
          items={[
            {
              label: t('fields.tour'),
              value: lead.tour ? (
                <a
                  href={`/tours/${lead.tour.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  {lead.tour.title}
                  <Icon name="open_in_new" className="text-[14px]" />
                  <span className="sr-only">{t('newTab')}</span>
                </a>
              ) : null,
              wide: true,
            },
            ...(lead.destination ? [{ label: t('fields.destination'), value: lead.destination.name, wide: true }] : []),
            {
              label: t('fields.travelDates'),
              value: travel
                ? lead.travelStart && lead.travelWindow
                  ? `${travel} (${lead.travelWindow})`
                  : travel
                : null,
            },
            {
              label: t('fields.flexible'),
              value: lead.flexibleDates
                ? lead.flexibility
                  ? `${t('yes')} — ${lead.flexibility}`
                  : t('yes')
                : t('no'),
            },
            { label: t('fields.duration'), value: lead.durationPreference },
            { label: t('fields.pace'), value: lead.pace },
            { label: t('fields.stayStyle'), value: lead.stayStyle },
            {
              label: t('fields.interests'),
              value: lead.interests.length ? <ChipList items={lead.interests} /> : null,
              wide: true,
            },
          ]}
        />
      </DetailSection>

      <DetailSection title={t('sections.guests')} icon="group">
        <DetailList
          items={[
            { label: t('fields.partyType'), value: lead.partyType ? t(`partyTypes.${lead.partyType}`) : null },
            { label: t('fields.guests'), value: f.guests(lead.adults, lead.children) },
          ]}
        />
      </DetailSection>

      <DetailSection title={t('sections.contact')} icon="contact_mail">
        <DetailList
          items={[
            {
              label: t('fields.email'),
              value: <ContactValue value={lead.email} href={`mailto:${lead.email}`} copyLabel={t('copyEmail')} />,
              wide: true,
            },
            {
              label: t('fields.whatsapp'),
              value: lead.whatsapp ? <ContactValue value={lead.whatsapp} copyLabel={t('copyPhone')} /> : null,
            },
            { label: t('fields.country'), value: lead.country },
          ]}
        />
      </DetailSection>

      <DetailSection title={t('sections.message')} icon="chat_bubble">
        {lead.message ? (
          <p className="whitespace-pre-wrap break-words rounded-xl bg-surface-container-low px-4 py-3 font-body-md text-body-md leading-relaxed text-on-surface">
            {lead.message}
          </p>
        ) : (
          <p className="font-body-md text-body-md text-outline">{t('noMessage')}</p>
        )}
      </DetailSection>
    </>
  )
}
