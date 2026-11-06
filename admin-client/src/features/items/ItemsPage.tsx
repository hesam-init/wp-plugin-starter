import {
  Button,
  Card,
  CardBody,
  SearchControl,
  SelectControl,
  Spinner,
} from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useState } from 'react';
import { itemStatusLabels, type Item, type ItemStatus } from '@/api/schemas';
import { ErrorNotice } from '@/components/ErrorNotice';
import { LoadingState } from '@/components/LoadingState';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useItems } from '@/hooks/useItems';
import { useSettings } from '@/hooks/useSettings';
import { formatDateTime, formatNumber } from '@/lib/i18n';
import { DeleteItemModal } from './DeleteItemModal';
import { ItemFormModal } from './ItemFormModal';

type ModalState =
  { type: 'create' } | { type: 'edit'; item: Item } | { type: 'delete'; item: Item } | null;

export function ItemsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ItemStatus | ''>('');
  const [modal, setModal] = useState<ModalState>(null);
  const statusLabels = itemStatusLabels();

  const debouncedSearch = useDebouncedValue(search);
  const perPage = useSettings().data?.itemsPerPage ?? 10;
  const { data, error, isPending, isFetching, refetch } = useItems({
    page,
    perPage,
    search: debouncedSearch,
    status,
  });

  const totalPages = Math.max(1, data?.totalPages ?? 1);

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <Card>
        <CardBody className="tw:flex tw:flex-wrap tw:items-end tw:gap-4">
          <div className="tw:min-w-64 tw:flex-1">
            <SearchControl
              __nextHasNoMarginBottom
              label={__('Search items', 'wp-plugin-starter')}
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
            />
          </div>
          <div className="tw:w-48">
            <SelectControl
              __next40pxDefaultSize
              __nextHasNoMarginBottom
              label={__('Status', 'wp-plugin-starter')}
              hideLabelFromVision
              value={status}
              options={[
                { label: __('All statuses', 'wp-plugin-starter'), value: '' },
                { label: statusLabels.draft, value: 'draft' },
                { label: statusLabels.published, value: 'published' },
              ]}
              onChange={(v) => {
                setStatus(v as ItemStatus | '');
                setPage(1);
              }}
            />
          </div>
          {isFetching && !isPending && <Spinner />}
          <Button
            __next40pxDefaultSize
            variant="primary"
            onClick={() => setModal({ type: 'create' })}
          >
            {__('Add item', 'wp-plugin-starter')}
          </Button>
        </CardBody>
      </Card>

      {error && <ErrorNotice error={error} onRetry={() => void refetch()} />}

      {isPending ? (
        <LoadingState label={__('Loading items…', 'wp-plugin-starter')} />
      ) : (
        data && (
          <>
            {/* Core list-table classes give a native wp-admin look (and RTL) for free. */}
            <table className="wp-list-table widefat striped fixed">
              <thead>
                <tr>
                  <th className="tw:w-1/2">{__('Title', 'wp-plugin-starter')}</th>
                  <th>{__('Status', 'wp-plugin-starter')}</th>
                  <th>{__('Updated', 'wp-plugin-starter')}</th>
                  <th className="tw:w-40 tw:text-end">{__('Actions', 'wp-plugin-starter')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="tw:py-8 tw:text-center tw:text-gray-500">
                      {__('No items found.', 'wp-plugin-starter')}
                    </td>
                  </tr>
                ) : (
                  data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.title}</strong>
                        {item.content && (
                          <p className="tw:m-0 tw:mt-1 tw:line-clamp-1 tw:text-gray-500">
                            {item.content}
                          </p>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={item.status} label={statusLabels[item.status]} />
                      </td>
                      <td>{formatDateTime(item.updatedAt)}</td>
                      <td className="tw:text-end">
                        <Button variant="link" onClick={() => setModal({ type: 'edit', item })}>
                          {__('Edit', 'wp-plugin-starter')}
                        </Button>
                        <span className="tw:mx-2 tw:text-gray-300">|</span>
                        <Button
                          variant="link"
                          isDestructive
                          onClick={() => setModal({ type: 'delete', item })}
                        >
                          {__('Delete', 'wp-plugin-starter')}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="tw:flex tw:items-center tw:justify-between">
              <span className="tw:text-gray-600">
                {sprintf(
                  /* translators: %s: number of items. */
                  _n('%s item', '%s items', data.total, 'wp-plugin-starter'),
                  formatNumber(data.total),
                )}
              </span>
              <div className="tw:flex tw:items-center tw:gap-2">
                <Button
                  __next40pxDefaultSize
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {__('Previous', 'wp-plugin-starter')}
                </Button>
                <span>
                  {sprintf(
                    /* translators: 1: current page number, 2: total number of pages. */
                    __('Page %1$s of %2$s', 'wp-plugin-starter'),
                    formatNumber(page),
                    formatNumber(totalPages),
                  )}
                </span>
                <Button
                  __next40pxDefaultSize
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {__('Next', 'wp-plugin-starter')}
                </Button>
              </div>
            </div>
          </>
        )
      )}

      {modal?.type === 'create' && <ItemFormModal onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <ItemFormModal item={modal.item} onClose={() => setModal(null)} />}
      {modal?.type === 'delete' && (
        <DeleteItemModal item={modal.item} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function StatusBadge({ status, label }: { status: ItemStatus; label: string }) {
  const styles =
    status === 'published'
      ? 'tw:bg-green-100 tw:text-green-800'
      : 'tw:bg-gray-100 tw:text-gray-700';
  return (
    <span
      className={`tw:inline-block tw:rounded-full tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium ${styles}`}
    >
      {label}
    </span>
  );
}
