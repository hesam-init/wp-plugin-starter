# Small, predictable shell environment for project scripts (init, version bump).
# Running them here means GNU sed/grep behave the same on Linux, macOS and Windows.
ARG DOCKER_REGISTRY=
# buildpack-deps:*-curl = Debian + ca-certificates, so an https APT_MIRROR works.
FROM ${DOCKER_REGISTRY}buildpack-deps:trixie-curl

ARG APT_MIRROR=

RUN set -eux; \
    if [ -n "${APT_MIRROR}" ]; then \
      sed -i "s|http://deb.debian.org|${APT_MIRROR%/}|g" /etc/apt/sources.list.d/debian.sources; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends bash coreutils findutils grep sed jq; \
    rm -rf /var/lib/apt/lists/*
