/**
 * `@wordpress/i18n` → `window.wp.i18n` (see ./README.md).
 * Exports every runtime member so bundled packages (e.g. @wordpress/components) resolve too.
 */
import type * as I18n from '@wordpress/i18n';
import { wpGlobal } from './global';

const i18n = wpGlobal<typeof I18n>('i18n', 'wp-i18n');

export const {
  __,
  _x,
  _n,
  _nx,
  sprintf,
  isRTL,
  hasTranslation,
  getLocaleData,
  setLocaleData,
  resetLocaleData,
  subscribe,
  createI18n,
  defaultI18n,
} = i18n;
