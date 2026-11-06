# WordPress-provided packages

Vite aliases these imports to the globals WordPress already loads:

| Import                 | Runtime global | Script handle (PHP dependency) |
| ---------------------- | -------------- | ------------------------------ |
| `@wordpress/i18n`      | `wp.i18n`      | `wp-i18n`                      |
| `@wordpress/api-fetch` | `wp.apiFetch`  | `wp-api-fetch`                 |

Why use the globals instead of bundling these packages:

- **`wp.i18n`** receives the translations that `wp_set_script_translations()` prints,
  plus core's RTL flag, so `__()` and `isRTL()` work out of the box. The bundled
  `@wordpress/components` uses it too, so its built-in strings get translated.
- **`wp.apiFetch`** comes preconfigured with the REST root URL, the `wp_rest` nonce
  (including refresh), the user-locale middleware and HTTP method override.

The npm packages are installed only for their TypeScript types. To externalize
another `@wordpress/*` package, add a shim here, an alias in `vite.config.ts` and
the handle in `Admin/Assets.php`.
