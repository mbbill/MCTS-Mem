#!/usr/bin/env bash
#
# Release script for mcts-mem (single, pure-JS npm package).
#
# Flow:
#   1. Sanity-check: clean working tree, on main, tests green.
#   2. Prompt for the new version (patch / minor / major / custom).
#   3. Bump package.json, commit "release: vX.Y.Z", tag vX.Y.Z.
#   4. Optionally push. Pushing the tag triggers .github/workflows/release.yml,
#      which re-runs the suite and `npm publish`es with provenance.
#
# Usage:  scripts/release.sh
#
# Back out a local (un-pushed) release:
#   git reset --hard HEAD~1 && git tag -d vX.Y.Z

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ────────────────────────────────────────────────────────────────────
# 1. Sanity checks
# ────────────────────────────────────────────────────────────────────

if ! git diff-index --quiet HEAD --; then
  echo "error: uncommitted changes in working tree. Commit or stash first." >&2
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  echo "warning: you're on branch '$BRANCH', not 'main'."
  read -r -p "continue anyway? [y/N] " ack
  case "$ack" in y | Y | yes | YES | Yes) ;; *) exit 1 ;; esac
fi

echo "==> running tests"
npm test

# ────────────────────────────────────────────────────────────────────
# 2. Compute bump options
# ────────────────────────────────────────────────────────────────────

CURRENT="$(node -p "require('./package.json').version")"

# Strip any prerelease suffix (-rc.1 etc.) before the arithmetic.
CORE="${CURRENT%-*}"
IFS=. read -r MAJOR MINOR PATCH <<<"$CORE"
NEXT_PATCH="$MAJOR.$MINOR.$((PATCH + 1))"
NEXT_MINOR="$MAJOR.$((MINOR + 1)).0"
NEXT_MAJOR="$((MAJOR + 1)).0.0"

echo
echo "Current version: $CURRENT"
echo
echo "Choose bump:"
echo "  1) patch  → $NEXT_PATCH   (bug fixes, no API change)"
echo "  2) minor  → $NEXT_MINOR   (new features, backward compatible)"
echo "  3) major  → $NEXT_MAJOR   (breaking changes)"
echo "  4) custom (type your own)"
echo
read -r -p "[1-4]: " choice

case "$choice" in
  1) NEW="$NEXT_PATCH" ;;
  2) NEW="$NEXT_MINOR" ;;
  3) NEW="$NEXT_MAJOR" ;;
  4) read -r -p "Enter version (X.Y.Z or X.Y.Z-prerelease): " NEW ;;
  *) echo "error: invalid choice '$choice'" >&2; exit 1 ;;
esac

if ! [[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$ ]]; then
  echo "error: '$NEW' is not valid semver" >&2
  exit 1
fi

if [ "$(printf '%s\n%s\n' "$CURRENT" "$NEW" | sort -V | tail -n1)" != "$NEW" ] || [ "$NEW" = "$CURRENT" ]; then
  echo "error: new version $NEW must be greater than current $CURRENT" >&2
  exit 1
fi

echo
read -r -p "Bump $CURRENT → $NEW? [y/N] " confirm
case "$confirm" in y | Y | yes | YES | Yes) ;; *) echo "aborted, no changes made"; exit 1 ;; esac

# ────────────────────────────────────────────────────────────────────
# 3. Bump, commit, tag
# ────────────────────────────────────────────────────────────────────

# `npm version` rewrites package.json the canonical way (no sed fragility);
# --no-git-tag-version leaves the commit + tag to us so we control the message.
npm version "$NEW" --no-git-tag-version >/dev/null
echo "==> package.json bumped to $NEW"

git add package.json
git commit -q -m "release: v$NEW"
git tag "v$NEW"
echo "  ✓ committed and tagged v$NEW"

# ────────────────────────────────────────────────────────────────────
# 4. Optional push (triggers the release workflow)
# ────────────────────────────────────────────────────────────────────

echo
echo "Pushing the tag triggers .github/workflows/release.yml:"
echo "  - re-runs the test suite"
echo "  - npm publishes mcts-mem@$NEW with provenance"
echo
read -r -p "Push to origin now? [y/N] " confirm

case "$confirm" in y | Y | yes | YES | Yes) PUSH=1 ;; *) PUSH=0 ;; esac
if [ "$PUSH" = 1 ]; then
  git push origin "$BRANCH" "v$NEW"
  echo
  echo "  ✓ pushed. Release workflow is running:"
  echo "    https://github.com/mbbill/MCTS-Mem/actions"
  if command -v gh >/dev/null 2>&1; then
    echo "    or: gh run watch"
  fi
else
  echo
  echo "Tag v$NEW created locally but not pushed."
  echo "  Push later:  git push origin $BRANCH v$NEW"
  echo "  Abort:       git reset --hard HEAD~1 && git tag -d v$NEW"
fi
