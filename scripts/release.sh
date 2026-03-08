#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh <package-short-name> <version>
# Example: ./scripts/release.sh react-hook-stability 0.2.0

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <package-short-name> <version>"
  echo "Example: $0 react-hook-stability 0.2.0"
  exit 1
fi

SHORT_NAME="$1"
VERSION="$2"
PACKAGE_DIR="packages/eslint-plugin-${SHORT_NAME}"
TAG="${SHORT_NAME}-v${VERSION}"

if [[ ! -d "$PACKAGE_DIR" ]]; then
  echo "Error: package directory '$PACKAGE_DIR' not found"
  exit 1
fi

# Validate version format
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo "Error: invalid version '$VERSION' (expected semver like 1.2.3 or 1.2.3-beta.1)"
  exit 1
fi

# Ensure working tree is clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit or stash changes first."
  exit 1
fi

# Ensure we're on main
BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Error: releases should be created from main (currently on '$BRANCH')"
  exit 1
fi

# Read package name from package.json
PACKAGE_NAME="$(node -p "require('./${PACKAGE_DIR}/package.json').name")"

echo "Releasing ${PACKAGE_NAME}@${VERSION} (tag: ${TAG})"
echo ""

# Bump version in package.json
npm version "$VERSION" --no-git-tag-version -w "$PACKAGE_DIR"

# Update package-lock.json
npm install --package-lock-only

# Commit the version bump
git add "${PACKAGE_DIR}/package.json" package-lock.json
git commit -m "chore(${SHORT_NAME}): release v${VERSION}"

# Push the commit
git push

# Create GitHub release (triggers publish workflow)
gh release create "$TAG" \
  --title "${PACKAGE_NAME}@${VERSION}" \
  --generate-notes \
  --target main

echo ""
echo "Release created: ${TAG}"
echo "The publish workflow will build, test, and publish to npm."
echo "Monitor: gh run watch"
