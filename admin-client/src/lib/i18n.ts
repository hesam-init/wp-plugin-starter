/**
 * Locale helpers. Strings are translated with `__()` from `@wordpress/i18n`
 * (always pass the 'wp-plugin-starter' text domain); this module covers the
 * rest: numbers, dates, direction and validation messages.
 */
import { isRTL } from '@wordpress/i18n';
import { z } from 'zod';
import { en, fa } from 'zod/locales';
import { config } from './config';

/** `fa_IR` → `fa-IR` (BCP 47, what Intl expects). */
export const locale = config.locale.replace('_', '-');
export const language = locale.split('-')[0] ?? 'en';
export const isRtl = isRTL();

const numberFormat = new Intl.NumberFormat(locale);
const dateTimeFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

/** Localised digits, e.g. ۱۲ in Persian. */
export const formatNumber = (value: number): string => numberFormat.format(value);

/** Localised date + calendar (fa-IR uses the Solar Hijri calendar). */
export const formatDateTime = (iso: string): string => dateTimeFormat.format(new Date(iso));

/*
 * zod's built-in messages ("Too big: expected …") follow the WordPress locale.
 * Import only the locales you ship — each one adds a few kB to the bundle.
 */
const zodLocales: Record<string, () => Parameters<typeof z.config>[0]> = { en, fa };
z.config((zodLocales[language] ?? en)());
