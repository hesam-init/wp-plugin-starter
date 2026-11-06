# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A WordPress plugin starter: a PHP plugin (`plugin/`, the folder that ships) exposing a REST API, plus a React 19 + TypeScript + Vite admin app (`admin-client/`, source only, built into `plugin/assets/dist`). `README.md` is detailed and authoritative. Read it before larger changes.

## Commands

Every task runs in Docker through the Makefile, so Node, PHP and Composer are not needed on the host. Run `make` to list the targets.

```bash
make dev                 # install deps, start db + wordpress (:8080) + vite (:5173), install WP, activate plugin
make up / make down      # start / stop the stack (data kept)
make lint                # = lint-js (eslint + tsc) + lint-php (phpcs WPCS + phpstan level 6)
make lint-js | lint-php  # run one half
make format              # prettier + eslint --fix, phpcbf
make build               # production assets → plugin/assets/dist
make i18n                # extract strings (PHP + TSX) → update .po → compile .mo/.l10n.php/.json
make wp CMD="…"          # WP-CLI;  make npm CMD="…" (in admin-client);  make composer CMD="…" (in plugin/)
make zip                 # reproducible release zip → dist/<slug>-<version>.zip
make release BUMP=patch  # bump version everywhere, zip, commit + tag (needs a clean tree; NO_GIT=1 to skip git)
```

**Docker.** Every image is Debian trixie, with one Dockerfile per job: `docker/node`, `docker/php` (PHP CLI + Composer + WP-CLI for the `composer`/`i18n`/`wpcli` services), `docker/tools` and `docker/release`. `DOCKER_REGISTRY`, `APT_MIRROR`, `NPM_REGISTRY`, `COMPOSER_REGISTRY` and `WP_CLI_*` in `.env` are baked in as build args, and the Makefile rebuilds the images automatically when they change (checksum stamp in `.cache/`, order-only prerequisite `| $(IMAGES)` on every target that starts a container). Don't set `COMPOSER_HOME` in compose, because the mirror config lives in the image's `/opt/composer`. Keep the four Dockerfiles in sync when changing how a mirror is applied.

CI (`.github/workflows/ci.yml`) runs the same checks natively: `npm run lint && npm run typecheck && npm run build` in `admin-client/`, and `composer run lint && composer run analyse` in `plugin/`.

The repo has no automated test suite (no PHPUnit, no Vitest). Lint, typecheck and PHPStan are the checks.

## Architecture

**PHP (`plugin/`, namespace `WpPluginStarter\`, PSR-4 from `src/`).** `wp-plugin-starter.php` defines the constants and autoloader (it falls back to a hand-written PSR-4 loader when `vendor/` is missing) and boots `Plugin::boot()` on `plugins_loaded`. `Plugin::register()` is the composition root: services are built and injected there by hand, with no container. REST controllers extend `Rest/AbstractController` (namespace `wp-plugin-starter/v1`, permission = `Plugin::capability()`, filterable) and are registered by passing them to `new RestApi(...)`. `Items/ItemRepository` is the only class that touches SQL. The custom table schema lives in `Database/Installer`. Raise `Installer::DB_VERSION` to get a `dbDelta` migration on the next request.

**The two halves meet only in two places.** Changes there must be made on both sides:
1. **Boot data.** `Admin/Assets.php` prints `window.wpPluginStarter = {…}`, and `admin-client/src/lib/config.ts` validates it with zod.
2. **REST schemas.** The PHP JSON schemas are the source of truth (`Settings::schema()`, `ItemsController::get_item_schema()`). They drive WP's request validation and sanitization. `admin-client/src/api/schemas.ts` mirrors them in zod, and `api/client.ts` validates every response at runtime. If you change a PHP schema without updating the zod mirror, the UI breaks at runtime.

**Asset loading (`Support/Vite.php`).** While `vite` runs, it writes `plugin/assets/dist/hot` holding the dev-server URL, and PHP then enqueues from the dev server with HMR. Without that file, PHP reads `.vite/manifest.json`. If PHP keeps loading from a dead dev server, a stale `hot` file is the usual cause (`make down` removes it). Assets are only enqueued on the plugin's own admin screen.

**Frontend data flow.** `api/*.ts` calls `request(schema, {path, …})` from `api/client.ts`. That function wraps `wp.apiFetch` with `parse: false`, so it can read the `X-WP-Total` headers, retries once on an expired nonce, and turns WP errors into `ApiError`, with `fieldErrors` taken from `rest_invalid_param`. Hooks in `hooks/` wrap these calls in React Query, using keys from the `queryKeys` factory in `lib/query-client.ts`. Server state lives only in React Query. Screens live in `features/<name>/`. The `@/` alias maps to `src/`. The README has a step-by-step checklist for adding an endpoint.

## Conventions and gotchas

- **`@wordpress/i18n` and `@wordpress/api-fetch` are not bundled.** Vite aliases them to the `wp.i18n` / `wp.apiFetch` globals through `src/wp-globals/`, and the npm packages are installed only for their types. React and `@wordpress/components` *are* bundled, so don't use `wp.element` / `wp.components`. To externalize another `@wordpress/*` package, add a shim in `wp-globals/`, an alias in `vite.config.ts`, and the script handle dependency in `Admin/Assets.php`.
- **Tailwind classes need the `tw:` prefix** (`tw:flex`, `tw:md:grid-cols-2`). Unprefixed utilities collide with wp-admin classes such as `.fixed` and `.hidden`. Preflight is off and utilities are `!important`. Prefer logical/RTL-safe utilities (`tw:ms-*`, `tw:pe-*`, `tw:text-end`), because the app ships an RTL locale (fa_IR). Controls come from `@wordpress/components`, and tables use core classes (`wp-list-table widefat striped`).
- **i18n.** Always pass the literal text domain `'wp-plugin-starter'` (PHPCS enforces it in PHP) and add a `/* translators: */` comment above any string with placeholders. Format numbers and dates with `formatNumber()` / `formatDateTime()` from `lib/i18n.ts`. The compiled translation files in `plugin/languages/` are committed, so run `make i18n` after changing user-facing strings.
- **Identifiers are rewritten by `make init`.** `scripts/init.sh` text-replaces the name, slug, `WpPluginStarter` namespace, `wp_plugin_starter` prefix, `WP_PLUGIN_STARTER` constants and the `wpPluginStarter` JS global across all files, and the current identity is recorded in `starter.json`. Write these identifiers as literals in their existing forms rather than building them dynamically. PHPCS also requires every global to carry one of these prefixes.
- **Versioning.** Don't edit version numbers by hand. `scripts/bump-version.sh` (`make bump` / `make release`) keeps the plugin header, the `WP_PLUGIN_STARTER_VERSION` constant, `readme.txt`, `package.json`/lock and `CHANGELOG.md` in sync. Release notes go under `## [Unreleased]` in `CHANGELOG.md`.
- **PHP style.** WordPress Coding Standards (tabs, `array()`, Yoda conditions, spaces inside parentheses) with `declare( strict_types=1 );`, PSR-4 file names, and PHP 8.1 compatibility. Runtime files start with `defined( 'ABSPATH' ) || exit;` (`uninstall.php` checks `WP_UNINSTALL_PLUGIN` instead). Use `$wpdb->prepare()` everywhere (`%i` for identifiers) and an allow-list for `ORDER BY`.
