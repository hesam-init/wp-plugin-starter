#!/usr/bin/env bash
# Rename this starter into a new plugin.
#
# Interactive:      make init
# Non-interactive:  make init ARGS="--name 'Acme Forms' --author 'Acme Inc' --yes"
#
# The current identity lives in starter.json, so init can be re-run at any time
# (e.g. to rename again). Every occurrence of each identifier is replaced in all
# text files, the main plugin file is renamed, and the version is reset to 0.1.0.
set -euo pipefail

cd "$(dirname "$0")/.."

STATE="starter.json"
[[ -f "$STATE" ]] || { echo "✗ $STATE not found — run from the project root." >&2; exit 1; }

# ---- helpers -----------------------------------------------------------------
bold() { printf '\033[1m%s\033[0m' "$1"; }
slugify() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'; }
pascal() { printf '%s' "$1" | sed -E 's/(^|-)([a-z0-9])/\U\2/g'; }
camel() { local p; p="$(pascal "$1")"; printf '%s' "${p,}"; }
snake() { printf '%s' "$1" | tr '-' '_'; }
upper() { printf '%s' "$1" | tr '[:lower:]' '[:upper:]'; }

ask() { # ask VAR "Prompt" "default" "regex" "error message"
  local __var="$1" prompt="$2" default="$3" pattern="${4:-}" msg="${5:-Invalid value.}" answer
  if [[ -n "${!__var:-}" ]]; then default="${!__var}"; fi
  while true; do
    if [[ "$YES" -eq 1 ]]; then
      answer="$default"
    else
      read -r -p "$(bold "$prompt") [${default}]: " answer || true
      answer="${answer:-$default}"
    fi
    if [[ -z "$answer" ]]; then echo "  ✗ A value is required." >&2
    elif [[ "$answer" == *$'\n'* ]]; then echo "  ✗ No newlines, please." >&2
    elif [[ -n "$pattern" && ! "$answer" =~ $pattern ]]; then echo "  ✗ $msg" >&2
    else printf -v "$__var" '%s' "$answer"; return 0
    fi
    [[ "$YES" -eq 1 ]] && exit 1
  done
}

# ---- CLI flags -----------------------------------------------------------------
YES=0
NAME="" SLUG="" NAMESPACE="" PREFIX="" CONST_PREFIX="" JS_GLOBAL=""
DESCRIPTION="" AUTHOR="" AUTHOR_URI="" PLUGIN_URI="" VENDOR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --slug) SLUG="$2"; shift 2 ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --author) AUTHOR="$2"; shift 2 ;;
    --author-uri) AUTHOR_URI="$2"; shift 2 ;;
    --plugin-uri) PLUGIN_URI="$2"; shift 2 ;;
    --vendor) VENDOR="$2"; shift 2 ;;
    -y|--yes) YES=1; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

old() { jq -r --arg k "$1" '.[$k]' "$STATE"; }

echo ""
echo "  $(bold 'WordPress plugin starter — project setup')"
echo "  Current identity: $(old name) ($(old slug))"
echo ""

ask NAME        "Plugin name"           "$(old name)"   '^[^"\\]+$' 'Quotes and backslashes are not allowed.'
ask SLUG        "Slug / text domain"    "$(slugify "$NAME")" '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' 'Use lowercase letters, digits and dashes (e.g. my-plugin).'
ask NAMESPACE   "PHP namespace"         "$(pascal "$SLUG")" '^[A-Z][A-Za-z0-9]*$' 'Use PascalCase, a single segment (e.g. MyPlugin).'
ask PREFIX      "PHP prefix (options, hooks, tables)" "$(snake "$SLUG")" '^[a-z][a-z0-9_]*$' 'Use snake_case.'
CONST_PREFIX="$(upper "$PREFIX")"
JS_GLOBAL="$(camel "$SLUG")"
ask DESCRIPTION "Description"           "$(old description)" '^[^"\\]+$' 'Quotes and backslashes are not allowed.'
ask AUTHOR      "Author"                "$(old author)" '^[^"\\]+$' 'Quotes and backslashes are not allowed.'
ask AUTHOR_URI  "Author URI"            "$(old authorUri)" '^https?://[^[:space:]"]+$' 'Must be an http(s) URL.'
ask PLUGIN_URI  "Plugin URI"            "${AUTHOR_URI%/}/${SLUG}" '^https?://[^[:space:]"]+$' 'Must be an http(s) URL.'
ask VENDOR      "Composer vendor"       "$(slugify "$AUTHOR")" '^[a-z0-9]([_.-]?[a-z0-9]+)*$' 'Use lowercase (e.g. acme).'

cat <<EOF

  Name ........... $NAME
  Slug ........... $SLUG   (REST: /wp-json/$SLUG/v1)
  Namespace ...... $NAMESPACE
  Prefix ......... $PREFIX / $CONST_PREFIX
  JS global ...... window.$JS_GLOBAL
  Composer ....... $VENDOR/$SLUG

EOF

if [[ "$YES" -ne 1 ]]; then
  read -r -p "$(bold 'Apply these changes?') [y/N]: " confirm || true
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

# ---- replace -------------------------------------------------------------------
# Order matters (longest/most specific first); a two-phase swap through unique
# sentinels prevents a new value from being re-replaced by a later rule.
KEYS=(description pluginUri authorUri author name namespace jsGlobal constPrefix prefix slug vendor)
declare -A NEW=(
  [description]="$DESCRIPTION" [pluginUri]="$PLUGIN_URI" [authorUri]="$AUTHOR_URI" [author]="$AUTHOR"
  [name]="$NAME" [namespace]="$NAMESPACE" [jsGlobal]="$JS_GLOBAL" [constPrefix]="$CONST_PREFIX"
  [prefix]="$PREFIX" [slug]="$SLUG" [vendor]="$VENDOR"
)

re_escape() { printf '%s' "$1" | sed -e 's/[]\/$*.^[]/\\&/g'; }
sub_escape() { printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'; }

mapfile -t FILES < <(
  find . -type f \
    -not -path './.git/*' -not -path '*/node_modules/*' -not -path './plugin/vendor/*' \
    -not -path './dist/*' -not -path './plugin/assets/dist/*' \
    -not -name 'init.sh' -not -name "$STATE" -not -name '*.lock' \
    -exec grep -Il . {} + 2>/dev/null
)

PHASE1=() PHASE2=()
for i in "${!KEYS[@]}"; do
  key="${KEYS[$i]}" from="$(old "${KEYS[$i]}")" to="${NEW[${KEYS[$i]}]}"
  [[ "$from" == "$to" ]] && continue
  sentinel="__STARTER_TOKEN_${i}__"
  PHASE1+=(-e "s/$(re_escape "$from")/${sentinel}/g")
  PHASE2+=(-e "s/${sentinel}/$(sub_escape "$to")/g")
done

if [[ ${#PHASE1[@]} -gt 0 ]]; then
  for f in "${FILES[@]}"; do
    sed -i "${PHASE1[@]}" "$f"
    sed -i "${PHASE2[@]}" "$f"
  done
fi

# ---- rename main plugin file ---------------------------------------------------
OLD_SLUG="$(old slug)"
if [[ "$OLD_SLUG" != "$SLUG" ]]; then
  [[ -f "plugin/${OLD_SLUG}.php" ]] && mv "plugin/${OLD_SLUG}.php" "plugin/${SLUG}.php"
  # Translation files are named after the text domain (= slug).
  shopt -s nullglob
  for f in plugin/languages/*"${OLD_SLUG}"*; do
    mv "$f" "plugin/languages/$(basename "${f//${OLD_SLUG}/${SLUG}}")"
  done
  shopt -u nullglob
fi

# ---- save new identity ---------------------------------------------------------
jq -n \
  --arg name "$NAME" --arg slug "$SLUG" --arg namespace "$NAMESPACE" --arg prefix "$PREFIX" \
  --arg constPrefix "$CONST_PREFIX" --arg jsGlobal "$JS_GLOBAL" --arg description "$DESCRIPTION" \
  --arg author "$AUTHOR" --arg authorUri "$AUTHOR_URI" --arg pluginUri "$PLUGIN_URI" --arg vendor "$VENDOR" \
  '{name:$name, slug:$slug, namespace:$namespace, prefix:$prefix, constPrefix:$constPrefix, jsGlobal:$jsGlobal,
    description:$description, author:$author, authorUri:$authorUri, pluginUri:$pluginUri, vendor:$vendor}' \
  > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"

# ---- fresh history: version 0.1.0 + clean changelog --------------------------------
bash scripts/bump-version.sh 0.1.0 --allow-downgrade --no-changelog >/dev/null
cat > CHANGELOG.md <<EOF
# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

- Initial release.
EOF
awk '/^== Changelog ==/{print; print ""; print "= 0.1.0 ="; print "* Initial release."; exit} {print}' \
  plugin/readme.txt > plugin/readme.txt.tmp && mv plugin/readme.txt.tmp plugin/readme.txt

cat <<EOF

  ✓ Project renamed to $(bold "$NAME").

  Next steps:
    make dev                       # start WordPress + Vite with HMR
    make i18n                      # refresh translations (make init already recompiled them)
    rm -rf .git && git init        # optional: start a fresh git history
    make nuke                      # if you had the old stack running (new project name = new volumes)

EOF
