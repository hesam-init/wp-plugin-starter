# PHP toolchain (Debian trixie): PHP CLI, Composer and WP-CLI.
# Used by the composer, i18n and wpcli services. PHP_VERSION should match the
# PHP of WP_IMAGE_TAG, so lint/analyse and WP-CLI run what the site runs.
# Registries/mirrors come from .env (see .env.example) as build args.
ARG DOCKER_REGISTRY=
ARG PHP_VERSION=8.3

# Only a source for the composer binary; the final image is Debian.
FROM ${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}composer:2 AS composer-bin

FROM ${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}php:${PHP_VERSION}-cli-trixie

ARG APT_MIRROR=
ARG COMPOSER_REGISTRY=
ARG WP_CLI_VERSION=2.12.0
ARG WP_CLI_URL=

ENV COMPOSER_HOME=/opt/composer \
    COMPOSER_CACHE_DIR=/tmp/composer-cache \
    WP_CLI_CACHE_DIR=/tmp/wp-cli-cache

# Debian packages (via APT_MIRROR) + the mysqli extension WordPress needs.
# mariadb-client provides mysqlcheck for `wp db check` (scripts/wp-setup.sh).
RUN set -eux; \
    if [ -n "${APT_MIRROR}" ]; then \
      sed -i "s|http://deb.debian.org|${APT_MIRROR%/}|g" /etc/apt/sources.list.d/debian.sources; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl git unzip less mariadb-client; \
    rm -rf /var/lib/apt/lists/*; \
    docker-php-ext-install -j"$(nproc)" mysqli; \
    echo 'memory_limit=512M' > "${PHP_INI_DIR}/conf.d/zz-cli.ini"

COPY --from=composer-bin /usr/bin/composer /usr/local/bin/composer

# WP-CLI phar (WP_CLI_URL can point at a mirror).
RUN set -eux; \
    curl -fsSL "${WP_CLI_URL:-https://github.com/wp-cli/wp-cli/releases/download/v${WP_CLI_VERSION}/wp-cli-${WP_CLI_VERSION}.phar}" -o /usr/local/bin/wp; \
    chmod +x /usr/local/bin/wp; \
    php /usr/local/bin/wp --info --allow-root > /dev/null

# Packagist mirror in the global Composer config, readable by any UID. The
# default packagist.org is disabled, so nothing silently bypasses the mirror.
RUN set -eux; \
    mkdir -p "${COMPOSER_HOME}" "${COMPOSER_CACHE_DIR}" "${WP_CLI_CACHE_DIR}"; \
    if [ -n "${COMPOSER_REGISTRY}" ]; then \
      composer config --global repos.packagist composer "${COMPOSER_REGISTRY}"; \
      composer config --global repos.packagist.org false; \
      case "${COMPOSER_REGISTRY}" in http://*) composer config --global secure-http false ;; esac; \
    fi; \
    chmod -R a+rwX "${COMPOSER_HOME}"; \
    chmod 1777 "${COMPOSER_CACHE_DIR}" "${WP_CLI_CACHE_DIR}"

WORKDIR /app
