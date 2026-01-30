#!/bin/bash
# Sync local branch with upstream while preserving uncommitted changes
# Usage: ./scripts/sync-upstream.sh [branch]

set -e

BRANCH="${1:-main}"
REMOTE="${2:-origin}"

echo "🔄 Syncing with $REMOTE/$BRANCH..."

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "📦 Stashing local changes..."
  git stash push -m "sync-upstream-$(date +%Y%m%d-%H%M%S)" --include-untracked
  STASHED=true
else
  STASHED=false
fi

# Fetch and rebase
echo "⬇️  Fetching latest from $REMOTE..."
git fetch "$REMOTE" "$BRANCH"

echo "🔀 Rebasing onto $REMOTE/$BRANCH..."
if ! git rebase "$REMOTE/$BRANCH"; then
  echo "❌ Rebase failed. Aborting..."
  git rebase --abort
  if [[ "$STASHED" == true ]]; then
    echo "📦 Restoring stashed changes..."
    git stash pop
  fi
  exit 1
fi

# Restore stashed changes
if [[ "$STASHED" == true ]]; then
  echo "📦 Restoring local changes..."
  if ! git stash pop; then
    echo "⚠️  Stash pop had conflicts. Resolve manually with: git stash show -p | git apply"
    exit 1
  fi
fi

# Push to fork
PUSH_REMOTE="fork"
echo "⬆️  Pushing rebased changes to $PUSH_REMOTE/$BRANCH..."
if git push "$PUSH_REMOTE" "$BRANCH" --force-with-lease; then
  echo "✅ Push successful!"
else
  echo "❌ Push failed. You may need to push manually."
fi

echo "✅ Sync complete!"
git status --short
