# Reproducible release build (Debian trixie stages). Produces
# dist/<slug>-<version>.zip on the host:
#
#   docker build -f docker/release/Dockerfile --target artifact \
#     --build-arg PLUGIN_SLUG=my-plugin --output type=local,dest=dist .
#
# (`make zip` wraps this and passes the registries/mirrors from .env.)

ARG DOCKER_REGISTRY=
ARG NODE_VERSION=24
ARG PHP_VERSION=8.3

FROM ${DOCKER_REGISTRY}composer:2 AS composer-bin

# ---- 1. Front-end assets -----------------------------------------------------
FROM ${DOCKER_REGISTRY}node:${NODE_VERSION}-trixie-slim AS assets
ARG NPM_REGISTRY=
RUN if [ -n "${NPM_REGISTRY}" ]; then npm config set registry "${NPM_REGISTRY}" --location=global; fi
WORKDIR /app/admin-client
COPY admin-client/package.json admin-client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY admin-client/ ./
# vite outputs to ../plugin/assets/dist
RUN mkdir -p /app/plugin/assets && npm run build

# ---- 2. Production PHP dependencies -------------------------------------------
FROM ${DOCKER_REGISTRY}php:${PHP_VERSION}-cli-trixie AS vendor
ARG APT_MIRROR=
ARG COMPOSER_REGISTRY=
RUN set -eux; \
    if [ -n "${APT_MIRROR}" ]; then \
      sed -i "s|http://deb.debian.org|${APT_MIRROR%/}|g" /etc/apt/sources.list.d/debian.sources; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates git unzip; \
    rm -rf /var/lib/apt/lists/*
COPY --from=composer-bin /usr/bin/composer /usr/local/bin/composer
RUN set -eux; \
    if [ -n "${COMPOSER_REGISTRY}" ]; then \
      composer config --global repos.packagist composer "${COMPOSER_REGISTRY}"; \
      composer config --global repos.packagist.org false; \
      case "${COMPOSER_REGISTRY}" in http://*) composer config --global secure-http false ;; esac; \
    fi
WORKDIR /app
COPY plugin/composer.json plugin/composer.lock* ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader
COPY plugin/src ./src
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative

# ---- 3. Assemble & zip ---------------------------------------------------------
# buildpack-deps:*-curl = Debian + ca-certificates, so an https APT_MIRROR works.
FROM ${DOCKER_REGISTRY}buildpack-deps:trixie-curl AS package
ARG APT_MIRROR=
ARG PLUGIN_SLUG
RUN set -eux; \
    if [ -n "${APT_MIRROR}" ]; then \
      sed -i "s|http://deb.debian.org|${APT_MIRROR%/}|g" /etc/apt/sources.list.d/debian.sources; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends rsync zip; \
    rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY plugin/ ./
COPY --from=assets /app/plugin/assets/dist ./assets/dist
COPY --from=vendor /app/vendor ./vendor
RUN set -eu; \
    test -n "${PLUGIN_SLUG}" || { echo "PLUGIN_SLUG build-arg is required" >&2; exit 1; }; \
    test -f "${PLUGIN_SLUG}.php" || { echo "Main file ${PLUGIN_SLUG}.php not found" >&2; exit 1; }; \
    VERSION="$(sed -n 's/^[[:space:]]*\*[[:space:]]*Version:[[:space:]]*//p' "${PLUGIN_SLUG}.php" | head -n1 | tr -d '[:space:]')"; \
    mkdir -p "/build/${PLUGIN_SLUG}" /out; \
    rsync -a --exclude-from=.distignore ./ "/build/${PLUGIN_SLUG}/"; \
    cd /build && zip -rq "/out/${PLUGIN_SLUG}-${VERSION}.zip" "${PLUGIN_SLUG}"; \
    echo "Built /out/${PLUGIN_SLUG}-${VERSION}.zip"

# ---- 4. Export only the zip ---------------------------------------------------
FROM scratch AS artifact
COPY --from=package /out/ /
