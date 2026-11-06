# syntax=docker/dockerfile:1.7
#
# Reproducible release build. Produces dist/<slug>-<version>.zip on the host:
#
#   docker build -f docker/release/Dockerfile --target artifact \
#     --build-arg PLUGIN_SLUG=my-plugin --output type=local,dest=dist .
#
# (`make zip` wraps this.)

ARG NODE_VERSION=24

# ---- 1. Front-end assets -----------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS assets
WORKDIR /app/admin-client
COPY admin-client/package.json admin-client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY admin-client/ ./
# vite outputs to ../plugin/assets/dist
RUN mkdir -p /app/plugin/assets && npm run build

# ---- 2. Production PHP dependencies -------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY plugin/composer.json plugin/composer.lock* ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader
COPY plugin/src ./src
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative

# ---- 3. Assemble & zip ---------------------------------------------------------
FROM alpine:3.22 AS package
ARG PLUGIN_SLUG
RUN apk add --no-cache rsync zip
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
