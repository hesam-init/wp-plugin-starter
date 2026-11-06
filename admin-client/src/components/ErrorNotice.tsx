import { Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

interface Props {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorNotice({ error, onRetry }: Props) {
  const message =
    error instanceof Error ? error.message : __('Something went wrong.', 'wp-plugin-starter');

  return (
    <Notice status="error" isDismissible={false}>
      <div className="tw:flex tw:items-center tw:gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button variant="link" onClick={onRetry}>
            {__('Retry', 'wp-plugin-starter')}
          </Button>
        )}
      </div>
    </Notice>
  );
}
