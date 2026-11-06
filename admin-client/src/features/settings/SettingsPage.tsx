import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  RangeControl,
  SelectControl,
  TextControl,
  ToggleControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { type FormEvent, useState } from 'react';
import { ApiError } from '@/api/client';
import { fieldErrors, type Settings, SettingsSchema } from '@/api/schemas';
import { ErrorNotice } from '@/components/ErrorNotice';
import { LoadingState } from '@/components/LoadingState';
import { useNotices } from '@/components/notices-context';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';

export function SettingsPage() {
  const { data, error, isPending, refetch } = useSettings();

  if (isPending) return <LoadingState />;
  if (error) return <ErrorNotice error={error} onRetry={() => void refetch()} />;

  // `key` resets the form state whenever fresh server data arrives.
  return <SettingsForm key={JSON.stringify(data)} initial={data} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState<Settings>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = useUpdateSettings();
  const { notify } = useNotices();

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = SettingsSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    update.mutate(parsed.data, {
      onSuccess: () => notify(__('Settings saved.', 'wp-plugin-starter')),
      onError: (err) => {
        if (err instanceof ApiError) setErrors(err.fieldErrors);
      },
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <h2 className="tw:m-0 tw:text-base tw:font-semibold">
            {__('General', 'wp-plugin-starter')}
          </h2>
        </CardHeader>

        <CardBody className="tw:flex tw:max-w-2xl tw:flex-col tw:gap-6">
          {update.error && <ErrorNotice error={update.error} />}

          <TextControl
            __next40pxDefaultSize
            __nextHasNoMarginBottom
            label={__('Welcome message', 'wp-plugin-starter')}
            help={
              errors.welcomeMessage ??
              __('Shown at the top of the plugin page.', 'wp-plugin-starter')
            }
            value={values.welcomeMessage}
            onChange={(v) => set('welcomeMessage', v)}
          />

          <RangeControl
            __next40pxDefaultSize
            __nextHasNoMarginBottom
            label={__('Items per page', 'wp-plugin-starter')}
            help={errors.itemsPerPage}
            min={1}
            max={100}
            value={values.itemsPerPage}
            onChange={(v) => set('itemsPerPage', v ?? 10)}
          />

          <SelectControl
            __next40pxDefaultSize
            __nextHasNoMarginBottom
            label={__('Mode', 'wp-plugin-starter')}
            help={errors.mode}
            value={values.mode}
            options={[
              { label: __('Simple', 'wp-plugin-starter'), value: 'simple' },
              { label: __('Advanced', 'wp-plugin-starter'), value: 'advanced' },
            ]}
            onChange={(v) => set('mode', v as Settings['mode'])}
          />

          <ToggleControl
            __nextHasNoMarginBottom
            label={__('Delete all plugin data when the plugin is deleted', 'wp-plugin-starter')}
            help={__(
              'Leave off unless you are sure — this drops the items table.',
              'wp-plugin-starter',
            )}
            checked={values.deleteDataOnUninstall}
            onChange={(v) => set('deleteDataOnUninstall', v)}
          />
        </CardBody>

        <CardFooter justify="flex-end">
          <Button
            __next40pxDefaultSize
            variant="tertiary"
            disabled={!dirty || update.isPending}
            onClick={() => {
              setValues(initial);
              setErrors({});
            }}
          >
            {__('Reset', 'wp-plugin-starter')}
          </Button>
          <Button
            __next40pxDefaultSize
            variant="primary"
            type="submit"
            isBusy={update.isPending}
            disabled={!dirty || update.isPending}
          >
            {__('Save settings', 'wp-plugin-starter')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
