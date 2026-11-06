import { Button, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import type { Item } from '@/api/schemas';
import { ErrorNotice } from '@/components/ErrorNotice';
import { useNotices } from '@/components/notices-context';
import { useDeleteItem } from '@/hooks/useItems';

export function DeleteItemModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const remove = useDeleteItem();
  const { notify } = useNotices();

  return (
    <Modal title={__('Delete item?', 'wp-plugin-starter')} onRequestClose={onClose} size="small">
      <div className="tw:flex tw:flex-col tw:gap-5">
        {remove.error && <ErrorNotice error={remove.error} />}
        <div>
          <strong>{item.title}</strong>
          <p className="tw:m-0 tw:mt-1">
            {__('This item will be permanently deleted.', 'wp-plugin-starter')}
          </p>
        </div>
        <div className="tw:flex tw:justify-end tw:gap-2">
          <Button __next40pxDefaultSize variant="tertiary" onClick={onClose}>
            {__('Cancel', 'wp-plugin-starter')}
          </Button>
          <Button
            __next40pxDefaultSize
            variant="primary"
            isDestructive
            isBusy={remove.isPending}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(item.id, {
                onSuccess: () => {
                  notify(__('Item deleted.', 'wp-plugin-starter'));
                  onClose();
                },
              })
            }
          >
            {__('Delete', 'wp-plugin-starter')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
