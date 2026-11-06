# Node toolchain (Debian trixie): runs Vite, npm and scripts/i18n.mjs.
# Registries come from .env (see .env.example) and are baked in as build args.
ARG DOCKER_REGISTRY=
ARG NODE_VERSION=24
FROM ${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}node:${NODE_VERSION}-trixie-slim

ARG NPM_REGISTRY=

ENV npm_config_update_notifier=false \
    npm_config_fund=false

# Global npmrc (/usr/local/etc/npmrc), so it applies to whatever UID runs the
# container. package-lock "resolved" URLs on registry.npmjs.org are rewritten
# to this registry by npm (replace-registry-host defaults to "npmjs").
RUN set -eux; \
    if [ -n "${NPM_REGISTRY}" ]; then \
      npm config set registry "${NPM_REGISTRY}" --location=global; \
    fi

WORKDIR /app
