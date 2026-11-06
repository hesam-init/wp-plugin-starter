import { TabPanel } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { ItemsPage } from '@/features/items/ItemsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { useSettings } from '@/hooks/useSettings';
import { config } from '@/lib/config';

// Translated at module load — wp.i18n already has the locale data by then.
const TABS = [
  { name: 'items', title: __('Items', 'wp-plugin-starter'), render: () => <ItemsPage /> },
  { name: 'settings', title: __('Settings', 'wp-plugin-starter'), render: () => <SettingsPage /> },
] as const;

// wp-admin has no client router — keep the active tab in the URL hash.
const initialTab = TABS.some((t) => `#${t.name}` === window.location.hash)
  ? window.location.hash.slice(1)
  : TABS[0].name;

export function App() {
  const { data: settings } = useSettings();

  return (
    <div className="tw:mt-4 tw:flex tw:flex-col tw:gap-4">
      <header className="tw:flex tw:items-baseline tw:justify-between tw:gap-4">
        <div>
          <h1 className="tw:m-0 tw:p-0 tw:text-2xl tw:font-semibold">{config.name}</h1>
          {settings?.welcomeMessage && (
            <p className="tw:m-0 tw:mt-1 tw:text-gray-600">{settings.welcomeMessage}</p>
          )}
        </div>
        <span className="tw:rounded tw:bg-white tw:px-2 tw:py-1 tw:text-xs tw:text-gray-500 tw:shadow-sm">
          {
            /* translators: %s: plugin version number. */
            sprintf(__('Version %s', 'wp-plugin-starter'), config.version)
          }
        </span>
      </header>

      <TabPanel
        tabs={TABS.map(({ name, title }) => ({ name, title }))}
        initialTabName={initialTab}
        onSelect={(name) => window.history.replaceState(null, '', `#${name}`)}
      >
        {(tab) => <div className="tw:pt-4">{TABS.find((t) => t.name === tab.name)?.render()}</div>}
      </TabPanel>
    </div>
  );
}
