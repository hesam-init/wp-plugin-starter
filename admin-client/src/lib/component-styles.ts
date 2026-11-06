import ltrUrl from '@wordpress/components/build-style/style.css?url';
import rtlUrl from '@wordpress/components/build-style/style-rtl.css?url';
import { isRtl } from './i18n';

/**
 * @wordpress/components ships separate LTR and RTL stylesheets. Load the one
 * matching the admin's direction, and wait for it so nothing renders unstyled.
 */
export function loadComponentStyles(): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = isRtl ? rtlUrl : ltrUrl;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}
