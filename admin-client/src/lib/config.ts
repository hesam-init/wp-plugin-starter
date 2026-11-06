import { z } from 'zod';

/** Must match AdminPage::ROOT_ID in PHP. */
export const ROOT_ID = 'wp-plugin-starter-root';

/**
 * Shape of the boot data printed by PHP (plugin/src/Admin/Assets.php).
 * REST root + nonce are not here: WordPress configures wp.apiFetch with them.
 */
const ConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  restNamespace: z.string(),
  adminUrl: z.url(),
  pluginUrl: z.url(),
  /** WordPress locale of the current user, e.g. `fa_IR`. */
  locale: z.string(),
  user: z.object({
    id: z.number().int(),
    displayName: z.string(),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

declare global {
  interface Window {
    wpPluginStarter?: unknown;
  }
}

function readConfig(): AppConfig {
  const result = ConfigSchema.safeParse(window.wpPluginStarter);
  if (!result.success) {
    throw new Error(
      `[wp-plugin-starter] Invalid boot config from PHP:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

export const config = readConfig();
