import { Button, Card, CardBody, CardHeader, Dashicon } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { ReactNode } from 'react';
import type { Requirement, Status } from '@/api/schemas';
import { ErrorNotice } from '@/components/ErrorNotice';
import { LoadingState } from '@/components/LoadingState';
import { useNotices } from '@/components/notices-context';
import { useStatus } from '@/hooks/useStatus';
import { formatNumber } from '@/lib/i18n';

interface Row {
  label: string;
  /** Plain-text value, used for the copied report (and the cell when `node` is absent). */
  text: string;
  node?: ReactNode;
}

interface Section {
  id: string;
  title: string;
  rows: Row[];
}

export function StatusPage() {
  const { data, error, isPending, isFetching, refetch } = useStatus();
  const { notify } = useNotices();

  if (isPending) return <LoadingState />;
  if (error) return <ErrorNotice error={error} onRetry={() => void refetch()} />;

  const sections = buildSections(data);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toText(sections));
      notify(__('Status report copied to the clipboard.', 'wp-plugin-starter'));
    } catch {
      notify(
        __(
          'Could not copy the report. Your browser blocked clipboard access.',
          'wp-plugin-starter',
        ),
      );
    }
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
        <p className="tw:m-0 tw:text-gray-600">
          {__(
            'Information about your site and server, useful for debugging and support requests.',
            'wp-plugin-starter',
          )}
        </p>
        <div className="tw:flex tw:gap-2">
          <Button
            __next40pxDefaultSize
            variant="secondary"
            isBusy={isFetching}
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {__('Refresh', 'wp-plugin-starter')}
          </Button>
          <Button __next40pxDefaultSize variant="primary" onClick={() => void copy()}>
            {__('Copy report', 'wp-plugin-starter')}
          </Button>
        </div>
      </div>

      <div className="tw:grid tw:items-start tw:gap-4 tw:lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <h2 className="tw:m-0 tw:text-base tw:font-semibold">{section.title}</h2>
            </CardHeader>
            <CardBody className="tw:p-0">
              <table className="wp-list-table widefat striped tw:border-0">
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="tw:w-2/5 tw:font-medium">
                        {row.label}
                      </th>
                      <td className="tw:break-all">{row.node ?? row.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const yesNo = (value: boolean): string =>
  value ? __('Yes', 'wp-plugin-starter') : __('No', 'wp-plugin-starter');

const enabled = (value: boolean): string =>
  value ? __('Enabled', 'wp-plugin-starter') : __('Disabled', 'wp-plugin-starter');

function Flag({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-1">
      <Dashicon
        icon={ok ? 'yes-alt' : 'warning'}
        className={ok ? 'tw:text-green-700' : 'tw:text-red-700'}
      />
      <span>{children}</span>
    </span>
  );
}

/** Version row with a pass/fail badge against the plugin's minimum. */
function versionRow(label: string, version: string, requirement: Requirement): Row {
  if (requirement.required === '') return { label, text: version };

  const note = sprintf(
    /* translators: %s: minimum required version number. */
    __('requires %s or later', 'wp-plugin-starter'),
    requirement.required,
  );
  const text = requirement.ok ? version : `${version} (${note})`;

  return {
    label,
    text,
    node: (
      <Flag ok={requirement.ok}>
        {version}
        {!requirement.ok && <span className="tw:ms-1 tw:text-red-700">({note})</span>}
      </Flag>
    ),
  };
}

/** PHP ini size such as `256M`; `-1` means no limit. */
const size = (value: string): string =>
  value === '-1' ? __('Unlimited', 'wp-plugin-starter') : value;

function seconds(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || value === '') return value;
  if (n === 0) return __('Unlimited', 'wp-plugin-starter');
  return sprintf(
    /* translators: %s: number of seconds. */
    _n('%s second', '%s seconds', n, 'wp-plugin-starter'),
    formatNumber(n),
  );
}

function buildSections(status: Status): Section[] {
  // The Plugin section is hidden. To restore it, add `plugin` back to this
  // destructuring and uncomment the block below and the section in the list.
  const { wordpress: wp, server, database } = status;
  const extensions = Object.entries(server.extensions);
  const missing = extensions.filter(([, loaded]) => !loaded).map(([name]) => name);

  // const dbUpToDate = plugin.dbVersionInstalled === plugin.dbVersion;
  //
  // const itemsText = plugin.itemsTable.exists
  //   ? sprintf(
  //       /* translators: %s: number of rows. */
  //       _n('%s row', '%s rows', plugin.itemsTable.rows, 'wp-plugin-starter'),
  //       formatNumber(plugin.itemsTable.rows),
  //     )
  //   : __('Missing', 'wp-plugin-starter');
  //
  // const dbText = dbUpToDate
  //   ? plugin.dbVersion
  //   : sprintf(
  //       /* translators: 1: installed schema version, 2: expected schema version. */
  //       __('%1$s (expected %2$s)', 'wp-plugin-starter'),
  //       plugin.dbVersionInstalled ?? __('not installed', 'wp-plugin-starter'),
  //       plugin.dbVersion,
  //     );

  return [
    {
      id: 'wordpress',
      title: __('WordPress', 'wp-plugin-starter'),
      rows: [
        versionRow(__('Version', 'wp-plugin-starter'), wp.version, wp.requirement),
        { label: __('Site URL', 'wp-plugin-starter'), text: wp.siteUrl },
        { label: __('Home URL', 'wp-plugin-starter'), text: wp.homeUrl },
        { label: __('Multisite', 'wp-plugin-starter'), text: yesNo(wp.multisite) },
        { label: __('Environment', 'wp-plugin-starter'), text: wp.environment },
        { label: __('Language', 'wp-plugin-starter'), text: wp.locale },
        { label: __('Timezone', 'wp-plugin-starter'), text: wp.timezone },
        {
          label: __('Permalinks', 'wp-plugin-starter'),
          text: wp.permalinks || __('Plain', 'wp-plugin-starter'),
        },
        { label: __('Debug mode', 'wp-plugin-starter'), text: enabled(wp.debug) },
        { label: __('WP memory limit', 'wp-plugin-starter'), text: wp.memoryLimit },
        { label: __('WP-Cron', 'wp-plugin-starter'), text: enabled(!wp.cronDisabled) },
        {
          label: __('Active theme', 'wp-plugin-starter'),
          text: [wp.theme.name, wp.theme.version].filter(Boolean).join(' '),
        },
        { label: __('Active plugins', 'wp-plugin-starter'), text: formatNumber(wp.activePlugins) },
      ],
    },
    {
      id: 'server',
      title: __('Server & PHP', 'wp-plugin-starter'),
      rows: [
        versionRow(__('PHP version', 'wp-plugin-starter'), server.phpVersion, server.requirement),
        { label: __('PHP SAPI', 'wp-plugin-starter'), text: server.sapi },
        {
          label: __('Web server', 'wp-plugin-starter'),
          text: server.software || __('Unknown', 'wp-plugin-starter'),
        },
        { label: __('PHP memory limit', 'wp-plugin-starter'), text: size(server.memoryLimit) },
        {
          label: __('Max execution time', 'wp-plugin-starter'),
          text: seconds(server.maxExecutionTime),
        },
        { label: __('Max upload size', 'wp-plugin-starter'), text: server.uploadMaxFilesize },
        { label: __('Max POST size', 'wp-plugin-starter'), text: server.postMaxSize },
        {
          label: __('Extensions', 'wp-plugin-starter'),
          text:
            missing.length === 0
              ? __('All loaded', 'wp-plugin-starter')
              : sprintf(
                  /* translators: %s: comma-separated list of PHP extension names. */
                  __('Missing: %s', 'wp-plugin-starter'),
                  missing.join(', '),
                ),
          node: (
            <ul className="tw:m-0 tw:flex tw:flex-wrap tw:gap-1 tw:p-0">
              {extensions.map(([name, loaded]) => (
                <li
                  key={name}
                  className={`tw:m-0 tw:rounded tw:px-2 tw:py-0.5 tw:text-xs ${
                    loaded
                      ? 'tw:bg-green-100 tw:text-green-800'
                      : 'tw:bg-gray-100 tw:text-gray-500 tw:line-through'
                  }`}
                >
                  {name}
                </li>
              ))}
            </ul>
          ),
        },
      ],
    },
    // {
    //   id: 'plugin',
    //   title: __('Plugin', 'wp-plugin-starter'),
    //   rows: [
    //     { label: __('Version', 'wp-plugin-starter'), text: plugin.version },
    //     {
    //       label: __('Database schema', 'wp-plugin-starter'),
    //       text: dbText,
    //       node: <Flag ok={dbUpToDate}>{dbText}</Flag>,
    //     },
    //     {
    //       label: __('Items table', 'wp-plugin-starter'),
    //       text: itemsText,
    //       node: <Flag ok={plugin.itemsTable.exists}>{itemsText}</Flag>,
    //     },
    //     {
    //       label: __('Assets', 'wp-plugin-starter'),
    //       text:
    //         plugin.assetMode === 'dev'
    //           ? __('Vite dev server (HMR)', 'wp-plugin-starter')
    //           : __('Production build', 'wp-plugin-starter'),
    //     },
    //   ],
    // },

    {
      id: 'database',
      title: __('Database', 'wp-plugin-starter'),
      rows: [
        { label: __('Server', 'wp-plugin-starter'), text: database.type },
        { label: __('Version', 'wp-plugin-starter'), text: database.version },
        { label: __('Table prefix', 'wp-plugin-starter'), text: database.prefix },
        { label: __('Charset', 'wp-plugin-starter'), text: database.charset },
        { label: __('Collation', 'wp-plugin-starter'), text: database.collate },
      ],
    },
  ];
}

/** Plain-text report for support requests. */
function toText(sections: Section[]): string {
  return sections
    .map(
      (section) =>
        `### ${section.title} ###\n` +
        section.rows.map((row) => `${row.label}: ${row.text}`).join('\n'),
    )
    .join('\n\n');
}
