import { Button, Modal, SelectControl, TextareaControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { type FormEvent, useState } from 'react';
import { ApiError } from '@/api/client';
import {
  fieldErrors,
  type Item,
  type ItemInput,
  ItemInputSchema,
  itemStatusLabels,
} from '@/api/schemas';
import { ErrorNotice } from '@/components/ErrorNotice';
import { useNotices } from '@/components/notices-context';
import { useCreateItem, useUpdateItem } from '@/hooks/useItems';

interface Props {
  /** Item to edit; omit to create a new one. */
  item?: Item;
  onClose: () => void;
}

const EMPTY: ItemInput = { title: '', content: '', status: 'draft' };

export function ItemFormModal({ item, onClose }: Props) {
  const [values, setValues] = useState<ItemInput>(
    item ? { title: item.title, content: item.content, status: item.status } : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateItem();
  const update = useUpdateItem();
  const { notify } = useNotices();
  const statusLabels = itemStatusLabels();

  const mutation = item ? update : create;
  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = ItemInputSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    const callbacks = {
      onSuccess: () => {
        notify(
          item
            ? __('Item updated.', 'wp-plugin-starter')
            : __('Item created.', 'wp-plugin-starter'),
        );
        onClose();
      },
      onError: (err: unknown) => {
        if (err instanceof ApiError) setErrors(err.fieldErrors);
      },
    };

    if (item) update.mutate({ id: item.id, changes: parsed.data }, callbacks);
    else create.mutate(parsed.data, callbacks);
  };

  return (
    <Modal
      title={item ? __('Edit item', 'wp-plugin-starter') : __('Add item', 'wp-plugin-starter')}
      onRequestClose={onClose}
      size="medium"
    >
      <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-5">
        {mutation.error && <ErrorNotice error={mutation.error} />}

        <TextControl
          __next40pxDefaultSize
          __nextHasNoMarginBottom
          label={__('Title', 'wp-plugin-starter')}
          value={values.title}
          help={errors.title}
          onChange={(v) => set('title', v)}
          autoFocus
        />

        <TextareaControl
          __nextHasNoMarginBottom
          label={__('Content', 'wp-plugin-starter')}
          rows={5}
          value={values.content}
          help={errors.content}
          onChange={(v) => set('content', v)}
        />

        <SelectControl
          __next40pxDefaultSize
          __nextHasNoMarginBottom
          label={__('Status', 'wp-plugin-starter')}
          value={values.status}
          help={errors.status}
          options={[
            { label: statusLabels.draft, value: 'draft' },
            { label: statusLabels.published, value: 'published' },
          ]}
          onChange={(v) => set('status', v as ItemInput['status'])}
        />

        <div className="tw:flex tw:justify-end tw:gap-2">
          <Button __next40pxDefaultSize variant="tertiary" onClick={onClose}>
            {__('Cancel', 'wp-plugin-starter')}
          </Button>
          <Button
            __next40pxDefaultSize
            variant="primary"
            type="submit"
            isBusy={mutation.isPending}
            disabled={mutation.isPending}
          >
            {item
              ? __('Save changes', 'wp-plugin-starter')
              : __('Create item', 'wp-plugin-starter')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
