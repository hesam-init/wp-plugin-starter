# =============================================================================
#  WP Plugin Starter — every task runs inside Docker.  `make` lists targets.
# =============================================================================
SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

# Bootstrap .env on first run, then read project settings from it.
ifeq (,$(wildcard .env))
$(shell cp .env.example .env)
endif
include .env

PLUGIN_SLUG       ?= wp-plugin-starter
NODE_VERSION      ?= 24
PHP_VERSION       ?= 8.3
WP_CLI_VERSION    ?= 2.12.0
WP_URL            ?= http://localhost:8080
DOCKER_REGISTRY   ?=
APT_MIRROR        ?=
NPM_REGISTRY      ?=
COMPOSER_REGISTRY ?=
WP_CLI_URL        ?=

# Containers that write into the repo run as you, so files stay yours.
export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

COMPOSE   := docker compose
NODE      := $(COMPOSE) run --rm --no-deps node
COMPOSER  := $(COMPOSE) run --rm --no-deps composer
WPCLI     := $(COMPOSE) run --rm wpcli
I18N      := $(COMPOSE) run --rm --no-deps i18n
LANG_DIR  := plugin/languages
JS_HANDLE := $(PLUGIN_SLUG)-admin
TOOLS     := $(COMPOSE) run --rm --no-deps tools
MAIN_FILE := plugin/$(PLUGIN_SLUG).php
VERSION    = $(shell sed -n 's/^[[:space:]]*\*[[:space:]]*Version:[[:space:]]*//p' $(MAIN_FILE) | head -n1 | tr -d '[:space:]')

# Local images (docker/{node,php,tools}) are rebuilt automatically whenever a
# registry/mirror/version in .env or one of their Dockerfiles changes: the stamp
# file name is a checksum of those inputs. Every target that starts a container
# has it as an order-only prerequisite.
IMAGE_VARS  := DOCKER_REGISTRY APT_MIRROR NPM_REGISTRY COMPOSER_REGISTRY NODE_VERSION PHP_VERSION WP_CLI_VERSION WP_CLI_URL
IMAGE_FILES := docker-compose.yml docker/node/Dockerfile docker/php/Dockerfile docker/tools/Dockerfile
IMAGES_KEY  := $(shell { $(foreach v,$(IMAGE_VARS),printf '%s=%s\n' '$(v)' '$($(v))';) cat $(IMAGE_FILES); } | cksum | cut -d' ' -f1)
IMAGES      := .cache/images-$(IMAGES_KEY)

##@ Project
.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m\n"} \
	/^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2 } \
	/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

.PHONY: init
init: | $(IMAGES) ## Rename this starter into your plugin (wizard; ARGS="--name ... --yes")
	@$(TOOLS) bash scripts/init.sh $(ARGS)
	@$(MAKE) --no-print-directory i18n-compile

.PHONY: install
install: plugin/vendor admin-client/node_modules ## Install PHP + JS dependencies

plugin/vendor: plugin/composer.json | $(IMAGES)
	$(COMPOSER) install --no-interaction
	@touch $@

admin-client/node_modules: admin-client/package.json | $(IMAGES)
	$(NODE) npm ci --no-audit --no-fund
	@touch $@

$(IMAGES):
	@mkdir -p .cache && rm -f .cache/images-*
	$(COMPOSE) --profile tools build
	@touch $@

.PHONY: rebuild
rebuild: ## Force a rebuild of the local images, pulling fresh base images
	@mkdir -p .cache && rm -f .cache/images-*
	$(COMPOSE) --profile tools build --pull
	@touch $(IMAGES)

##@ Development
.PHONY: dev
dev: install up setup ## Start the full stack, install WP, follow Vite logs
	@echo ""
	@echo "  WordPress admin:  $(WP_URL)/wp-admin   ($(WP_ADMIN_USER) / $(WP_ADMIN_PASSWORD))"
	@echo "  Plugin page:      $(WP_URL)/wp-admin/admin.php?page=$(PLUGIN_SLUG)"
	@echo ""
	@$(COMPOSE) logs -f node

.PHONY: up
up: | $(IMAGES) ## Start db, wordpress and the Vite dev server in the background
	$(COMPOSE) up -d --wait db wordpress
	$(COMPOSE) up -d node

.PHONY: setup
setup: | $(IMAGES) ## Install WordPress (idempotent) and activate the plugin
	@$(WPCLI) sh /scripts/wp-setup.sh

.PHONY: down
down: ## Stop containers (keeps data)
	$(COMPOSE) down
	@rm -f plugin/assets/dist/hot

.PHONY: restart
restart: down up ## Restart the stack

.PHONY: logs
logs: ## Follow logs of all services
	$(COMPOSE) logs -f

.PHONY: ps
ps: ## List running services
	$(COMPOSE) ps

##@ Helpers  (pass arguments with CMD="...")
.PHONY: wp
wp: | $(IMAGES) ## Run WP-CLI, e.g. make wp CMD="plugin list"
	@$(WPCLI) wp $(CMD)

.PHONY: npm
npm: | $(IMAGES) ## Run npm in admin-client, e.g. make npm CMD="i dayjs"
	@$(NODE) npm $(CMD)

.PHONY: composer
composer: | $(IMAGES) ## Run composer in plugin/, e.g. make composer CMD="require foo/bar"
	@$(COMPOSER) $(CMD)

.PHONY: shell
shell: ## Open a shell in the WordPress container
	$(COMPOSE) exec wordpress bash

##@ Translations  (sources: plugin/languages/*.po — edit them with Poedit or any PO editor)
.PHONY: i18n
i18n: i18n-pot i18n-update i18n-compile ## Extract strings, update every .po, compile everything

.PHONY: i18n-pot
i18n-pot: admin-client/node_modules | $(IMAGES) ## Regenerate the .pot from PHP + React (TS/TSX) sources
	@$(NODE) node scripts/i18n.mjs extract --domain $(PLUGIN_SLUG) --out ../$(LANG_DIR)/.js-strings.pot
	@$(I18N) i18n make-pot plugin $(LANG_DIR)/$(PLUGIN_SLUG).pot \
		--domain=$(PLUGIN_SLUG) --exclude=assets,vendor,languages --skip-js \
		--merge=$(LANG_DIR)/.js-strings.pot --headers='{"Report-Msgid-Bugs-To":""}'
	@rm -f $(LANG_DIR)/.js-strings.pot

.PHONY: i18n-update
i18n-update: | $(IMAGES) ## Merge new/changed strings from the .pot into every .po
	@$(I18N) i18n update-po $(LANG_DIR)/$(PLUGIN_SLUG).pot $(LANG_DIR)

.PHONY: i18n-compile
i18n-compile: admin-client/node_modules | $(IMAGES) ## Compile .po → .mo + .l10n.php (PHP) and .json (React)
	@$(I18N) i18n make-mo $(LANG_DIR)
	@$(I18N) i18n make-php $(LANG_DIR)
	@$(NODE) node scripts/i18n.mjs json --domain $(PLUGIN_SLUG) --handle $(JS_HANDLE) --dir ../$(LANG_DIR)

.PHONY: i18n-add
i18n-add: admin-client/node_modules | $(IMAGES) ## Start a new language: make i18n-add LOCALE=de_DE
	@[ -n "$(LOCALE)" ] || { echo "Usage: make i18n-add LOCALE=de_DE"; exit 1; }
	@$(NODE) node scripts/i18n.mjs add --domain $(PLUGIN_SLUG) --locale $(LOCALE) --dir ../$(LANG_DIR)

.PHONY: locale
locale: | $(IMAGES) ## Switch the admin user's language: make locale LOCALE=fa_IR (en_US to reset)
	@[ -n "$(LOCALE)" ] || { echo "Usage: make locale LOCALE=fa_IR"; exit 1; }
	@if [ "$(LOCALE)" != "en_US" ]; then $(WPCLI) wp language core install $(LOCALE); fi
	@$(WPCLI) wp user update $(WP_ADMIN_USER) --locale=$(LOCALE)

##@ Quality
.PHONY: lint
lint: lint-js lint-php ## Run all linters and type checks

.PHONY: lint-js
lint-js: admin-client/node_modules | $(IMAGES) ## ESLint + TypeScript type check
	$(NODE) sh -c "npm run lint && npm run typecheck"

.PHONY: lint-php
lint-php: plugin/vendor | $(IMAGES) ## PHPCS (WordPress standards) + PHPStan
	$(COMPOSER) run lint
	$(COMPOSER) run analyse

.PHONY: format
format: install | $(IMAGES) ## Auto-fix JS (prettier/eslint) and PHP (phpcbf)
	$(NODE) npm run format
	-$(COMPOSER) run fix

##@ Build & release
.PHONY: build
build: admin-client/node_modules | $(IMAGES) ## Build production assets into plugin/assets/dist
	$(NODE) npm run build

.PHONY: version
version: ## Print the current plugin version
	@echo $(VERSION)

.PHONY: bump
bump: | $(IMAGES) ## Bump version only: make bump BUMP=patch|minor|major|1.2.3
	@[ -n "$(BUMP)" ] || { echo "Usage: make bump BUMP=patch|minor|major|x.y.z"; exit 1; }
	@$(TOOLS) bash scripts/bump-version.sh $(BUMP)

.PHONY: zip
zip: ## Build the distributable zip (current version) into dist/
	DOCKER_BUILDKIT=1 docker build \
		-f docker/release/Dockerfile --target artifact \
		--build-arg PLUGIN_SLUG=$(PLUGIN_SLUG) \
		--build-arg NODE_VERSION=$(NODE_VERSION) \
		--build-arg PHP_VERSION=$(PHP_VERSION) \
		--build-arg DOCKER_REGISTRY=$(DOCKER_REGISTRY) \
		--build-arg APT_MIRROR=$(APT_MIRROR) \
		--build-arg NPM_REGISTRY=$(NPM_REGISTRY) \
		--build-arg COMPOSER_REGISTRY=$(COMPOSER_REGISTRY) \
		--output type=local,dest=dist .
	@echo "→ dist/$(PLUGIN_SLUG)-$(VERSION).zip"

.PHONY: release
release: | $(IMAGES) ## Bump, build zip, commit & tag: make release BUMP=patch [NO_GIT=1]
	@[ -n "$(BUMP)" ] || { echo "Usage: make release BUMP=patch|minor|major|x.y.z [NO_GIT=1]"; exit 1; }
	@if [ -z "$(NO_GIT)" ] && git rev-parse --git-dir >/dev/null 2>&1 && [ -n "$$(git status --porcelain)" ]; then \
		echo "✗ Working tree is dirty. Commit or stash first (or pass NO_GIT=1)."; exit 1; fi
	@$(TOOLS) bash scripts/bump-version.sh $(BUMP)
	@$(MAKE) --no-print-directory zip
	@V="$$(sed -n 's/^[[:space:]]*\*[[:space:]]*Version:[[:space:]]*//p' $(MAIN_FILE) | head -n1 | tr -d '[:space:]')"; \
	if [ -z "$(NO_GIT)" ] && git rev-parse --git-dir >/dev/null 2>&1; then \
		git add -A && git commit -q -m "chore(release): v$$V" && git tag -a "v$$V" -m "Release v$$V"; \
		echo "✓ Committed and tagged v$$V — publish with: git push --follow-tags"; \
	fi; \
	echo "✓ Release artifact: dist/$(PLUGIN_SLUG)-$$V.zip"

##@ Cleanup
.PHONY: clean
clean: ## Remove build output (dist/, plugin/assets/dist)
	rm -rf dist
	find plugin/assets/dist -mindepth 1 ! -name .gitkeep -delete 2>/dev/null || true

.PHONY: nuke
nuke: ## Stop everything and DELETE database + WordPress volumes
	$(COMPOSE) --profile tools down -v --remove-orphans
	@rm -f plugin/assets/dist/hot
