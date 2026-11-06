#!/usr/bin/env bash
# Bump the plugin version everywhere it lives.
#
#   scripts/bump-version.sh patch|minor|major|<x.y.z[-pre]> [--allow-downgrade] [--no-changelog]
#
# Updates: plugin header "Version:", the *_VERSION constant, readme.txt
# "Stable tag:" + changelog, admin-client/package.json (+ lock) and
# CHANGELOG.md (moves "Unreleased" notes under the new version).
# Runs inside the `tools` container: `make bump BUMP=patch` / `make release`.
set -euo pipefail

cd "$(dirname "$0")/.."

usage() {
  echo "Usage: $0 patch|minor|major|<x.y.z> [--allow-downgrade] [--no-changelog]" >&2
  exit 1
}

BUMP="${1:-}"
[[ -n "$BUMP" ]] || usage
shift
ALLOW_DOWNGRADE=0
CHANGELOG=1
for arg in "$@"; do
  case "$arg" in
    --allow-downgrade) ALLOW_DOWNGRADE=1 ;;
    --no-changelog) CHANGELOG=0 ;;
    *) usage ;;
  esac
done

SLUG="$(jq -r .slug starter.json)"
MAIN="plugin/${SLUG}.php"
README="plugin/readme.txt"
PKG="admin-client/package.json"
LOCK="admin-client/package-lock.json"

[[ -f "$MAIN" ]] || { echo "✗ $MAIN not found" >&2; exit 1; }

SEMVER='^([0-9]+)\.([0-9]+)\.([0-9]+)(-[0-9A-Za-z.-]+)?$'
CURRENT="$(sed -n 's/^[[:space:]]*\*[[:space:]]*Version:[[:space:]]*//p' "$MAIN" | head -n1 | tr -d '[:space:]')"
[[ "$CURRENT" =~ $SEMVER ]] || { echo "✗ Current version '$CURRENT' is not semver" >&2; exit 1; }
MAJOR="${BASH_REMATCH[1]}" MINOR="${BASH_REMATCH[2]}" PATCH="${BASH_REMATCH[3]}" PRE="${BASH_REMATCH[4]}"

case "$BUMP" in
  major) NEW="$((MAJOR + 1)).0.0" ;;
  minor) NEW="${MAJOR}.$((MINOR + 1)).0" ;;
  # 1.2.0-beta.1 → patch → 1.2.0 (finalises a pre-release)
  patch) [[ -n "$PRE" ]] && NEW="${MAJOR}.${MINOR}.${PATCH}" || NEW="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
  *)
    [[ "$BUMP" =~ $SEMVER ]] || { echo "✗ '$BUMP' is not a valid version" >&2; exit 1; }
    NEW="$BUMP"
    ;;
esac

if [[ "$NEW" == "$CURRENT" ]]; then
  echo "✓ Version is already $NEW"
  exit 0
fi
# semver_gt A B → true if A > B (a release outranks its own pre-releases).
semver_gt() {
  [[ "$1" =~ $SEMVER ]]; local a=("${BASH_REMATCH[@]:1:3}") ap="${BASH_REMATCH[4]}"
  [[ "$2" =~ $SEMVER ]]; local b=("${BASH_REMATCH[@]:1:3}") bp="${BASH_REMATCH[4]}"
  for i in 0 1 2; do
    ((10#${a[$i]} > 10#${b[$i]})) && return 0
    ((10#${a[$i]} < 10#${b[$i]})) && return 1
  done
  [[ -z "$ap" && -n "$bp" ]] && return 0
  [[ -n "$ap" && -z "$bp" ]] && return 1
  [[ "$ap" != "$bp" && "$(printf '%s\n%s\n' "$ap" "$bp" | sort -V | tail -n1)" == "$ap" ]]
}
if [[ "$ALLOW_DOWNGRADE" -eq 0 ]] && ! semver_gt "$NEW" "$CURRENT"; then
  echo "✗ $NEW is lower than current $CURRENT (use --allow-downgrade)" >&2
  exit 1
fi

TODAY="$(date +%Y-%m-%d)"

# --- PHP main file ----------------------------------------------------------
sed -i -E "s/^([[:space:]]*\*[[:space:]]*Version:[[:space:]]*).*/\1${NEW}/" "$MAIN"
sed -i -E "s/(define\([[:space:]]*'[A-Z0-9_]+_VERSION',[[:space:]]*')[^']*(')/\1${NEW}\2/" "$MAIN"

# --- readme.txt -------------------------------------------------------------
sed -i -E "s/^(Stable tag:[[:space:]]*).*/\1${NEW}/" "$README"

# --- package.json / lock ----------------------------------------------------
tmp="$(mktemp)"
jq --arg v "$NEW" '.version = $v' "$PKG" > "$tmp" && cat "$tmp" > "$PKG"
if [[ -f "$LOCK" ]]; then
  jq --arg v "$NEW" '.version = $v | if .packages[""] then .packages[""].version = $v else . end' "$LOCK" > "$tmp" && cat "$tmp" > "$LOCK"
fi
rm -f "$tmp"

# --- CHANGELOG.md + readme.txt changelog --------------------------------------
if [[ "$CHANGELOG" -eq 1 ]]; then
  if [[ -f CHANGELOG.md ]] && grep -q '^## \[Unreleased\]' CHANGELOG.md; then
    # Bullet lines under "Unreleased" become the readme.txt entry too.
    NOTES="$(awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f && /^[-*] /{sub(/^[-*] /,"* "); print}' CHANGELOG.md)"
    sed -i "s/^## \[Unreleased\]/## [Unreleased]\n\n## [${NEW}] - ${TODAY}/" CHANGELOG.md
  fi
  [[ -n "${NOTES:-}" ]] || NOTES="* Maintenance release."
  awk -v ver="$NEW" -v notes="$NOTES" '
    { print }
    /^== Changelog ==/ { print ""; print "= " ver " ="; print notes; inserted=1 }
  ' "$README" > "$README.tmp" && cat "$README.tmp" > "$README" && rm -f "$README.tmp"
fi

echo "✓ Version bumped: ${CURRENT} → ${NEW}"
