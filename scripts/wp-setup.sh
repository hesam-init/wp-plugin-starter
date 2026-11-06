#!/bin/sh
# Installs WordPress (first run only) and activates the plugin.
# Runs inside the `wpcli` container: `make setup`.
set -eu

cd /var/www/html

# The wordpress container writes wp-config.php on first boot.
i=0
until [ -f wp-config.php ]; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "✗ Timed out waiting for WordPress files. Is the wordpress container running? (make up)" >&2
    exit 1
  fi
  sleep 1
done

# The database may still be warming up right after `docker compose up`.
i=0
until wp db check >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "✗ Cannot reach the database." >&2
    exit 1
  fi
  sleep 1
done

if ! wp core is-installed >/dev/null 2>&1; then
  echo "→ Installing WordPress at ${WP_URL}"
  wp core install \
    --url="${WP_URL}" \
    --title="${WP_TITLE}" \
    --admin_user="${WP_ADMIN_USER}" \
    --admin_password="${WP_ADMIN_PASSWORD}" \
    --admin_email="${WP_ADMIN_EMAIL}" \
    --skip-email
  wp rewrite structure '/%postname%/' --quiet
  wp plugin delete hello akismet --quiet >/dev/null 2>&1 || true
else
  echo "✓ WordPress already installed"
fi

# Language packs, so users can pick them under Users → Profile → Language
# (or run `make locale LOCALE=fa_IR`). Needs internet; failures are not fatal.
for lang in ${WP_LANGUAGES:-}; do
  wp language core is-installed "$lang" >/dev/null 2>&1 \
    || wp language core install "$lang" --quiet \
    || echo "! Could not install language pack $lang (offline?)"
done

if wp plugin is-active "${PLUGIN_SLUG}" >/dev/null 2>&1; then
  echo "✓ Plugin ${PLUGIN_SLUG} is active"
else
  wp plugin activate "${PLUGIN_SLUG}"
fi
