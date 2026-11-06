/**
 * `@wordpress/api-fetch` → `window.wp.apiFetch` (see ./README.md).
 * WordPress configures it with the REST root, nonce + nonce refresh endpoint.
 */
import type { ApiFetch } from '@wordpress/api-fetch';
import { wpGlobal } from './global';

const apiFetch = wpGlobal<ApiFetch>('apiFetch', 'wp-api-fetch');

export default apiFetch;
