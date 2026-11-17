'use client'

import { useTranslations } from 'next-intl'
import { CsvExportButton } from '@/components/admin/kit/actions'
import { AdminPagination } from '@/components/admin/kit/AdminPagination'
import { DataTable, type DataTableColumn } from '@/components/admin/kit/DataTable'
import { FilterBar, FilterTabs } from '@/components/admin/kit/FilterBar'
import { PageHeader } from '@/components/admin/kit/PageHeader'
import { EmptyPanel, ErrorPanel } from '@/components/admin/kit/Panels'
import { StatusBadge } from '@/components/admin/kit/StatusBadge'
import { Button } from '@/components/admin/kit/Button'
import { Icon } from '@/components/ui/Icon'
import { adminApi, unwrap } from '@/lib/admin/client'
import { useAdminQuery } from '@/lib/admin/hooks'
import { inquiriesApi, isLeadStatus, LEAD_PAGE_SIZE, LEAD_STATUSES } from '@/lib/admin/leads'
import { useDrawerParam, useUrlState } from '@/lib/admin/url-state'
import type { AdminInquiryListItem } from '@/lib/api/types'
import { useAdminSession } from '../shell/AdminSession'
import { InquiryDrawer } from './InquiryDrawer'
import { useLeadFormat } from './useLeadFormat'

const DEFAULTS = { status: '', q: '', from: '', to: '', tour: '', country: '', page: '1' }

/** /admin/inquiries — status tabs with counts, URL-synced filters, table/cards, pagination, CSV export, `?id=` drawer. */
export function InquiriesScreen() {
  const t = useTranslations('admin.inquiries')
  const tl = useTranslations('admin.leads')
  const f = useLeadFormat()
  const filters = useUrlState(DEFAULTS)
  const drawer = useDrawerParam('id')
  const { stats } = useAdminSession()

  const { status: rawStatus, q, from, to, tour, country, page: rawPage } = filters.values
  const status = isLeadStatus(rawStatus) ? rawStatus : undefined
  const page = Math.max(1, Number.parseInt(rawPage, 10) || 1)
  const exportQuery = { status, q, from, to, tour, country }
  const query = { ...exportQuery, page, pageSize: LEAD_PAGE_SIZE }

  const list = useAdminQuery(['inquiries', query], (signal) => inquiriesApi.list(query, signal))
  const tours = useAdminQuery(['tours', 'options'], (signal) =>
    unwrap(adminApi.GET('/api/v1/admin/tours', { params: { query: { pageSize: 100 } }, signal })),
  )
  const tourOptions = (tours.data?.items ?? []).map((item) => ({ value: item.id, label: item.title }))
  const countrySuggestions = (stats?.inquiries.byCountry ?? []).map((c) => c.country).filter((c) => c !== 'Unknown')
  const counts = list.data?.counts

  const columns: DataTableColumn<AdminInquiryListItem>[] = [
    {
      key: 'name',
      header: tl('columns.guest'),
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 font-semibold text-primary">
            {row.name}
            {row.hasNotes && <Icon name="sticky_note_2" className="text-[15px] text-secondary" label={tl('hasNotes')} />}
          </span>
          <span className="max-w-[14rem] truncate font-caption text-caption text-on-surface-variant">{row.email}</span>
        </span>
      ),
      className: 'min-w-[10rem]',
    },
    {
      key: 'reference',
      header: tl('columns.reference'),
      cell: (row) => <span className="whitespace-nowrap font-mono text-[12px] text-on-surface-variant">{row.reference}</span>,
    },
    {
      key: 'tour',
      header: tl('columns.tour'),
      cell: (row) => (
        <span className="block min-w-[8rem] max-w-[11rem]">
          {row.tour?.title ?? row.destination?.name ?? <span className="text-outline">{tl('noTour')}</span>}
        </span>
      ),
    },
    {
      key: 'travel',
      header: tl('columns.travel'),
      cell: (row) => <span className="block min-w-[7rem] max-w-[10rem]">{f.travel(row) || <span className="text-outline">—</span>}</span>,
    },
    {
      key: 'guests',
      header: tl('columns.guestsCountry'),
      cell: (row) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap">{f.guests(row.adults, row.children)}</span>
          {row.country && <span className="font-caption text-caption text-on-surface-variant">{row.country}</span>}
        </span>
      ),
    },
    {
      key: 'received',
      header: tl('columns.received'),
      cell: (row) => (
        <span className="flex flex-col whitespace-nowrap" title={f.dateTime(row.createdAt)}>
          <span>{f.date(row.createdAt)}</span>
          <span className="font-caption text-caption text-on-surface-variant">{f.relative(row.createdAt)}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: tl('columns.status'),
      cell: (row) => <StatusBadge kind="lead" status={row.status} />,
      mobile: 'badge',
    },
    {
      key: 'email',
      header: tl('columns.email'),
      cell: (row) => <StatusBadge kind="email" status={row.emailStatus} noIcon />,
      hideBelow: 'xl',
      mobile: 'hidden',
    },
  ]

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={<CsvExportButton resource="inquiries" query={exportQuery} />}
      />

      <div className="shadow-ambient flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-4 md:p-5">
        <FilterTabs
          label={tl('statusTabs')}
          controlsId="inquiries-results"
          value={status ?? ''}
          onChange={(value) => filters.set({ status: value })}
          tabs={[
            { value: '', label: tl('tabs.all'), count: counts?.total },
            ...LEAD_STATUSES.map((s) => ({ value: s, label: tl(`tabs.${s}`), count: counts?.[s] })),
          ]}
        />
        <FilterBar
          state={filters}
          fields={[
            { type: 'search', key: 'q', label: tl('filters.search'), placeholder: t('searchPlaceholder') },
            { type: 'dateRange', fromKey: 'from', toKey: 'to', label: tl('filters.received') },
            { type: 'select', key: 'tour', label: tl('filters.tour'), options: tourOptions, allLabel: tl('filters.allTours') },
            {
              type: 'text',
              key: 'country',
              label: tl('filters.country'),
              placeholder: tl('filters.countryPlaceholder'),
              suggestions: countrySuggestions,
            },
          ]}
        />

        {list.error && !list.data ? (
          <ErrorPanel error={list.error} onRetry={() => void list.refetch()} variant="inline" />
        ) : (
          <DataTable
            id="inquiries-results"
            caption={t('tableCaption')}
            columns={columns}
            rows={list.data?.items}
            loading={list.loading}
            fetching={list.fetching}
            getRowId={(row) => row.id}
            onRowClick={(row) => drawer.open(row.id)}
            rowLabel={(row) => tl('openRow', { name: row.name, reference: row.reference })}
            activeRowId={drawer.id}
            empty={
              filters.isDefault() ? (
                <EmptyPanel icon="inbox" title={t('emptyTitle')} body={t('emptyBody')} />
              ) : (
                <EmptyPanel
                  icon="filter_alt_off"
                  title={tl('noMatchesTitle')}
                  body={tl('noMatchesBody')}
                  action={
                    <Button icon="filter_alt_off" onClick={() => filters.reset()}>
                      {tl('clearFilters')}
                    </Button>
                  }
                />
              )
            }
          />
        )}

        {list.data && list.data.meta.total > 0 && (
          <AdminPagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            total={list.data.meta.total}
            pageSize={list.data.meta.pageSize}
            onPageChange={(p) => filters.set({ page: String(p) })}
          />
        )}
      </div>

      <InquiryDrawer id={drawer.id} onClose={drawer.close} />
    </>
  )
}
