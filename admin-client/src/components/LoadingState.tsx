import { Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="tw:flex tw:items-center tw:gap-2 tw:p-6 tw:text-gray-600">
      <Spinner />
      <span>{label ?? __('Loading…', 'wp-plugin-starter')}</span>
    </div>
  );
}
