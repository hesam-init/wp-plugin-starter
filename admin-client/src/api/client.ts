import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { z } from 'zod';
import { config } from '@/lib/config';

/*
 * Thin layer over WordPress' own `wp.apiFetch` (see src/wp-globals). WordPress
 * already configured it with the REST root URL, the X-WP-Nonce header,
 * `_locale=user` (so server errors come back in the user's language) and
 * PUT/PATCH/DELETE → POST + X-HTTP-Method-Override for strict hosts.
 */

/** Normalised error thrown by every API call. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Per-field messages from WP schema validation (`rest_invalid_param`). */
  readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const WpErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  data: z
    .object({
      status: z.number().optional(),
      // rest_invalid_param → { field: message }; rest_missing_callback_param → [field]
      params: z.union([z.record(z.string(), z.string()), z.array(z.string())]).optional(),
    })
    .nullish(),
});

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  /** Path relative to this plugin's namespace, e.g. `items/12`. */
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  data?: unknown;
}

/** `/wp-plugin-starter/v1/items?page=2` — empty query values are dropped. */
function buildPath(path: string, query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `/${config.restNamespace}/${path}${qs ? `?${qs}` : ''}`;
}

async function toApiError(error: unknown): Promise<ApiError> {
  // With `parse: false`, apiFetch rejects with the raw Response for HTTP errors…
  const body = error instanceof Response ? await error.json().catch(() => null) : error;
  const status = error instanceof Response ? error.status : 0;
  // …and with { code, message } for network failures ("You are probably offline.").
  const parsed = WpErrorSchema.safeParse(body);

  if (!parsed.success) {
    return new ApiError(__('Something went wrong.', 'wp-plugin-starter'), status, 'unknown_error');
  }

  const params = parsed.data.data?.params ?? {};
  const fields = Array.isArray(params)
    ? Object.fromEntries(params.map((f) => [f, __('This field is required.', 'wp-plugin-starter')]))
    : params;

  return new ApiError(
    parsed.data.message,
    parsed.data.data?.status ?? status,
    parsed.data.code,
    fields,
  );
}

/** apiFetch only refreshes an expired nonce when parsing; do the same for raw responses. */
async function refreshNonce(): Promise<boolean> {
  if (!apiFetch.nonceEndpoint || !apiFetch.nonceMiddleware) return false;
  const response = await window.fetch(apiFetch.nonceEndpoint);
  if (!response.ok) return false;
  apiFetch.nonceMiddleware.nonce = await response.text();
  return true;
}

/**
 * Perform a request and validate the JSON body with zod, so the rest of the
 * app can trust the types at runtime too. Headers are returned for pagination.
 */
export async function request<S extends z.ZodType>(
  schema: S,
  { path, method = 'GET', query, data }: RequestOptions,
  retried = false,
): Promise<{ data: z.output<S>; headers: Headers }> {
  let response: Response;
  try {
    response = await apiFetch<Response, false>({
      path: buildPath(path, query),
      method,
      data,
      parse: false,
    });
  } catch (error) {
    const apiError = await toApiError(error);
    if (apiError.code === 'rest_cookie_invalid_nonce' && !retried && (await refreshNonce())) {
      return request(schema, { path, method, query, data }, true);
    }
    throw apiError;
  }

  const result = schema.safeParse(await response.json().catch(() => undefined));
  if (!result.success) {
    console.error('[wp-plugin-starter] Unexpected API response', path, result.error.issues);
    throw new ApiError(
      __('Unexpected response from the server.', 'wp-plugin-starter'),
      response.status,
      'invalid_response',
    );
  }

  return { data: result.data, headers: response.headers };
}
