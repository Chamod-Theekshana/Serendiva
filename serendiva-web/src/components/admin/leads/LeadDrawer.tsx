'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/admin/kit/Button'
import { CopyButton, EmailReplyButton, WhatsAppReplyButton } from '@/components/admin/kit/actions'
import { useConfirm } from '@/components/admin/kit/ConfirmDialog'
import { DetailList, DetailSection } from '@/components/admin/kit/DetailList'
import { Drawer } from '@/components/admin/kit/Drawer'
import { ErrorPanel, LoadingPanel } from '@/components/admin/kit/Panels'
import { StatusBadge } from '@/components/admin/kit/StatusBadge'
import { Icon } from '@/components/ui/Icon'
import { invalidateAdminQueries, useAdminMutation, useAdminQuery, type AdminQueryResult } from '@/lib/admin/hooks'
import { LEAD_STATUSES, type LeadKind } from '@/lib/admin/leads'
import { confirmDiscardChanges, useUnsavedChanges } from '@/lib/admin/unsaved'
import { toast } from '@/lib/admin/toast'
import type { LeadEmailStatus, LeadStatus } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { useLeadFormat } from './useLeadFormat'

/** Fields both lead types share. */
export interface LeadCommon {
  id: string
  reference: string
  email: string
  status: LeadStatus
  internalNotes: string | null
  emailStatus: LeadEmailStatus
  guideEmailSentAt: string | null
  visitorEmailSentAt: string | null
  emailAttempts: number
  lastEmailError: string | null
  sourcePage: string | null
  locale: string
  createdAt: string
  updatedAt: string
}

export interface LeadApi<L extends LeadCommon> {
  get: (id: string, signal?: AbortSignal) => Promise<L>
  update: (id: string, body: { status?: LeadStatus; internalNotes?: string | null }) => Promise<L>
  remove: (id: string) => Promise<void>
  resendEmails: (id: string) => Promise<L>
}

export interface LeadDrawerProps<L extends LeadCommon> {
  kind: LeadKind
  /** Lead id from the URL (`?id=`); null = closed. */
  id: string | null
  onClose: () => void
  api: LeadApi<L>
  /** Drawer title (guest name / company). */
  title: (lead: L) => string
  /** Who the replies greet (guest name / contact person). */
  replyName: (lead: L) => string
  /** WhatsApp/phone number for the reply button. */
  replyPhone: (lead: L) => string | null
  /** Kind-specific detail sections. */
  renderDetails: (lead: L) => ReactNode
}

/**
 * Detail drawer shared by inquiries and proposals: reply buttons (WhatsApp / email), status, internal notes,
 * email delivery + resend, record info, delete with confirmation. URL-driven (`?id=`) by the parent screen.
 */
export function LeadDrawer<L extends LeadCommon>({ id, onClose, ...rest }: LeadDrawerProps<L>) {
  const t = useTranslations('admin.leads')
  const detail = useAdminQuery(
    [rest.kind === 'inquiries' ? 'inquiry' : 'proposal', id ?? ''],
    (signal) => rest.api.get(id ?? '', signal),
    [],
    { enabled: id !== null, keepPreviousData: false },
  )
  const close = async () => {
    if (await confirmDiscardChanges()) onClose()
  }
  const lead = id ? detail.data : undefined
  return (
    <Drawer
      open={id !== null}
      onClose={() => void close()}
      title={lead ? rest.title(lead) : rest.kind === 'inquiries' ? t('inquiryTitle') : t('proposalTitle')}
      size="lg"
    >
      {id && <LeadDrawerBody key={id} id={id} onClose={onClose} detail={detail} {...rest} />}
    </Drawer>
  )
}

function LeadDrawerBody<L extends LeadCommon>({
  id,
  kind,
  api,
  title,
  replyName,
  replyPhone,
  renderDetails,
  onClose,
  detail,
}: { id: string; onClose: () => void; detail: AdminQueryResult<L> } & Omit<LeadDrawerProps<L>, 'id' | 'onClose'>) {
  const t = useTranslations('admin.leads')
  const f = useLeadFormat()
  const confirm = useConfirm()
  const lead = detail.data
  const listResources = [kind, 'stats', 'dashboard']

  const update = useAdminMutation((body: { status?: LeadStatus; internalNotes?: string | null }) => api.update(id, body), {
    onSuccess: (updated) => {
      detail.setData(updated)
      invalidateAdminQueries(listResources)
    },
  })
  const resend = useAdminMutation(() => api.resendEmails(id), {
    onSuccess: (updated) => {
      detail.setData(updated)
      invalidateAdminQueries(listResources)
      toast.success(updated.emailStatus === 'sent' ? t('emails.resent') : t('emails.resentPartial'))
    },
  })
  const remove = useAdminMutation(() => api.remove(id), {
    successToast: t('deleted'),
    onSuccess: () => {
      invalidateAdminQueries(listResources)
      onClose()
    },
  })

  if (detail.error && !lead) {
    return detail.error.isNotFound ? (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Icon name="search_off" className="text-[32px] text-outline" />
        <p className="font-body-lg text-body-lg font-semibold text-primary">{t('notFoundTitle')}</p>
        <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">{t('notFoundBody')}</p>
        <Button className="mt-2" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
    ) : (
      <ErrorPanel error={detail.error} onRetry={() => void detail.refetch()} variant="inline" />
    )
  }
  if (!lead) return <LoadingPanel variant="detail" rows={7} card={false} />

  const setStatus = async (status: LeadStatus) => {
    if (status === lead.status) return
    const result = await update.mutate({ status })
    if (result.ok) toast.success(t('statusChanged', { status: t(`statusLabel.${status}`) }))
  }

  const suggestReplied = () => {
    if (lead.status !== 'new') return
    toast.info(t('markRepliedPrompt'), undefined, {
      duration: 10_000,
      action: { label: t('markReplied'), onClick: () => void setStatus('replied') },
    })
  }

  const onDelete = async () => {
    const ok = await confirm({
      title: t('deleteTitle', { reference: lead.reference }),
      body: t('deleteBody', { name: title(lead) }),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: 'delete',
    })
    if (ok) await remove.mutate()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* reference + received */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-0.5 rounded-lg bg-surface-container px-2 py-0.5 font-mono text-[13px] text-primary">
          {lead.reference}
          <CopyButton value={lead.reference} label={t('copyReference')} size="sm" className="-my-1 h-7 w-7" />
        </span>
        <StatusBadge kind="lead" status={lead.status} size="md" />
        <span className="font-body-md text-body-md text-on-surface-variant">
          {t('receivedAt', { date: f.dateTime(lead.createdAt) })}
        </span>
      </div>

      {/* reply */}
      <div className="flex flex-wrap gap-2" onClickCapture={(e) => (e.target as Element).closest('a') && suggestReplied()}>
        <WhatsAppReplyButton
          phone={replyPhone(lead)}
          name={replyName(lead)}
          reference={lead.reference}
          kind={kind === 'proposals' ? 'proposal' : 'inquiry'}
        />
        <EmailReplyButton
          email={lead.email}
          name={replyName(lead)}
          reference={lead.reference}
          kind={kind === 'proposals' ? 'proposal' : 'inquiry'}
          variant="secondary"
        />
      </div>

      {/* status */}
      <DetailSection title={t('sections.status')} icon="flag">
        <div role="group" aria-label={t('statusGroup')} className="grid grid-cols-3 gap-1 rounded-xl bg-surface-container p-1">
          {LEAD_STATUSES.map((status) => {
            const active = lead.status === status
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                disabled={update.pending}
                onClick={() => void setStatus(status)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-body-md text-body-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait',
                  active ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary',
                )}
              >
                {active && <Icon name="check" className="text-[16px]" />}
                {t(`statusLabel.${status}`)}
              </button>
            )
          })}
        </div>
      </DetailSection>

      {renderDetails(lead)}

      <DetailSection title={t('sections.notes')} icon="sticky_note_2">
        <LeadNotesEditor
          key={`${lead.id}-${lead.internalNotes ?? ''}`}
          initial={lead.internalNotes ?? ''}
          saving={update.pending}
          onSave={async (notes) => {
            const result = await update.mutate({ internalNotes: notes.trim() ? notes : null })
            if (result.ok) toast.success(t('notesSaved'))
            return result.ok
          }}
        />
      </DetailSection>

      <DetailSection title={t('sections.emails')} icon="forward_to_inbox">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="email" status={lead.emailStatus} size="md" />
            <span className="font-body-md text-body-md text-on-surface-variant">{t(`emails.explain.${lead.emailStatus}`)}</span>
          </div>
          <DetailList
            items={[
              { label: t('emails.guide'), value: lead.guideEmailSentAt ? f.dateTime(lead.guideEmailSentAt) : t('emails.notSent') },
              {
                label: t('emails.visitor'),
                value: lead.visitorEmailSentAt ? f.dateTime(lead.visitorEmailSentAt) : t('emails.notSent'),
              },
              { label: t('emails.attempts'), value: String(lead.emailAttempts) },
              ...(lead.lastEmailError ? [{ label: t('emails.lastError'), value: lead.lastEmailError, wide: true }] : []),
            ]}
          />
          <div>
            <Button
              size="sm"
              icon="send"
              loading={resend.pending}
              disabled={lead.emailStatus === 'sent'}
              title={lead.emailStatus === 'sent' ? t('emails.allDelivered') : undefined}
              onClick={() => void resend.mutate()}
            >
              {t('emails.resend')}
            </Button>
            {lead.emailStatus === 'sent' && (
              <span className="ml-2 font-caption text-caption text-on-surface-variant">{t('emails.allDelivered')}</span>
            )}
          </div>
        </div>
      </DetailSection>

      <DetailSection title={t('sections.record')} icon="info">
        <DetailList
          items={[
            { label: t('fields.sourcePage'), value: lead.sourcePage },
            { label: t('fields.language'), value: f.language(lead.locale) },
            { label: t('fields.created'), value: f.dateTime(lead.createdAt) },
            { label: t('fields.updated'), value: f.dateTime(lead.updatedAt) },
          ]}
        />
      </DetailSection>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-secondary/20 bg-secondary-fixed/20 px-4 py-3">
        <div>
          <p className="font-body-md text-body-md font-semibold text-on-surface">{t('dangerTitle')}</p>
          <p className="font-caption text-caption text-on-surface-variant">{t('dangerBody')}</p>
        </div>
        <Button variant="danger" size="sm" icon="delete" loading={remove.pending} onClick={() => void onDelete()}>
          {t('delete')}
        </Button>
      </div>
    </div>
  )
}

/** Internal notes textarea with Save (⌘/Ctrl+Enter), dirty indicator and unsaved-changes guard. */
export function LeadNotesEditor({
  initial,
  onSave,
  saving,
}: {
  initial: string
  onSave: (notes: string) => Promise<boolean>
  saving: boolean
}) {
  const t = useTranslations('admin.leads')
  const [text, setText] = useState(initial)
  const dirty = text !== initial
  useUnsavedChanges(dirty)
  const save = () => {
    if (dirty && !saving) void onSave(text)
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="lead-notes" className="sr-only">
        {t('sections.notes')}
      </label>
      <textarea
        id="lead-notes"
        value={text}
        rows={5}
        maxLength={10_000}
        placeholder={t('notesPlaceholder')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            save()
          }
        }}
        className="block w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-body-md leading-relaxed text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-caption text-caption text-on-surface-variant" aria-live="polite">
          {dirty ? t('notesUnsaved') : t('notesHint')}
        </span>
        <div className="flex items-center gap-1">
          {dirty && (
            <Button size="sm" variant="ghost" onClick={() => setText(initial)} disabled={saving}>
              {t('notesDiscard')}
            </Button>
          )}
          <Button size="sm" variant="primary" icon="save" onClick={save} disabled={!dirty} loading={saving}>
            {t('notesSave')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Small "copy" + mailto/tel helpers used in the contact sections. */
export function ContactValue({ value, href, copyLabel }: { value: string; href?: string; copyLabel: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      {href ? (
        <a href={href} className="truncate text-primary underline-offset-4 hover:underline">
          {value}
        </a>
      ) : (
        <span className="truncate">{value}</span>
      )}
      <CopyButton value={value} label={copyLabel} size="sm" className="h-7 w-7" />
    </span>
  )
}

/** Chip list (interests, logistics). */
export function ChipList({ items }: { items: readonly string[] }) {
  if (!items.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-surface-container px-2.5 py-0.5 font-body-md text-[13px] text-primary">
          {item}
        </li>
      ))}
    </ul>
  )
}
