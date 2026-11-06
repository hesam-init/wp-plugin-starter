# WP Plugin Starter

A modern WordPress plugin starter: a **PHP plugin** that exposes a REST API, and a **React + TypeScript admin app** built with Vite. Development and releases both run in **Docker**, through one **Makefile**.

| Layer | Stack |
| --- | --- |
| Admin UI | React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query 5, `@wordpress/api-fetch`, zod 4, `@wordpress/components` |
| i18n | `@wordpress/i18n` + WordPress script translations, RTL; ships English + Persian (fa_IR) |
| Plugin | PHP 8.1+, PSR-4 (Composer), WordPress REST API, custom table via `dbDelta` |
| Tooling | Docker Compose, Make, ESLint, Prettier, PHPCS (WordPress Coding Standards), PHPStan, GitHub Actions |

---

## Quick start

Requirements: **Docker** (with Compose v2), **make** and **git**. You don't need Node, PHP or Composer on your machine.

```bash
git clone <this-repo> my-plugin && cd my-plugin
make init        # rename the starter (asks for the plugin name, slug, namespace…)
make dev         # starts MariaDB + WordPress + Vite (HMR), installs WP, activates the plugin
```

Then open **http://localhost:8080/wp-admin** and log in with `admin` / `admin`. Click the plugin's menu item. Edits under `admin-client/src` update in place through React Fast Refresh.

## Project layout

```
.
├── Makefile                  # the single entry point: `make help`
├── docker-compose.yml        # db, wordpress, node (vite) + on-demand: wpcli, i18n, composer, tools
├── docker/                   # every image is Debian 13 (trixie), registries/mirrors from .env
│   ├── node/Dockerfile       # Node + npm (Vite, i18n.mjs)
│   ├── php/Dockerfile        # PHP CLI + Composer + WP-CLI (composer, i18n, wpcli services)
│   ├── tools/Dockerfile      # bash/sed/jq image for the project scripts
│   └── release/Dockerfile    # multi-stage build → dist/<slug>-<version>.zip
├── scripts/
│   ├── init.sh               # rename wizard (make init)
│   ├── bump-version.sh       # semver bump everywhere (make bump / make release)
│   └── wp-setup.sh           # installs WordPress + activates the plugin (make setup)
├── starter.json              # current plugin identity (lets init re-run safely)
│
├── plugin/                   # ← the WordPress plugin (this folder is what ships)
│   ├── wp-plugin-starter.php # header, constants, autoloader, hooks
│   ├── uninstall.php         # opt-in data removal
│   ├── src/
│   │   ├── Plugin.php        # composition root — wires services & hooks
│   │   ├── Lifecycle.php     # activation / deactivation (multisite aware)
│   │   ├── Admin/            # menu page + asset enqueueing + boot config
│   │   ├── Database/         # Installer: versioned schema via dbDelta
│   │   ├── Items/            # ItemRepository: the only class that writes SQL
│   │   ├── Rest/             # controllers (extend WP_REST_Controller)
│   │   ├── Settings/         # schema-driven settings in one option
│   │   └── Support/Vite.php  # dev server (HMR) ↔ manifest bridge
│   ├── languages/            # .pot, <slug>-fa_IR.po (+ compiled .mo / .l10n.php / .json)
│   ├── assets/dist/          # Vite build output (git-ignored)
│   ├── composer.json, phpcs.xml.dist, phpstan.neon.dist, .distignore
│   └── readme.txt            # wordpress.org readme
│
└── admin-client/             # ← the React app (source only, never shipped)
    ├── vite.config.ts        # builds into ../plugin/assets/dist, writes the "hot" file
    ├── scripts/i18n.mjs      # extract TSX strings, .po → .json, add a language
    └── src/
        ├── main.tsx          # mounts into #<slug>-root
        ├── App.tsx           # tabs (state kept in the URL hash)
        ├── api/              # api-fetch client, zod schemas, typed endpoint functions
        ├── hooks/            # React Query hooks (useItems, useSettings…)
        ├── features/         # one folder per screen (items/, settings/, status/)
        ├── components/       # shared UI (notices, error/loading states)
        ├── lib/              # boot config (zod-validated), i18n helpers, query client & keys
        └── wp-globals/       # @wordpress/i18n + api-fetch → WordPress' wp.i18n / wp.apiFetch
```

The two halves only meet in two places:

1. **Boot data.** PHP prints `window.wpPluginStarter = {name, version, restNamespace, locale, …}` (`Admin/Assets.php`). The React app validates it with zod (`lib/config.ts`).
2. **The REST API.** The PHP JSON schemas are the source of truth (`Settings::schema()`, `ItemsController::get_item_schema()`). The zod schemas in `api/schemas.ts` mirror them and validate every response at runtime.

## Make targets

| Command | What it does |
| --- | --- |
| `make init` | Rename wizard. Non-interactive: `make init ARGS="--name 'Acme Forms' --author 'Acme' --yes"` |
| `make dev` | `install` + `up` + `setup`, then follows the Vite logs |
| `make up` / `make down` | Start / stop the stack (your data is kept) |
| `make setup` | Installs WordPress if needed and activates the plugin (idempotent) |
| `make wp CMD="…"` | WP-CLI, e.g. `make wp CMD="option get siteurl"` |
| `make npm CMD="…"` | npm in `admin-client`, e.g. `make npm CMD="i dayjs"` |
| `make composer CMD="…"` | Composer in `plugin/` |
| `make i18n` | Extract strings → update `.po` files → compile `.mo` / `.l10n.php` / `.json` |
| `make locale LOCALE=fa_IR` | Switch the admin user's language (`en_US` to go back) |
| `make lint` | ESLint + `tsc`, PHPCS (WPCS) + PHPStan |
| `make format` | Prettier/ESLint `--fix` + `phpcbf` |
| `make build` | Production assets into `plugin/assets/dist` |
| `make zip` | Reproducible release zip → `dist/<slug>-<version>.zip` |
| `make release BUMP=patch` | Bump version → build the zip → commit and tag `vX.Y.Z` |
| `make rebuild` | Force a rebuild of the local images, pulling fresh base images |
| `make nuke` | Stop everything and **delete** the DB and WordPress volumes |

## How development works

- **WordPress** runs at `:8080`, with `./plugin` bind-mounted into `wp-content/plugins/<slug>`. PHP changes apply on the next request.
- **Vite** runs in the `node` container at `:5173`. When it starts, it writes `plugin/assets/dist/hot` containing its URL, and it deletes that file on shutdown.
- **`Support/Vite.php`** checks for that file:
  - **If it exists**, PHP enqueues `@vite/client` and `src/main.tsx` from the dev server as ES modules. You get HMR and React Fast Refresh. The preamble is imported in `main.tsx`.
  - **Otherwise**, PHP reads `.vite/manifest.json` and enqueues the hashed files. It adds `<link rel="modulepreload">` for the shared chunks and collects their CSS.
- Assets are loaded only on the plugin's own admin screen (`load-{hook}`).
- Containers that write to the repo run with your UID/GID, so files stay owned by you.
- On macOS or Windows, if HMR misses changes, set `VITE_USE_POLLING=true` in `.env`.

## Docker images, registries and mirrors

All images are Debian 13 (trixie). `db` (`mariadb:11.4`, which has no Debian variant) and `wordpress:<WP_IMAGE_TAG>` are pulled as they are. The project builds three images of its own, one Dockerfile each:

| Image | Base | Used by |
| --- | --- | --- |
| `docker/node` | `node:<NODE_VERSION>-trixie-slim` | `node` (Vite, npm) |
| `docker/php` | `php:<PHP_VERSION>-cli-trixie` + Composer + WP-CLI | `composer`, `i18n`, `wpcli` |
| `docker/tools` | `buildpack-deps:trixie-curl` + bash/jq/sed | `tools` (init, version bump) |

Set these in `.env` and leave them empty for the public defaults:

| Variable | Effect |
| --- | --- |
| `DOCKER_REGISTRY` | Prefix for **every** image, including `db`, `wordpress` and the release stages. Include the trailing slash, e.g. `docker.arvancloud.ir/` |
| `APT_MIRROR` | Replaces `deb.debian.org` in every Debian image (it must also serve `/debian-security`) |
| `NPM_REGISTRY` | Global npm registry. Tarball URLs from `package-lock.json` are rewritten to it as well |
| `COMPOSER_REGISTRY` | Replaces Packagist in the global Composer config. `packagist.org` is disabled, so nothing bypasses the mirror |
| `WP_CLI_VERSION` / `WP_CLI_URL` | WP-CLI release. `WP_CLI_URL` overrides the GitHub download URL |

They are baked into the images as build args, and `make zip` passes them to the release build. **You don't need to rebuild by hand.** The Makefile keeps a stamp in `.cache/` named after a checksum of these values and the Dockerfiles, so the next `make …` command after a change rebuilds the images once. `make rebuild` forces a fresh build.

`composer.lock` stores the download URL of each package. A lock created against one registry keeps those URLs, so run `make composer CMD="update"` after switching registries if downloads still go to the old host. Note that mirrors can lag behind. If Composer can't resolve a recent version, the mirror may be stale.

## REST API

All routes live under `/wp-json/<slug>/v1` and require the `manage_options` capability. You can change that with the `wp_plugin_starter_capability` filter.

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/settings` | |
| `POST`/`PATCH` | `/settings` | Partial update. Validated and sanitized from the schema |
| `GET` | `/items` | `page`, `per_page`, `search`, `status`, `orderby`, `order`. Sends `X-WP-Total` / `X-WP-TotalPages` |
| `POST` | `/items` | `title` (required), `content` (passed through `wp_kses_post`), `status` |
| `GET` / `PATCH` / `DELETE` | `/items/{id}` | Returns `404` if the item doesn't exist |

Practices this code demonstrates:

- **Controllers extend `WP_REST_Controller`.**
  - Request `args` come from the item schema, so WordPress validates and sanitizes input for you.
  - Responses go through `prepare_item_for_response()`, with context filtering and `_links`.
- **Every route has a `permission_callback`.**
- **Requests go through WordPress' own `wp.apiFetch`** (`@wordpress/api-fetch`). WordPress has already configured it, so:
  - the REST root URL and the `X-WP-Nonce` header are set for you (the app never sees a nonce);
  - `_locale=user` is added, so server error messages come back in the user's language;
  - `PUT`/`PATCH`/`DELETE` are sent as `POST` with `X-HTTP-Method-Override` for hosts that block those verbs.
- **Every call is validated.** `api/client.ts` requests with `parse: false` (to read `X-WP-Total` headers), validates the JSON body with zod and turns WP errors into an `ApiError`. When the nonce expires (`rest_cookie_invalid_nonce`), it fetches a new one from `apiFetch.nonceEndpoint` once and retries.
- **The repository keeps SQL in one class.** It uses `$wpdb->prepare()` everywhere, including `%i` for identifiers, an allow-list for `ORDER BY`, and an object cache for single rows.
- **The schema is versioned.** Raise `Installer::DB_VERSION` and `dbDelta` migrates the table on the next request.
- **Each submenu page mounts the same app.** `Admin/AdminPage.php` registers *Dashboard* (Items/Settings tabs) and *Status* and passes the current screen to React as `screen` in the boot data. `App.tsx` switches on `config.screen`. The Status page reads `GET /status` (`Status/StatusReport.php`), a read-only report of plugin, WordPress, PHP/server and database details, and can copy it as plain text for support requests.
- **Uninstall is opt-in.** Data is removed only when the user enabled "Delete data on uninstall", and multisite is supported.

### Adding an endpoint

1. Create `plugin/src/Rest/FooController.php` extending `AbstractController`. Implement `register_routes()` and `get_item_schema()`.
2. Register it in `Plugin::register()`: `new RestApi( …, new FooController( $repo ) )`.
3. Mirror the schema with zod in `admin-client/src/api/schemas.ts`.
4. Add `api/foo.ts` that calls `request(schema, …)`.
5. Add hooks in `hooks/useFoo.ts`, using keys from `lib/query-client.ts`.

## Front-end conventions

- **Tailwind uses a `tw:` prefix**, for example `tw:flex tw:gap-4 tw:md:grid-cols-2`. WordPress already defines `.fixed`, `.hidden` and `.sticky` with different meanings: an unprefixed `fixed` turned `table.wp-list-table.fixed` into `position: fixed`.
  - Preflight is disabled, so wp-admin isn't restyled.
  - Utilities are `!important`, so they beat wp-admin's unlayered CSS.
  - `tw:bg-wp` / `tw:text-wp` follow the user's admin color scheme.
- **Use `@wordpress/components` for controls.** Use core classes (`wp-list-table widefat striped`) for a native look. Use Tailwind for layout.
- **Server state lives in React Query, never in `useState`.** Forms validate with zod before submitting. Server errors from `rest_invalid_param` come back as `ApiError.fieldErrors`, so they show under the right field.
- **React and `@wordpress/components` are bundled**, not taken from WordPress's `wp.element` / `wp.components` globals. This gives you HMR, React 19 and a component version you control, at the cost of a bigger first load: about 245 kB gzipped, in a separate `vendor` chunk that stays cached between releases.
- **`@wordpress/i18n` and `@wordpress/api-fetch` are *not* bundled.** Vite aliases them to `wp.i18n` / `wp.apiFetch` (`src/wp-globals/`), including inside the bundled `@wordpress/components`. That is what lets WordPress inject translations and its API configuration. The npm packages are installed only for their types.

## Translations (i18n)

English is the source language; a complete **Persian (fa_IR)** translation ships as the example. To see it, run `make locale LOCALE=fa_IR` (or pick فارسی under Users → Profile → Language). `make setup` installs the core fa_IR language pack; add more with `WP_LANGUAGES` in `.env`.

**Writing translatable code**

- PHP: `__( 'Text', 'wp-plugin-starter' )`, `esc_html__()`, `_n()`, `_x()`… with a `/* translators: */` comment above any string with placeholders.
- React: the same functions from `@wordpress/i18n`, always with the text domain:

  ```tsx
  import { __, _n, sprintf } from '@wordpress/i18n';

  __('Add item', 'wp-plugin-starter');
  sprintf(
    /* translators: %s: number of items. */
    _n('%s item', '%s items', total, 'wp-plugin-starter'),
    formatNumber(total),
  );
  ```

- Numbers and dates: use `formatNumber()` / `formatDateTime()` from `lib/i18n.ts`. They follow the WordPress locale, so Persian gets Persian digits and the Solar Hijri calendar.
- Layout: use direction-agnostic Tailwind utilities (`tw:ms-*`, `tw:pe-*`, `tw:start-*`, `tw:text-end`…). WordPress sets `<html dir="rtl">` for RTL languages, and the app loads the RTL stylesheet of `@wordpress/components` automatically.
- Validation: zod's built-in messages follow the locale too (`lib/i18n.ts` registers `en` and `fa`; add others there).

**Workflow**

```bash
make i18n                     # = i18n-pot + i18n-update + i18n-compile
make i18n-add LOCALE=de_DE    # start a new language from the .pot
```

| Step | Tool | Output in `plugin/languages/` |
| --- | --- | --- |
| `i18n-pot` | `scripts/i18n.mjs extract` (TypeScript parser, since WP-CLI can't read TSX) merged into `wp i18n make-pot` (PHP) | `<slug>.pot` |
| `i18n-update` | `wp i18n update-po` | new strings added to every `.po` |
| *you* | Poedit, Loco, any PO editor | translated `<slug>-<locale>.po` |
| `i18n-compile` | `wp i18n make-mo` + `make-php`, `scripts/i18n.mjs json` | `.mo`, `.l10n.php` (fast PHP format, WP 6.5+), `<slug>-<locale>-<slug>-admin.json` |

How the translations reach the app:

- **PHP:** `load_plugin_textdomain()` on `init`.
- **React:** `wp_set_script_translations()` prints the `.json` into `wp.i18n` before the app runs. The file is named after the *script handle*, which WordPress looks up first, so Vite's hashed file names don't matter.
- **Core strings:** `@wordpress/components`' own strings (Close, Search…) come from core's language pack. They are borrowed from the registered `wp-components` script (`Admin/Assets.php`), without loading that script.

The compiled files are committed, so translations work right after cloning. `make init` renames them and recompiles.

## Releasing

```bash
# 1. Write notes under "## [Unreleased]" in CHANGELOG.md, commit.
make release BUMP=patch          # or minor | major | 1.4.0 | 2.0.0-beta.1
git push --follow-tags           # the Release workflow attaches the zip to a GitHub Release
```

`scripts/bump-version.sh` updates the plugin header, the `*_VERSION` constant, the `readme.txt` stable tag, `package.json`/`package-lock.json` and `CHANGELOG.md`. It also copies the Unreleased bullet points into the `readme.txt` changelog.

`docker/release/Dockerfile` builds the zip in clean stages:

1. `npm ci && vite build`
2. `composer install --no-dev --classmap-authoritative`
3. `rsync --exclude-from=.distignore` → `zip`

So a local `make zip` and CI produce the same artifact. Use `NO_GIT=1` to skip the commit and tag.

## Starting a new plugin from this starter

`make init` asks for the name and derives everything else (you can override each value). It then:

- replaces every identifier in every text file (including `.po`/`.pot`): name, slug/text domain/REST namespace, PHP namespace, `snake_case` prefix, `CONSTANT_PREFIX`, JS global, author, URIs and Composer vendor;
- renames the main plugin file and the translation files, then recompiles the translations;
- resets the version to `0.1.0` and starts a fresh changelog.

Replacements go through unique placeholder tokens, so one rename can't corrupt another. The current identity is saved in `starter.json`, so you can run `make init` again later.

Afterwards, run `rm -rf .git && git init` for a clean history, and `make nuke` if the old stack was running.

## Notes

- Commit `plugin/composer.lock` after your first `make install` (it's created then).
- On Windows, use WSL 2 and keep the repo inside the Linux filesystem for fast file watching.
- To use a different host or port for WordPress or Vite, edit `.env`. `VITE_DEV_SERVER_URL` must be the URL **your browser** uses to reach Vite.
